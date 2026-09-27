# Deploy the `primsdrive-cloud` Worker

Edge stub only. Deploy does not create DNS, open a tunnel, or read Sandisk. Hostname attachment is [docs/dns-handoff.md](dns-handoff.md).

## Account

| | |
|---|---|
| Cloudflare account | Eidos AGI |
| Account id | `3c1d42c77978e6af0e458b6f1130c01b` (from `primfoundation/prims-sso` `wrangler.toml`; not invented here) |
| Worker name | `primsdrive-cloud` |
| Config | `wrangler.toml` |
| Compatibility date | `2026-09-06` (same date as `prims-browsers` `cloud/apps/gateway`) |

No Worker secrets. Do not add `CLOUDFLARE_API_TOKEN` to the repo.

## Local check (no Cloudflare credentials)

```bash
npm ci --ignore-scripts
npm test
npx wrangler deploy --dry-run
```

`wrangler deploy --dry-run` builds the Worker and prints the upload. It does not deploy and does not change DNS. CI runs the same command via `npm run verify`.

## Real deploy

Needs a Cloudflare API token for the Eidos AGI account with **Workers Scripts: Edit**. DNS edit permission is not required and should not be added for this step.

```bash
npx wrangler deploy
```

That publishes Worker `primsdrive-cloud` on `workers.dev` (`workers_dev = true`, same as `prims-sso` and the browsers preview Workers). It does **not** create `drive.prims.sh`. Stop here and hand DNS to EidosDNS.

There is no `account_id` to fill in. It is already set in `wrangler.toml`. If the token is for a different account, the deploy fails. Do not substitute another account id.

## Routes (later, after EidosDNS)

After the proxied hostname exists, a person may attach it. That step is not part of agent deploy. Example once DNS is in place:

```toml
[[routes]]
pattern = "drive.prims.sh"
custom_domain = true
zone_name = "prims.sh"
```

Adding that block makes a later `wrangler deploy` bind the hostname. Leave it out until EidosDNS has created the record and a person intends to attach it.
