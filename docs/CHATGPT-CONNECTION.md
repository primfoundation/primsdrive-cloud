# First-class ChatGPT PrimsDrive connection

Daniel's explicit finish line (2026-09-27): ChatGPT can use PrimsDrive directly
as an installed plugin/connection. A Worker health probe or generic MCP curl is
not completion. Fleet remains a maintenance tool, not ChatGPT's data interface.

## Target experience

Connect **PrimsDrive** at `https://drive.prims.sh/mcp`, sign in with the existing
Prims account, approve scoped access, then invoke its tools directly in ChatGPT.
No copied API key, laptop relay, duplicated Prim store, or another identity king.
The mini and Sandisk remain the source; Cloudflare remains the public edge.

## Actual gap discovered

OpenAI's current authenticated plugin contract is OAuth 2.1, authorization code
with S256 PKCE, protected-resource discovery, authorization-server metadata, and
tokens bound to the resource and scopes. A manually minted `agt_...` bearer can
serve non-ChatGPT agent clients but does **not** satisfy ChatGPT connection setup.
The current Prims SSO issuer has agent-token APIs but no completed OAuth provider.
[prims-sso#12](https://github.com/primfoundation/prims-sso/pull/12) is merged as
`938c98f0fdc26d43d96f9def2499413f91a6b61f`. It carries the #11 consent adapter and
maps ChatGPT and Grok onto existing Prims accounts. It is not deployed.
`CONNECTED_APPS_ENABLED` is unset. `login.prims.sh` answers authorization-server
discovery with `503` `issuer_not_hosted_here` and does not publish an issuer.
Plugin directory lookup returned no existing PrimsDrive plugin to install.

This elevates prims-sso#2 from a browser-only dependency to a **ChatGPT/MCP release
blocker**. Keep the existing Prims/Stytch identity plane; do not solve it with public/no-auth
MCP, hard-coded credentials, or a second OAuth database in Drive.

## Resource-server candidate

- `/.well-known/oauth-protected-resource` and
  `/.well-known/oauth-protected-resource/mcp` (MCP clients probe the path form
  first): resource `https://drive.prims.sh`, issuer from `MCP_OAUTH_ISSUER`,
  scopes `primsdrive.read` and `primsdrive.write`. The issuer string is the
  HTTPS `issuer` from the existing Stytch project's custom-domain metadata.
  `login.prims.sh` is the consent façade, not that issuer.
- Discovery returns 503 until `MCP_OAUTH_ENABLED=true` and that verified issuer
  are both configured. Leave the flag unset. `938c98f0` being merged does not
  make the issuer live.
- In OAuth mode, `/mcp` additionally requires introspection to report exact
  `resource=https://drive.prims.sh` and an appropriate space-delimited `scope`.
  Existing account-profile and live SSO policy restrictions still apply.
- Invalid/missing authentication gets a 401 `WWW-Authenticate` challenge pointing
  to resource metadata. Tool descriptors declare required OAuth scopes.
- Insufficient OAuth scope in a tool result returns `_meta.mcp/www_authenticate`
  with the required scope so ChatGPT can request reauthorization.
- Existing opaque `agt_...` token storage can remain at SSO, but OAuth issuance
  must bind tokens to the grant, client, resource, scopes, and user-approved agent.
  Existing unbound manual tokens are rejected by OAuth-mode MCP.
  Stytch Connected Apps emits its own OAuth tokens: the current `agt_`-only
  validator is a candidate contract, not an implemented Stytch JWT integration.

## Upstream SSO work and gates

1. Implement/discover authorization server metadata, authorize, token, consent,
   refresh and revocation using the existing Prims/Stytch identity plane.
2. Authorization-code flow with single-use expiring codes, S256 PKCE, exact
   redirect matching, resource binding, scope checks, and CSRF/login-state checks.
3. Support OpenAI client registration/identification (prefer CIMD when supported).
   Copy the **actual** callback and client metadata document from the ChatGPT
   connection management screen. Do not invent callback IDs or broad wildcards.
   Publish RFC 9207 issuer support if choosing stable callback behavior.
4. Keep token validation and revocation at the issuer. Introspection must expose
   `active`, `agent_id`, `account_id`, `resource`, `scope`, and expiry.
5. Exercise full OAuth with MCP Inspector, wrong-audience/scope, expired/replayed
   codes, invalid PKCE/redirects, refresh and revocation before enabling discovery.
6. Add the real ChatGPT connection and complete its interactive Prims sign-in.
   Installation/authentication may need Daniel's native consent interaction;
   do not claim that a source manifest installs the plugin.

## ChatGPT acceptance (must be performed from the installed tools)

- Discover the PrimsDrive tools from ChatGPT.
- List an authorized real profile and read one agreed test object.
- Create a unique canary, read back the exact bytes, update conditionally, read
  again, delete it, and verify absence on the Sandisk king.
- Deny an unauthorized profile; verify the token cannot grant HTML access.
- Revoke the connection's token; the next tool call must fail and support relink.
- Make the mini unavailable briefly; show an honest availability error and recover.

No real customer pack edits are necessary for acceptance. Record tool receipts,
commit/deployment identifiers, profile assignment and cleanup, without tokens.

Official references checked 2026-09-27:
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/build/mcp-server
- https://learn.chatgpt.com/docs/extend/mcp

## 2026-09-28 OAuth adapter follow-through

Drive now routes provider-form bearer tokens on OAuth-mode MCP to SSO
`/v1/oauth/introspect`. Legacy REST retains its `agt_` contract. SSO checks
Stytch online on every call, validates issuer/client/access-token type/expiry/
audience/scopes, then resolves an existing account and explicit agent assignment.
No account, agent, token issuer, or profile grant is auto-created.

Live inspection receipt `028a8048b2a96532009aaf3e0b41f6dfba40ab004b02002852281f652182087a`
found only six earlier test accounts and six test agents in Prims SSO D1. None
was Daniel's real account. The public SSO health still reports Stytch `test`.
Do not assign real Sandisk profiles to those fixture identities.

Fleet browser documentation reported `scope_required` for browser-read and
browser-control on the current connector token. Opera requires reauthentication.
The cloud Stytch dashboard is at sign-in. These are access/configuration gates,
not disk permission failures. Actual ChatGPT installation and live OAuth
refresh/revocation remain unverified. Keep activation flags disabled until the
existing Stytch project is configured and Daniel signs in with his real identity.

## Next deploy — OAuth `/mcp` stays off

Do not set `MCP_OAUTH_ENABLED` or `MCP_OAUTH_ISSUER` in this deploy. Merged
prims-sso `938c98f0` is the consent and introspection façade, and it is not
deployed either. ChatGPT is not an installed connection. Follow
`docs/CONNECTED-APPS.md` in prims-sso at that commit. Drive does not mint an issuer.

Deploy this Worker with the existing Cloudflare MCP plane on Eidos AGI account
`3c1d42c77978e6af0e458b6f1130c01b`. Preserve hostname `drive.prims.sh`, VPC
binding `MINI_HELLO` (`01a0e621-4249-7040-9f18-5a3cc637c652`), secret
`MINI_PROBE_SECRET`, and service binding `PRIMS_SSO` → `prims-sso`. Do not add
`[[routes]]`, another tunnel, or a DNS change. Do not rotate the probe secret.
`wrangler deploy` publishes the script only.

What that deploy changes while OAuth is off:

1. `GET /health` gains `probe` and still reports `tunnel` from the 3s hello.
2. `GET` and `POST /mcp`, and `/v1/*`, return `401` `agent_bearer_required`
   with no `WWW-Authenticate` header. Anonymous MCP is closed. The live
   placeholder `/mcp` goes away in this deploy; it does not become a public tool
   surface.
3. `GET /.well-known/oauth-protected-resource` and
   `GET /.well-known/oauth-protected-resource/mcp` return `503`
   `oauth_provider_not_ready`. Clients that connect to `/mcp` try the path
   well-known URI first, then the root. Both serve the same document only after
   the flag and a verified HTTPS issuer are set together.
4. Bearer `agt_` calls still need live SSO introspection plus an operator
   `DRIVE_ACCOUNT_PROFILES` grant. Leave that grant empty until the account is
   a real Prims account. Fixture SSO accounts must not receive Sandisk profiles.

Enable OAuth mode only after the prims-sso checklist at `938c98f0` has been
executed against the existing Stytch project. In order:

1. Deploy the merged SSO façade with `CONNECTED_APPS_ENABLED` still unset.
   `GET https://login.prims.sh/health` has been reporting Stytch `test`. Record
   the project actually in use. `login.prims.sh` must keep answering
   `/.well-known/oauth-authorization-server` with `issuer_not_hosted_here`.
2. On that Stytch project, set the authorization URL to
   `https://login.prims.sh/oauth/authorize`, scopes `primsdrive.read`,
   `primsdrive.write`, and `offline_access` (refresh lives on Stytch). Give it
   an HTTPS custom domain that is neither `login.prims.sh` nor `drive.prims.sh`.
3. Fetch `https://{that-domain}/.well-known/oauth-authorization-server`. Copy
   `issuer` (this becomes `OAUTH_ISSUER` and Drive `MCP_OAUTH_ISSUER`), and
   confirm S256, authorization-code, refresh-token, and
   `authorization_endpoint` `https://login.prims.sh/oauth/authorize`. The legacy
   `stytch.com/{project_id}` issuer is not an HTTPS URL ChatGPT will accept.
4. Register the real ChatGPT client metadata URL and redirect from the ChatGPT
   connection screen for `https://drive.prims.sh/mcp`. Repeat from Grok's own
   screen. Audience for access tokens must include `https://drive.prims.sh`.
   Drive rejects a project-only audience.
5. After a real passkey sign-in, bind one existing agent per client in
   `OAUTH_AGENT_BINDINGS`. Confirm deployed `POST /v1/oauth/introspect` returns
   `active`, `agent_id`, `account_id`, `resource` `https://drive.prims.sh`, and
   `scope`, and returns `401` after revocation.
6. Set Drive `MCP_OAUTH_ISSUER` to that same issuer and `MCP_OAUTH_ENABLED=true`
   together. Unauthenticated `POST /mcp` then returns `401` with
   `WWW-Authenticate: Bearer resource_metadata="https://drive.prims.sh/.well-known/oauth-protected-resource", scope="primsdrive.read primsdrive.write"`.
7. Run the ChatGPT acceptance list in this document, including canary cleanup on
   `/Volumes/Sandisk2TB/Prims`. Until that list has receipts, the endpoint is a
   gated candidate for both ChatGPT and Grok Bot at `https://drive.prims.sh/mcp`.

Grok Bot can use the bearer `agt_` surface once a real profile grant exists.
OAuth for Grok uses the same resource server and a separate Connected App
binding from the SSO checklist. Neither path is anonymous.
