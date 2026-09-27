## 2026-09-27T23:45:00Z Dependencies

- **What changed:** Dev dependencies `wrangler@4.142.0`, `typescript@5.9.2`, `@types/node@22.18.0`. No runtime dependencies.
- **Why:** Issue #1 needs `wrangler deploy --dry-run`. Wrangler is the Cloudflare CLI (well above 1,000 GitHub stars) and is already used by `prims-sso` and `prims-browsers` `cloud/`. TypeScript and `@types/node` match the browsers cloud package so `tsc` and `node --experimental-strip-types` can typecheck the Worker without a bundler. No existing package in this repo could do that; the repo had no `package.json`.
- **Supporting Research:** npm `wrangler` 4.142.0 (latest 4.x on 2026-09-27). Sibling pins: `prims-sso` wrangler `^4.141.0`, `prims-browsers` cloud wrangler `4.129.0`.
