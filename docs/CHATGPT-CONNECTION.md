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
SSO PR [#11](https://github.com/primfoundation/prims-sso/pull/11) now supplies a
tested, disabled-by-default passkey continuation and Connected Apps consent
adapter. It is not deployed and does not yet been activated for OAuth token introspection.
Plugin directory lookup returned no existing PrimsDrive plugin to install.

This elevates prims-sso#2 from a browser-only dependency to a **ChatGPT/MCP release
blocker**. Keep the existing Prims/Stytch identity plane; do not solve it with public/no-auth
MCP, hard-coded credentials, or a second OAuth database in Drive.

## Resource-server candidate

- `/.well-known/oauth-protected-resource`: resource `https://drive.prims.sh`,
  issuer from `MCP_OAUTH_ISSUER`, scopes `primsdrive.read`, `primsdrive.write`.
  Configure the issuer only from the existing Stytch project's verified metadata.
  `login.prims.sh` is the login facade; do not assume it is the signed token issuer.
- Discovery returns 503 until `MCP_OAUTH_ENABLED=true` and a valid HTTPS issuer
  are configured. The enable flag must remain unset
  until the actual provider contract is deployed and tested.
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
