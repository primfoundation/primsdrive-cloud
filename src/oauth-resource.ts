import { json } from './responses.ts';
export const RESOURCE = 'https://drive.prims.sh';
export const RESOURCE_METADATA = RESOURCE + '/.well-known/oauth-protected-resource';
export const OAUTH_SCOPES = ['primsdrive.read', 'primsdrive.write'];
export const challenge = `Bearer resource_metadata="${RESOURCE_METADATA}"`;
export function resourceMetadata(enabled: boolean): Response {
  if (!enabled) return json({ error: 'oauth_provider_not_ready' }, 503);
  return json({resource:RESOURCE,authorization_servers:['https://login.prims.sh'],scopes_supported:OAUTH_SCOPES,
    bearer_methods_supported:['header'],resource_name:'PrimsDrive'},200);
}
