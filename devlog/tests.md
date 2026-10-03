## 2026-10-03T21:45:00Z Tests

- **What changed:** `npm run verify` after the hello budget and OAuth discovery changes.
- **Why:** Confirm the wedged-disk hello, probe classification, gated `/mcp`, and Wrangler bundle before opening the PR.
- **Supporting Research:** Typecheck passed. Node tests 20 passed. Python mini tests 10 passed. Installer tests 2 passed. `wrangler deploy --dry-run` (4.142.0) uploaded 24.85 KiB with `MINI_HELLO` and `PRIMS_SSO` only. No `MCP_OAUTH_ENABLED` binding.

## 2026-09-27T23:55:00Z Tests

- **What changed:** `npm test` (4 contract tests) and `npx wrangler deploy --dry-run` (wrangler 4.142.0).
- **Why:** Prove the health JSON, 405 on non-GET `/health`, `/v1/*` and `/mcp` placeholders, and that nearby paths 404. Dry-run confirms the Worker bundles without Cloudflare credentials and without a route that would write DNS.
- **Supporting Research:** Local result: 4 passed, 0 failed. Dry-run upload 2.19 KiB, no bindings, then `--dry-run: exiting now.` No account token in the environment. `wrangler dev` on 127.0.0.1:8787 returned the same JSON for `/`, `/health`, `/v1/packs`, and `/mcp`, 405 for `POST /health`, and 404 for `/mcp/tools`.
