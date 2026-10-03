export interface TunnelEnv {
  MINI_HELLO?: { fetch(request: Request): Promise<Response> };
  MINI_PROBE_SECRET?: string;
}

export type ProbeCode =
  | 'ok'
  | 'unconfigured'
  | 'timeout'
  | 'unauthorized'
  | 'rejected'
  | 'redirect'
  | 'bad_response'
  | 'unreachable';

export interface ProbeResult {
  tunnel: boolean;
  sandisk: boolean;
  probe: ProbeCode;
}

function offline(probe: ProbeCode): ProbeResult {
  return { tunnel: false, sandisk: false, probe };
}

function classifyStatus(status: number): ProbeCode | null {
  if (status === 200) return null;
  if (status === 401) return 'unauthorized';
  if (status === 400) return 'rejected';
  if (status >= 300 && status < 400) return 'redirect';
  return 'unreachable';
}

function classifyBody(body: Record<string, unknown>, nonce: string): ProbeResult {
  const valid = body.ok === true && body.service === 'primsdrive-mini-hello'
    && body.nonce === nonce && typeof body.sandisk === 'boolean';
  return valid ? { tunnel: true, sandisk: body.sandisk === true, probe: 'ok' } : offline('bad_response');
}

async function readProbe(env: TunnelEnv, nonce: string, signal: AbortSignal): Promise<ProbeResult> {
  const response = await env.MINI_HELLO!.fetch(new Request('http://127.0.0.1:18746/hello', {
    headers: { authorization: `Bearer ${env.MINI_PROBE_SECRET}`, 'x-probe-nonce': nonce },
    redirect: 'manual', signal,
  }));
  const failed = classifyStatus(response.status);
  if (failed) return offline(failed);
  try {
    return classifyBody(await response.json() as Record<string, unknown>, nonce);
  } catch {
    return offline('bad_response');
  }
}

// Fixed target: no caller-controlled URL, path, headers or redirects.
// budgetMs stays at 3s in production. Callers must not take it from a request.
export async function miniStatus(env: TunnelEnv, budgetMs = 3000): Promise<ProbeResult> {
  if (!env.MINI_HELLO || !env.MINI_PROBE_SECRET) return offline('unconfigured');
  const nonce = crypto.randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), budgetMs);
  try {
    return await readProbe(env, nonce, controller.signal);
  } catch {
    return offline(controller.signal.aborted ? 'timeout' : 'unreachable');
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeMini(env: TunnelEnv): Promise<boolean> {
  return (await miniStatus(env)).tunnel;
}
