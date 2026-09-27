## 2026-09-27T23:55:00Z Tests

- **What changed:** `npm test` (4 contract tests) and `npx wrangler deploy --dry-run` (wrangler 4.142.0).
- **Why:** Prove the health JSON, 405 on non-GET `/health`, `/v1/*` and `/mcp` placeholders, and that nearby paths 404. Dry-run confirms the Worker bundles without Cloudflare credentials and without a route that would write DNS.
- **Supporting Research:** Local result: 4 passed, 0 failed. Dry-run upload 2.19 KiB, no bindings, then `--dry-run: exiting now.` No account token in the environment. `wrangler dev` on 127.0.0.1:8787 returned the same JSON for `/`, `/health`, `/v1/packs`, and `/mcp`, 405 for `POST /health`, and 404 for `/mcp/tools`.
