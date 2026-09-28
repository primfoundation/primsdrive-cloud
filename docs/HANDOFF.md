# Project continuation — 2026-09-27 CT

Daniel authorized completing the project and publishing changes. #2 is merged in PR #9 and live. Start from [PROJECT-PLAN.md](PROJECT-PLAN.md) for the full inventory, candidate code, actual blockers, and acceptance gates. #3–#7 are not complete or deployed. The original handoff follows for history.

2026-09-28 UTC continuation: Drive PR #10 adds explicit verified OAuth issuer
configuration and ChatGPT reauthorization metadata. The existing SSO's gated
Connected Apps consent adapter is in `primfoundation/prims-sso#11`. Neither is
deployed. Remote disk checks are attributed to the SSH process by macOS TCC;
the pack LaunchAgent's access remains unverified. See the plan for receipts and
remaining Stytch configuration/introspection and real ChatGPT acceptance gates.

# Handoff — drive.prims.sh live stub (2026-09-27)

**Issue #2 continuation (2026-09-27 CT):** Private Tunnel + VPC hello is now installed. See [mini-tunnel.md](mini-tunnel.md) for resources, security model, verification and rollback. Health now checks the mini live; `tunnel` can be true while `sandisk` remains false. The original stub handoff below is retained as historical context. Next implementation slice is #3.

**Audience:** whoever continues `primfoundation/primsdrive-cloud` past the health stub (ChatGPT prims project, coding agents, PrimsDrive).

**Pull this commit** and start from here. Do not reinvent DNS, deploy, or a parallel data king.

## What is live right now

| Check | Result |
|-------|--------|
| `https://drive.prims.sh/health` | HTTP 200 stub JSON |
| `https://drive.prims.sh/` | same health JSON |
| `https://primsdrive-cloud.eidos-agi.workers.dev/health` | HTTP 200 |
| `/v1/*`, `/mcp` | HTTP 200 placeholders `{implemented:false}` |
| Sandisk / tunnel | **false** — not wired |

Example `/health` body:

```json
{
  "ok": true,
  "service": "primsdrive-cloud",
  "status": "stub",
  "host": "drive.prims.sh",
  "sandisk": false,
  "tunnel": false,
  "routes": {
    "/": "health",
    "/health": "health",
    "/v1/*": "placeholder",
    "/mcp": "placeholder"
  }
}
```

Proved again 2026-09-27 ~22:40 CT after Goal `449b44e9` closed.

## Plane (locked)

| | |
|---|---|
| Repo | `primfoundation/primsdrive-cloud` |
| Worker name | `primsdrive-cloud` |
| Cloudflare account | Eidos AGI `3c1d42c77978e6af0e458b6f1130c01b` |
| Zone | `prims.sh` |
| Public host | `drive.prims.sh` (Workers custom domain on this Worker) |
| workers.dev | `primsdrive-cloud.eidos-agi.workers.dev` |
| King data | `daniels-mac-mini:/Volumes/Sandisk2TB/Prims` only |
| Everyday Mac path | File Provider Locations `~/Library/CloudStorage/PrimsDrive-PrimsDrive` |
| Owner bot | PrimsDrive |
| Mac File Provider app | `primfoundation/primsdrive` (separate repo) |

Spelling: **PrimsDrive** / `primsdrive` (with the **s**).

## How the stub went live (do not redo)

1. Worker module uploaded via **Cloudflare MCP** (`user-Cloudflare MCP-xai`) on the Eidos AGI account — preferred plane for this Worker going forward.
2. `workers.dev` subdomain enabled.
3. A proxied CNAME `drive` → `primsdrive-cloud.eidos-agi.workers.dev` blocked Workers Domains attach; that CNAME was **deleted**, then Workers Domains attached `drive.prims.sh` to Worker `primsdrive-cloud`.
4. Fort Knox vault `eidosagi-workers-edit` and Hancock wrangler request `req_1790552619cfff93862ebd` were **not** the path that worked; Hancock was superseded after MCP deploy. Prefer Cloudflare MCP over Fort Knox / Hancock for this Worker plane unless Daniel says otherwise.

Deploy procedure docs: [deploy.md](deploy.md). Historical DNS instructions: [dns-handoff.md](dns-handoff.md) — **hostname is already attached**; do not ask EidosDNS to create it again.

## What this stub is *not*

- Not product API, not MCP tools, not a marketing site, not Sandisk access.
- No second copy of Prim packs on R2 / HostKey as source of truth.
- No Muse hourly outbox as reliability theater.

## What to do next (ordered)

Workstreams already filed — continue in issue order, do not invent parallel tracks:

1. **[#2 mTLS tunnel Cloudflare → Mac mini](https://github.com/primfoundation/primsdrive-cloud/issues/2)** — origin never public; Cloudflare → mini only.
2. **[#3 Mini worker: serve Prim packs from Sandisk](https://github.com/primfoundation/primsdrive-cloud/issues/3)** — read king only at `/Volumes/Sandisk2TB/Prims`.
3. **[#4 Agent API keys + /v1 pack CRUD](https://github.com/primfoundation/primsdrive-cloud/issues/4)** — CF-issued bearer keys; never authorize HTML with bearer, never authorize `/v1` with session cookie.
4. **[#5 /mcp endpoint for agents](https://github.com/primfoundation/primsdrive-cloud/issues/5)** — same auth surface as `/v1`.
5. **[#6 Human web login with Prims account](https://github.com/primfoundation/primsdrive-cloud/issues/6)** — registry.prims.sh identity; CF Access / Prims IdP.
6. **[#7 Web UI pack browser](https://github.com/primfoundation/primsdrive-cloud/issues/7)** — pack browser + health (king_ack / mini).

**Immediate product ask after this handoff:** pick up **#2** (tunnel) unless Daniel names a different next slice. A human marketing page on `/` can wait until auth + pack browse exist; keep `/` as health until then unless Daniel asks for a landing page first.

## Prove bar before calling anything “done”

- `curl -fsS https://drive.prims.sh/health` stays stub-shaped until Sandisk is wired (`sandisk`/`tunnel` flip only when true).
- After #2/#3: health must reflect real king reachability; a green `/health` with `sandisk:false` is still stub.
- After #4: `/v1/packs` must stop returning `{implemented:false}` and require a bearer key.

## Related open work (PrimsDrive Mac plane — not this repo)

Leave these on PrimsDrive / `primfoundation/primsdrive` unless asked:

- Overnight Locations soak morning check
- Connector v1.1 Tailscale HTTP MCP for box Grok Bot
- Finder Keep Downloaded stamp (Daniel)
- Search-on-MCP idea parked until connector surface is solid

## Contacts / bots

| Role | Who |
|------|-----|
| Drive volume + this edge | PrimsDrive |
| Prims product / registry | Prims |
| DNS on prims.sh | EidosDNS (hostname already done for drive) |
| Mac mini access | RentAMacBot / Reeves lane |
| Cloudflare deploy plane | Cloudflare MCP on Eidos AGI (preferred) |

---

**One-liner for the next agent:** `drive.prims.sh` is a live Cloudflare Worker stub on Eidos AGI; pull this commit, then implement issue **#2** (mTLS to mini) without touching DNS or inventing a second king.
