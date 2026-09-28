import { json } from './responses.ts';
import { RESOURCE } from './oauth-resource.ts';
import type { TunnelEnv } from './tunnel.ts';

export interface AgentEnv extends TunnelEnv {
  PRIMS_SSO?: { fetch(request: Request): Promise<Response> };
  // Assigned by the Drive operator, never by a self-registered account or agent.
  DRIVE_ACCOUNT_PROFILES?: string;
  MCP_OAUTH_ENABLED?: string;
  MCP_OAUTH_ISSUER?: string;
}
export interface Identity { agent_id: string; account_id: string; profiles: string[]; oauthScopes?: string[] }
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export function component(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && !value.startsWith('.') && !/[\/\\\x00-\x1f\x7f]/.test(value);
}
export function objectPath(value: unknown, empty = false): value is string {
  return typeof value === 'string' && value.length <= 1024
    && ((empty && value === '') || value.split('/').every(component));
}
export async function boundedJson(request: Request, max = 24 * 1024 * 1024): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'json_required');
  if (!request.body) throw new ApiError(400, 'body_required');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new ApiError(413, 'request_too_large'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(400, 'invalid_json'); }
}
async function sso(env: AgentEnv, path: string, body: unknown): Promise<Response> {
  if (!env.PRIMS_SSO) throw new ApiError(503, 'identity_unavailable');
  try {
    return await env.PRIMS_SSO.fetch(new Request('https://login.prims.sh' + path, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      redirect: 'manual', signal: AbortSignal.timeout(5000),
    }));
  } catch { throw new ApiError(503, 'identity_unavailable'); }
}
export async function authenticate(request: Request, env: AgentEnv, oauth = false): Promise<Identity> {
  // Never interpret a session cookie or Stytch session token as an agent credential.
  const pattern = oauth ? /^Bearer ([A-Za-z0-9._~+/-]{1,16384}={0,2})$/ : /^Bearer (agt_[A-Za-z0-9_-]{43})$/;
  const token = pattern.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) throw new ApiError(401, 'agent_bearer_required');
  const res = await sso(env, oauth ? '/v1/oauth/introspect' : '/v1/agent-tokens/introspect', { token });
  if (res.status === 401) throw new ApiError(401, 'invalid_agent_token');
  if (res.status !== 200) throw new ApiError(503, 'identity_unavailable');
  const id = await res.json() as Record<string, unknown>;
  if (id.active !== true || typeof id.agent_id !== 'string' || typeof id.account_id !== 'string') throw new ApiError(401, 'invalid_agent_token');
  let oauthScopes: string[] | undefined;
  if (oauth) {
    if (id.resource !== RESOURCE || typeof id.scope !== 'string') throw new ApiError(401, 'wrong_token_resource');
    oauthScopes = id.scope.split(' ').filter(Boolean);
    if (!oauthScopes.some(s => s === 'primsdrive.read' || s === 'primsdrive.write')) throw new ApiError(403, 'oauth_scope_denied');
  }
  let grants: Record<string, unknown>;
  try { grants = JSON.parse(env.DRIVE_ACCOUNT_PROFILES ?? '{}'); } catch { throw new ApiError(503, 'invalid_profile_configuration'); }
  const profiles = grants[id.account_id];
  if (!Array.isArray(profiles) || !profiles.length || !profiles.every(component)) throw new ApiError(403, 'account_not_assigned');
  return { agent_id: id.agent_id, account_id: id.account_id, profiles, oauthScopes };
}
export async function authorize(env: AgentEnv, identity: Identity, profile: string, write: boolean): Promise<void> {
  if (identity.oauthScopes && !identity.oauthScopes.includes(write ? 'primsdrive.write' : 'primsdrive.read')) throw new ApiError(403, 'oauth_scope_denied');
  if (!identity.profiles.includes(profile)) throw new ApiError(403, 'profile_denied');
  const res = await sso(env, '/v1/policy/check', {
    agent_id: identity.agent_id, resource: 'primsdrive:profile:' + profile, action: write ? 'write' : 'read',
  });
  if (res.status !== 200) throw new ApiError(503, 'policy_unavailable');
  const result = await res.json() as { allow?: unknown };
  if (result.allow !== true) throw new ApiError(403, 'scope_denied');
}
export async function mini(env: AgentEnv, body: Record<string, unknown>): Promise<Response> {
  if (!env.MINI_HELLO || !env.MINI_PROBE_SECRET) throw new ApiError(503, 'mini_unavailable');
  try {
    const res = await env.MINI_HELLO.fetch(new Request('http://127.0.0.1:18746/rpc', {
      method: 'POST', headers: { authorization: 'Bearer ' + env.MINI_PROBE_SECRET, 'content-type': 'application/json' },
      body: JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(15000),
    }));
    if (res.status >= 300 && res.status < 400) throw new Error();
    // No origin cookies/headers or redirects escape to clients.
    return json(await res.json(), res.status);
  } catch { throw new ApiError(503, 'mini_unavailable'); }
}
export async function operation(env: AgentEnv, identity: Identity, args: Record<string, unknown>): Promise<Response> {
  const { op, profile, path = '' } = args;
  if (!['list', 'get', 'put', 'delete', 'health'].includes(String(op))) throw new ApiError(400, 'invalid_operation');
  if (!component(profile) || !objectPath(path, op === 'list' || op === 'health')) throw new ApiError(400, 'invalid_path');
  await authorize(env, identity, profile, op === 'put' || op === 'delete');
  if (op === 'put') {
    if (typeof args.content_base64 !== 'string' || args.content_base64.length > 22369624
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(args.content_base64)) throw new ApiError(400, 'invalid_content_base64');
  }
  if ((op === 'put' || op === 'delete') && args.create !== true
    && (typeof args.match !== 'string' || !/^"[a-f0-9]{64}"$/.test(args.match))) throw new ApiError(428, 'etag_required');
  if (op === 'delete' && args.create === true) throw new ApiError(400, 'invalid_precondition');
  if (args.offset !== undefined && (!Number.isSafeInteger(args.offset) || Number(args.offset) < 0)) throw new ApiError(400, 'invalid_offset');
  return mini(env, { op, profile, path, content_base64: args.content_base64, match: args.match, create: args.create === true, offset: args.offset });
}
export async function api(request: Request, env: AgentEnv): Promise<Response> {
  const identity = await authenticate(request, env);
  const url = new URL(request.url);
  if (url.pathname !== '/v1/packs' && url.pathname !== '/v1/health') throw new ApiError(404, 'not_found');
  const op = url.pathname === '/v1/health' ? 'health' : ({ GET: url.searchParams.get('path') ? 'get' : 'list', POST: 'list', PUT: 'put', DELETE: 'delete' } as Record<string, string>)[request.method];
  if (!op || (url.pathname === '/v1/health' && request.method !== 'GET')) throw new ApiError(405, 'method_not_allowed');
  const body = request.method === 'PUT' || request.method === 'POST' ? await boundedJson(request) : {};
  return operation(env, identity, { ...body, op, profile: url.searchParams.get('profile'), path: url.searchParams.get('path') ?? '',
    match: request.headers.get('if-match') ?? undefined, create: request.headers.get('if-none-match') === '*',
    offset: url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : undefined });
}
