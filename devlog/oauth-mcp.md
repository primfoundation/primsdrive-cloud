## 2026-10-03T21:25:00Z OAuth discovery path

- **What changed:** Protected-resource metadata is served at both `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp`. Both stay `503` until `MCP_OAUTH_ENABLED=true` and `MCP_OAUTH_ISSUER` is a valid HTTPS issuer. The 401 challenge used when that flag is on includes the read and write scopes. Deploy steps are in `docs/CHATGPT-CONNECTION.md`. The flag is not set in `wrangler.toml`.
- **Why:** MCP clients that connect to `https://drive.prims.sh/mcp` probe the path well-known URI first, then the root (MCP authorization spec, 2025-11-25). prims-sso#11 is still the issuer candidate and is not live. Advertising an issuer before that metadata is verified would point ChatGPT at a placeholder.
- **Supporting Research:** https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization — Protected Resource Metadata Discovery Requirements. primfoundation/prims-sso#12 merged `938c98f0fdc26d43d96f9def2499413f91a6b61f`, `docs/CONNECTED-APPS.md`: resource `https://drive.prims.sh`, scopes `primsdrive.read` and `primsdrive.write`, `login.prims.sh` discovery returns `issuer_not_hosted_here`, flags off.

- [x] Path and root metadata match when enabled
- [x] Metadata stays 503 while the flag is unset
- [x] Unauthenticated `/mcp` has no `WWW-Authenticate` header while OAuth is off
- [ ] Live issuer verified
- [ ] `MCP_OAUTH_ENABLED` turned on
- [ ] ChatGPT install acceptance
