import { HEALTH, json, methodNotAllowed, notFound } from "./responses.ts";
import { miniStatus } from './tunnel.ts';
import { api, ApiError } from './agent.ts';
import { mcp } from './mcp.ts';
import { human, type HumanEnv } from './human.ts';
import { resourceMetadata, discoveryChallenge, metadataPath } from './oauth-resource.ts';

export type RouteKind = "health" | "v1" | "mcp" | "miss";

export function classify(pathname: string): RouteKind {
  const path = pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
  if (path === "/" || path === "/health") return "health";
  if (path === "/v1" || path.startsWith("/v1/")) return "v1";
  if (path === "/mcp") return "mcp";
  return "miss";
}

export function handleRequest(request: Request): Response {
  const kind = classify(new URL(request.url).pathname);
  if (kind === "health") {
    if (request.method !== "GET") return methodNotAllowed();
    return json(HEALTH, 200);
  }
  if (kind === "v1" || kind === "mcp") return json({ error: "agent_bearer_required" }, 401);
  return notFound();
}

export default {
  async fetch(request: Request, env: HumanEnv = {}): Promise<Response> {
    if (metadataPath(new URL(request.url).pathname)) {
      return request.method === 'GET' ? resourceMetadata(env.MCP_OAUTH_ENABLED === 'true', env.MCP_OAUTH_ISSUER) : methodNotAllowed();
    }
    if (classify(new URL(request.url).pathname) === 'health' && request.method === 'GET' && !(new URL(request.url).pathname === '/' && env.ACCESS_ISSUER && env.ACCESS_AUD)) {
      const reachability = await miniStatus(env);
      return json({ ...HEALTH, ...reachability, status: reachability.sandisk ? 'storage-ready' : 'stub' }, 200);
    }
    try {
      if (new URL(request.url).pathname === '/app' || (new URL(request.url).pathname === '/' && env.ACCESS_ISSUER && env.ACCESS_AUD)) return await human(request, env);
      const kind = classify(new URL(request.url).pathname);
      if (kind === 'v1') return await api(request, env);
      if (kind === 'mcp') return await mcp(request, env);
      return handleRequest(request);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 503;
      return json({ error: e instanceof ApiError ? e.message : 'service_unavailable' }, status,
        status === 401 && new URL(request.url).pathname === '/mcp' && env.MCP_OAUTH_ENABLED === 'true'
          ? { 'www-authenticate': discoveryChallenge } : undefined);
    }
  },
};
