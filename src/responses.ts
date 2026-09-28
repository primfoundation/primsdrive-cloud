export const SERVICE = "primsdrive-cloud";

export const HEALTH = {
  ok: true,
  service: SERVICE,
  status: "stub",
  host: "drive.prims.sh",
  sandisk: false,
  tunnel: false,
  routes: {
    "/": "health",
    "/health": "health",
    "/v1/*": "agent-api",
    "/mcp": "mcp",
  },
} as const;

export function json(body: unknown, status: number = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers });
}

export function notFound(): Response {
  return json({ ok: false, service: SERVICE, error: "not found" }, 404);
}

export function methodNotAllowed(): Response {
  return json(
    { ok: false, service: SERVICE, error: "method not allowed" },
    405,
    { allow: "GET" },
  );
}
