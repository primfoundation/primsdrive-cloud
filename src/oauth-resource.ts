import { json } from './responses.ts';
export const RESOURCE = 'https://drive.prims.sh';
export const RESOURCE_METADATA = RESOURCE + '/.well-known/oauth-protected-resource';
export const OAUTH_SCOPES = ['primsdrive.read', 'primsdrive.write'];
export const challenge = `Bearer resource_metadata="${RESOURCE_METADATA}"`;
export const discoveryChallenge = `${challenge}, scope="${OAUTH_SCOPES.join(' ')}"`;
const METADATA_PATHS = new Set([
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/mcp',
]);

export function metadataPath(pathname: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return METADATA_PATHS.has(path);
}
export function resourceMetadata(enabled: boolean, issuer?: string): Response {
  if (!enabled || !issuer) return json({ error: 'oauth_provider_not_ready' }, 503);
  try {
    const url = new URL(issuer);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
  } catch { return json({error:'invalid_oauth_issuer'},503); }
  return json({resource:RESOURCE,authorization_servers:[issuer],scopes_supported:OAUTH_SCOPES,
    bearer_methods_supported:['header'],resource_name:'PrimsDrive'},200);
}
