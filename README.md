# primsdrive-cloud

Plan and implementation home for **[drive.prims.sh](https://drive.prims.sh)** — the cloud edge that lets any AI agent (and a human web UI) reach Prim packs.

**Spelling:** always **PrimsDrive** / `primsdrive` (with the **s**).

**Do not invent a parallel king.** The only data store is Sandisk on the Mac mini:

| Layer | Where | Role |
|-------|--------|------|
| **King** | `daniels-mac-mini` → `/Volumes/Sandisk2TB/Prims` | Authoritative Prim packs |
| **Edge** | Cloudflare (`drive.prims.sh`) | Public HTTPS, auth, TLS |
| **Tunnel** | mTLS Cloudflare → mini | Origin never exposed raw |
| **Everyday Mac** | File Provider Locations `~/Library/CloudStorage/PrimsDrive-PrimsDrive` | Local human path (unchanged) |

This repo is the **cloud service plan**. Mac File Provider app stays in [primfoundation/primsdrive](https://github.com/primfoundation/primsdrive). HostKey / paseo-prims may *build* here; they are not the data path.

**Live handoff (start here):** [docs/HANDOFF.md](docs/HANDOFF.md).

## Architecture (target)

```
Agent / Muse / browser
        │
        ▼
 Cloudflare (drive.prims.sh)
   ├─ /v1/*     agent bearer API keys (CF-issued, rotatable)
   ├─ /mcp      MCP over the same API surface
   ├─ /         human web UI (Prims account session)
   └─ mTLS ──► Mac mini worker ──► Sandisk /Volumes/Sandisk2TB/Prims
```

## Auth (four surfaces)

1. **Agent API keys** — Cloudflare-issued per-agent bearer tokens for `/v1` and `/mcp`. Scoped, rotatable, revocable at CF.
2. **mTLS Cloudflare → mini** — origin only accepts Cloudflare; mini never public.
3. **Key rotation / revocation** — CF is source of truth; revoke kills API+MCP immediately.
4. **Human website** — browser login with a **Prims account** (registry.prims.sh identity). Prefer Cloudflare Access + Prims IdP (or a small CF Worker login). Session cookie / CF Access JWT on HTML routes only — **never** authorizes `/v1` or `/mcp`. Bearer keys **never** authorize the HTML app.

Web UI (first slice): pack browser, health (king_ack / mini status), optional agent key mint/list/revoke.

## Non-goals (for now)

- No second copy of Prim packs as source of truth on HostKey or Cloudflare R2.
- No Muse hourly outbox as reliability theater.
- No application code until workstream issues are sequenced and approved.

## Workstreams

1. [#1 Cloudflare edge + DNS for drive.prims.sh](https://github.com/primfoundation/primsdrive-cloud/issues/1) — **done (stub live)**
2. [#2 mTLS tunnel Cloudflare → Mac mini](https://github.com/primfoundation/primsdrive-cloud/issues/2) — **private hello implemented; see [evidence](docs/mini-tunnel.md)**
3. [#3 Mini worker: serve Prim packs from Sandisk](https://github.com/primfoundation/primsdrive-cloud/issues/3)
4. [#4 Agent API keys + /v1 pack CRUD](https://github.com/primfoundation/primsdrive-cloud/issues/4)
5. [#5 /mcp endpoint for agents](https://github.com/primfoundation/primsdrive-cloud/issues/5)
6. [#6 Human web login with Prims account](https://github.com/primfoundation/primsdrive-cloud/issues/6)
7. [#7 Web UI pack browser](https://github.com/primfoundation/primsdrive-cloud/issues/7)

## Edge stub ([#1](https://github.com/primfoundation/primsdrive-cloud/issues/1))

Worker `primsdrive-cloud` is the public front door. `GET /` and `GET /health` return the health JSON below, including the private hello `probe` code. `/v1/*` and `/mcp` require an agent bearer and answer `401` with no token. There is no public unauthenticated MCP. OAuth discovery stays `503` until the gates in [docs/CHATGPT-CONNECTION.md](docs/CHATGPT-CONNECTION.md) are met. The Worker probes a private hello endpoint through its VPC service binding; it does not read Sandisk. `tunnel` is true only when that hello returns the expected proof inside 3 seconds.

Deploy checks: [docs/deploy.md](docs/deploy.md). DNS / hostname attachment history: [docs/dns-handoff.md](docs/dns-handoff.md). **Live continuation brief:** [docs/HANDOFF.md](docs/HANDOFF.md).

`GET /health` (and `GET /`) on this candidate. The sample below is a timed-out probe. A hello that matches sets `probe` to `ok` and `tunnel` to true; `status` is `storage-ready` when `sandisk` is true. The deployed health-only worker does not include `probe` yet.

```json
{
  "ok": true,
  "service": "primsdrive-cloud",
  "status": "stub",
  "host": "drive.prims.sh",
  "sandisk": false,
  "tunnel": false,
  "probe": "timeout",
  "routes": {
    "/": "health",
    "/health": "health",
    "/v1/*": "agent-api",
    "/mcp": "mcp"
  }
}
```

`probe` is `ok` when hello matches, and otherwise one of `unconfigured`, `timeout`, `unauthorized`, `rejected`, `redirect`, `bad_response`, or `unreachable`. It carries no secret, nonce, or upstream body.

## Status

**Live health is storage-ready again.** Worker `a4b6a971-0ab5-44af-8744-493e4ccffb8b` still serves it. On 2026-10-03 the public document returned `tunnel:true`, `sandisk:true`, `status:storage-ready` in a few hundred milliseconds after the mini hello job was pointed through local `ssh -o BatchMode=yes`. The earlier `tunnel:false` was PrimsDrive Server.app blocking in `openat` on `/Volumes/Sandisk2TB` when LaunchAgent ran it directly. `/mcp` on that deployment is still the public placeholder. This branch gates `/mcp` and does not enable OAuth. ChatGPT is not installed. See [docs/mini-tunnel.md](docs/mini-tunnel.md), [docs/HANDOFF.md](docs/HANDOFF.md), and [docs/CHATGPT-CONNECTION.md](docs/CHATGPT-CONNECTION.md).
