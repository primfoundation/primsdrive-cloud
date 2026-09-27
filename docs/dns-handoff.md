# DNS handoff — `drive.prims.sh`

**Do not apply this change from an agent.** Do not call the Cloudflare DNS API, `wrangler` route or custom-domain flags, Terraform, or the dashboard in a way that creates or edits records. This file is the handoff for **EidosDNS** and the **Prims registry**.

`wrangler.toml` intentionally has no `[[routes]]` and no `custom_domain`. `npx wrangler deploy` publishes the Worker only. It does not attach `drive.prims.sh`.

## Zone

`prims.sh` is already on Cloudflare.

| | |
|---|---|
| Nameservers | `scott.ns.cloudflare.com`, `carrera.ns.cloudflare.com` |
| Account | Eidos AGI, account id `3c1d42c77978e6af0e458b6f1130c01b` |
| Source of account id | [`primfoundation/prims-sso` `wrangler.toml`](https://github.com/primfoundation/prims-sso/blob/main/wrangler.toml) and that repo's README ("account that owns zone prims.sh") |
| Worker name | `primsdrive-cloud` (this repo) |

Same account and zone as `login.prims.sh`. Do not create a second Cloudflare account for this hostname.

## Record EidosDNS must create

| Hostname | Type | Proxy | Points at |
|---|---|---|---|
| `drive.prims.sh` | CNAME (Worker custom domain) | **Proxied** (orange cloud) | Worker `primsdrive-cloud` |

Preferred action, matching `login.prims.sh`: add custom domain `drive.prims.sh` on Worker `primsdrive-cloud` in the Eidos AGI account. Cloudflare then creates the proxied record in zone `prims.sh`.

If the record is entered by hand instead:

- Type **CNAME**, name `drive`, **proxied**.
- Target is the Worker hostname on this account (`primsdrive-cloud.<workers-subdomain>.workers.dev`). The workers.dev subdomain is account-specific and is not stored in this repo. Read it from the Cloudflare Workers overview. Do not invent it.
- TTL **Auto**.

**Proxied, not DNS-only.** `browsers.prims.sh` and `login.prims.sh` are proxied on this zone. On 2026-09-27 public resolvers returned Cloudflare anycast `A` records `104.21.63.101` and `172.67.170.139` for both names (the CNAME is hidden because the proxy is on). `drive.prims.sh` must behave the same way. Those addresses are a snapshot of Cloudflare anycast, not a record to copy. Do not publish an `A`/`AAAA` to the Mac mini, Sandisk, a tunnel, or any origin IP. This slice has no origin.

## Alias not in this handoff

Issue #1 allows an optional `drive.e1.eidosagi.com` alias "if needed". No current Prim Foundation doc requires it (architecture README, infra inventory, and `prims-sso` do not). **Do not create `drive.e1.eidosagi.com` for this slice.**

## After the record exists

A person with the Eidos AGI account confirms the front door. Agents still do not edit DNS.

1. `dig drive.prims.sh` returns Cloudflare anycast addresses, the same proxied shape as `browsers.prims.sh`.
2. Worker `primsdrive-cloud` is attached to `drive.prims.sh` (the custom domain from the table above, or route `drive.prims.sh/*` on zone `prims.sh`).
3. `curl -fsS https://drive.prims.sh/health` returns the health JSON in the README. `curl -fsS https://drive.prims.sh/v1/packs` returns the `/v1/*` placeholder. Neither call reaches Sandisk.

## Out of scope

Origin tunnel, Mac mini, and Sandisk stay on issues #2 and #3. This record is TLS at Cloudflare only.
