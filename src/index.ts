import { HEALTH, json, methodNotAllowed, notFound, placeholder } from "./responses.ts";

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
  if (kind === "v1") return placeholder("/v1/*");
  if (kind === "mcp") return placeholder("/mcp");
  return notFound();
}

export default {
  fetch(request: Request): Promise<Response> {
    return Promise.resolve(handleRequest(request));
  },
};
