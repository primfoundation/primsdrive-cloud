export interface TunnelEnv {
  MINI_HELLO?: { fetch(request: Request): Promise<Response> };
  MINI_PROBE_SECRET?: string;
}

// Fixed target: no caller-controlled URL, path, headers or redirects.
export async function probeMini(env: TunnelEnv): Promise<boolean> {
  if (!env.MINI_HELLO || !env.MINI_PROBE_SECRET) return false;
  const nonce = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await env.MINI_HELLO.fetch(new Request('http://127.0.0.1:18746/hello', {
      headers: { authorization: `Bearer ${env.MINI_PROBE_SECRET}`, 'x-probe-nonce': nonce },
      redirect: 'manual', signal: controller.signal,
    }));
    if (response.status !== 200) return false;
    const body = await response.json() as Record<string, unknown>;
    return body.ok === true && body.service === 'primsdrive-mini-hello'
      && body.nonce === nonce && body.sandisk === false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
