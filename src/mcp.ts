import { ApiError, authenticate, boundedJson, operation, type AgentEnv } from './agent.ts';
import { json } from './responses.ts';
import { challenge } from './oauth-resource.ts';
const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
const properties = { profile: { type: 'string', description: 'Assigned top-level directory under the Sandisk Prims root.' },
  path: { type: 'string', description: 'Relative object or directory path within that profile.' },
  offset: { type: 'integer', minimum: 0 }, content_base64: { type: 'string' },
  match: { type: 'string', description: 'ETag from get; required to overwrite or delete.' },
  create: { type: 'boolean', description: 'True for create-only; fails if the object already exists.' } };
const definitions = [
  ['pack_list', 'list', ['profile'], ['profile','path','offset']],
  ['pack_read', 'get', ['profile','path'], ['profile','path']],
  ['pack_write', 'put', ['profile','path','content_base64'], ['profile','path','content_base64','match','create']],
  ['pack_delete', 'delete', ['profile','path','match'], ['profile','path','match']],
  ['drive_health', 'health', ['profile'], ['profile']],
] as const;
export async function mcp(request: Request, env: AgentEnv): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== 'https://drive.prims.sh') throw new ApiError(403, 'origin_denied');
  const identity = await authenticate(request, env, env.MCP_OAUTH_ENABLED === 'true');
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
  const version = request.headers.get('mcp-protocol-version');
  if (version && !VERSIONS.includes(version)) throw new ApiError(400, 'unsupported_protocol_version');
  const accept = request.headers.get('accept') ?? '';
  if (!accept.includes('application/json') || !accept.includes('text/event-stream')) throw new ApiError(406, 'mcp_accept_required');
  let b: Record<string, unknown>;
  try { b = await boundedJson(request); } catch (e) {
    if (e instanceof ApiError && e.status === 400) return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    throw e;
  }
  const id = b.id;
  const error = (code: number, message: string) => json({ jsonrpc: '2.0', id: typeof id === 'string' || typeof id === 'number' ? id : null, error: { code, message } });
  if (b.jsonrpc !== '2.0' || typeof b.method !== 'string' || (id !== undefined && typeof id !== 'string' && typeof id !== 'number')) return error(-32600, 'Invalid request');
  if (id === undefined) {
    if (b.method === 'notifications/initialized' || b.method === 'notifications/cancelled') return new Response(null, { status: 202 });
    return error(-32600, 'Request id required');
  }
  const ok = (result: unknown) => json({ jsonrpc: '2.0', id, result });
  const params = b.params as Record<string, unknown> | undefined;
  if (b.method === 'initialize') {
    if (!params || typeof params.protocolVersion !== 'string' || !params.clientInfo || !params.capabilities) return error(-32602, 'Invalid initialize parameters');
    return ok({ protocolVersion: VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0],
      capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'primsdrive', version: '0.1.0' },
      instructions: 'Only assigned profiles are accessible. Content uses base64. Read ETags before overwriting or deleting. Maximum object size is 16 MiB.' });
  }
  if (b.method === 'ping') return ok({});
  if (b.method === 'tools/list') return ok({ tools: definitions.map(([name, op, required, fields]) => ({ name,
    description: `${op} Sandisk pack objects through PrimsDrive; profiles: ${identity.profiles.join(', ')}`,
    inputSchema: { type: 'object', properties: Object.fromEntries(fields.map(f => [f, properties[f]])), required, additionalProperties: false },
    ...(env.MCP_OAUTH_ENABLED === 'true' ? { securitySchemes: [{ type: 'oauth2', scopes: [(['put','delete'] as string[]).includes(op) ? 'primsdrive.write' : 'primsdrive.read'] }] } : {}),
    annotations: { readOnlyHint: !['put','delete'].includes(op), destructiveHint: ['put','delete'].includes(op), openWorldHint: false },
  })) });
  if (b.method !== 'tools/call') return error(-32601, 'Method not found');
  const definition = definitions.find(([name]) => name === params?.name);
  if (!definition) return error(-32602, 'Unknown tool');
  const args = params?.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return error(-32602, 'Arguments must be an object');
  const obj = args as Record<string, unknown>;
  if (definition[2].some(k => !(k in obj)) || Object.keys(obj).some(k => !(definition[3] as readonly string[]).includes(k))) return error(-32602, 'Invalid tool arguments');
  try {
    const res = await operation(env, identity, { ...obj, op: definition[1] });
    const body = await res.json();
    return ok({ content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body, isError: !res.ok });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    const requiredScope = ['put','delete'].includes(definition[1]) ? 'primsdrive.write' : 'primsdrive.read';
    return ok({ content: [{ type: 'text', text: e.message }], isError: true,
      ...(env.MCP_OAUTH_ENABLED === 'true' && e.message === 'oauth_scope_denied'
        ? { _meta: { 'mcp/www_authenticate': [`${challenge}, error="insufficient_scope", scope="${requiredScope}"`] } } : {}),
    });
  }
}
