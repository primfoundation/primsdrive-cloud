import { ApiError, component, objectPath, mini, type AgentEnv } from './agent.ts';
export interface HumanEnv extends AgentEnv {
  ACCESS_ISSUER?: string;
  ACCESS_AUD?: string;
  // Verified Access subject -> exact profile directories. Operator-owned grants.
  DRIVE_HUMAN_PROFILES?: string;
}
function decode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('Invalid JWT');
  return Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}
export async function verifyHuman(request: Request, env: HumanEnv, fetchKeys: typeof fetch = fetch): Promise<{ sub: string; profiles: string[] }> {
  if (!env.ACCESS_ISSUER || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER) || !env.ACCESS_AUD) throw new ApiError(503, 'human_login_not_configured');
  // Access adds this header; it still must be cryptographically verified.
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || token.length > 16384) throw new ApiError(401, 'human_session_required');
  try {
    const pieces = token.split('.'); if (pieces.length !== 3) throw new Error();
    const header = JSON.parse(new TextDecoder().decode(decode(pieces[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(pieces[1])));
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error();
    const now = Math.floor(Date.now() / 1000);
    if (claims.iss !== env.ACCESS_ISSUER || !Array.isArray(claims.aud) || !claims.aud.includes(env.ACCESS_AUD)
      || typeof claims.exp !== 'number' || claims.exp <= now || typeof claims.nbf !== 'number' || claims.nbf > now
      || typeof claims.sub !== 'string' || !claims.sub || typeof claims.email !== 'string') throw new Error();
    const response = await fetchKeys(env.ACCESS_ISSUER + '/cdn-cgi/access/certs', { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    if (response.status !== 200) throw new Error();
    const jwks = await response.json() as { keys: (JsonWebKey & { kid?: string })[] };
    const jwk = jwks.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256'));
    if (!jwk) throw new Error();
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(pieces[2]) as BufferSource, new TextEncoder().encode(pieces[0]+'.'+pieces[1]))) throw new Error();
    const map = JSON.parse(env.DRIVE_HUMAN_PROFILES ?? '{}') as Record<string, unknown>;
    const profiles = map[claims.sub];
    if (!Array.isArray(profiles) || !profiles.length || !profiles.every(component)) throw new ApiError(403, 'human_not_assigned');
    return { sub: claims.sub, profiles };
  } catch (e) { if (e instanceof ApiError) throw e; throw new ApiError(401, 'invalid_human_session'); }
}
export const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function page(profiles: string[], profile: string, path: string, listing: {entries: {name:string;kind:string;size:number}[]; next_offset:number|null}, health: Record<string, unknown>): Response {
  const link = (p: string, dir: string, offset?: number) => '/app?' + new URLSearchParams({profile:p,path:dir,...(offset === undefined ? {} : {offset:String(offset)})});
  const rows = listing.entries.map(e => `<tr><td>${e.kind==='directory'?`<a href="${escapeHtml(link(profile,path?path+'/'+e.name:e.name))}">${escapeHtml(e.name)}/</a>`:escapeHtml(e.name)}</td><td>${escapeHtml(e.kind)}</td><td>${Number(e.size).toLocaleString('en-US')} B</td></tr>`).join('');
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PrimsDrive</title><style>
+*{box-sizing:border-box}body{margin:0;background:#f5f3ed;color:#292923;font:16px system-ui,sans-serif}header,main{max-width:1120px;margin:auto;padding:32px}header{display:flex;justify-content:space-between;border-bottom:1px solid #d8d8cd}h1{font-size:36px;font-weight:500;letter-spacing:-1px}a{color:#36533c;text-underline-offset:4px}nav{display:flex;gap:24px;flex-wrap:wrap;margin:28px 0}.health{padding:20px;border:1px solid #d8d8cd;border-radius:8px}table{width:100%;border-collapse:collapse;background:#fffef9}th,td{text-align:left;padding:16px;border-bottom:1px solid #e8e6dc}th{font-size:12px;text-transform:uppercase;letter-spacing:1px}small{color:#6a6b60}.empty{padding:32px}button{font:inherit;padding:8px 14px;background:transparent;border:1px solid #aaa;border-radius:4px}@media(max-width:600px){header,main{padding:20px}td,th{padding:12px 8px}}
+</style><header><strong>PrimsDrive</strong><a href="/cdn-cgi/access/logout">Sign out</a></header><main><small>YOUR PRIM LIBRARY</small><h1>${escapeHtml(profile)}</h1><div class="health">${health.readable===true?'Sandisk connected':'Sandisk unavailable'} · ${typeof health.free_bytes==='number'?escapeHtml(Math.floor(health.free_bytes/1024**3))+' GiB free':'Free space unavailable'}</div><nav>${profiles.map(p=>`<a href="${escapeHtml(link(p,''))}">${escapeHtml(p)}</a>`).join('')}</nav><p>${path?`<a href="${escapeHtml(link(profile,path.split('/').slice(0,-1).join('/')))}">← Parent</a> · `:''}${escapeHtml(path||'/')}</p><table><thead><tr><th>Name</th><th>Type</th><th>Size</th></tr></thead><tbody>${rows}</tbody></table>${listing.entries.length?'':'<p class="empty">This folder is empty.</p>'}${listing.next_offset===null?'':`<p><a href="${escapeHtml(link(profile,path,listing.next_offset))}">Next page →</a></p>`}</main></html>`;
  return new Response(body.replace(/^\+/gm,''), { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store',
    'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'referrer-policy':'no-referrer','x-content-type-options':'nosniff' } });
}
export async function human(request: Request, env: HumanEnv): Promise<Response> {
  if (request.method !== 'GET') throw new ApiError(405, 'method_not_allowed');
  const identity = await verifyHuman(request, env);
  const url = new URL(request.url); const profile = url.searchParams.get('profile') ?? identity.profiles[0];
  const path = url.searchParams.get('path') ?? ''; const offset = Number(url.searchParams.get('offset') ?? 0);
  if (!identity.profiles.includes(profile)) throw new ApiError(403, 'profile_denied');
  if (!objectPath(path,true) || !Number.isSafeInteger(offset) || offset<0) throw new ApiError(400, 'invalid_path');
  const results = await Promise.all([mini(env,{op:'list',profile,path,offset}),mini(env,{op:'health'})]);
  if (results.some(r=>!r.ok)) throw new ApiError(503,'king_unavailable');
  return page(identity.profiles,profile,path,await results[0].json(),await results[1].json());
}
