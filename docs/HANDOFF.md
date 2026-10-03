# Current handoff — 2026-10-03

`tunnel:false` was a LaunchAgent TCC wedge, not a Worker header or probe-secret mismatch. PrimsDrive Server.app under `sh.prims.drive.hello` blocked forever in `openat` on `/Volumes/Sandisk2TB` inside `/hello` → `Store.directory()`. The Worker aborted that fetch at 3 seconds and reported `tunnel:false` / `sandisk:false`. The same binary, reached through `sshd`, returned `sandisk:true` in about 20ms.

Ops already changed the mini: `sh.prims.drive.hello` starts the server through `ssh -o BatchMode=yes` to `127.0.0.1`, so the open runs in the sshd context that can read the volume. Public health is storage-ready again (`tunnel:true`, `sandisk:true`, well under a second, checked 2026-10-03). Leave that job in place. Do not redo DNS. Do not rotate `MINI_PROBE_SECRET`. Do not create another tunnel or king.

`sandisk_probe` in `mini/server.py` is the server-side bound (1 second) so a future direct LaunchAgent exec of the binary cannot pin `/hello`. A stuck `openat` is not cancellable; the HTTP response still returns, `sandisk` stays false while that open is in flight, and a second hello does not start another open. The installed 0.1.2 binary does not contain this bound. Ship it only through the existing company-signed path in [MAC-SERVER.md](MAC-SERVER.md). Until that build is installed, keep the ssh wrapper.

Live Worker remains health-only `a4b6a971-0ab5-44af-8744-493e4ccffb8b`. Its `/mcp` is still the public placeholder. This candidate gates `/v1` and `/mcp` (401 with no bearer) and keeps `MCP_OAUTH_ENABLED` unset. Issuer work is prims-sso #12, merged as `938c98f0`, and is not deployed. ChatGPT is not installed. Next steps: [CHATGPT-CONNECTION.md](CHATGPT-CONNECTION.md).

# Current handoff — 2026-09-28

OAuth continuation: candidate Drive now accepts provider-form MCP credentials
through the existing SSO's online introspection adapter; REST retains agent tokens.
SSO candidate checks issuer, audience, expiry, client, scope and existing account/
agent ownership. Local validation: 30 SSO tests plus account-store test; 19 Drive,
5 filesystem and 2 installer tests; both typechecks and Drive dry-run passed.
These are candidate/fixture proofs, not live OAuth acceptance. Current live probe
receipt `a08b78ae7664fc37d38301f79f2223467d74ce02c35e2763fddee878d52ae060`
confirms storage-ready and `/mcp` still a placeholder. Read CHATGPT-CONNECTION.md
for remaining identity/provider/browser-scope gates. Never grant real profiles
to the existing fixture accounts or enable OAuth discovery before verification.

**Mini server 0.1.2 and private cloud health are working.** Company-signed,
notarized/stapled server is installed, real eidos-agi profile CRUD/cleanup passed,
two upgrades preserved permissions, rollback/restore passed, and public health
correctly reports server failure and recovery. Health-only PR #11 is merged and live.
Worker version: `a4b6a971-0ab5-44af-8744-493e4ccffb8b`.
Read the newest [MAC-SERVER.md](MAC-SERVER.md) sections for exact proof.

Next work is scoped edge API/MCP acceptance and existing Prims/Stytch OAuth,
including a real ChatGPT connection. Public /v1 and /mcp remain placeholders;
PR #10 holds that candidate. Do not redo native permission/signing or DNS.

# Latest tested state — 2026-09-28

Dedicated signed/notarized server **0.1.2 is installed on the Mini**. Real CRUD
against the eidos-agi profile passed and the canary was deleted. Two signed
upgrades retained disk permission without another approval. Correct profile
root is `/Volumes/Sandisk2TB/Prims/profiles`. Read MAC-SERVER.md for receipts.
The deployed edge probe falsely rejects sandisk:true; a health-only fix is in
review on fix/storage-ready-health. MCP/OAuth is still not complete.

# Live server continuation — 2026-09-28

Read the newest section of [MAC-SERVER.md](MAC-SERVER.md). Company signing and
notarization succeeded using the laptop's visible desktop session, even though
SSH reported Keychain locked. The dedicated Mini server is installed and its
native network/removable-volume prompts were approved through KVM. Its own API
now proves Sandisk readable. The public URL currently returns the original
stub, so older cloud-live claims must be reverified. Do not confuse shell disk
permission with server permission. Version 0.1.1 has been built, signed and
notarized for profile inventory and permission-continuity acceptance.

# SSH continuation — 2026-09-28

The laptop is reachable via the Mini's existing SSH alias `laptop`, despite
Fleet reporting its heartbeat offline. The company Developer ID is present
there. Exact Mini-built artifact and source are staged on the laptop; signing
failed with `errSecInternalComponent`, and notarytool reports the login Keychain
locked. Keychain Access has been opened for local unlock. Resume the prepared
signing route in [MAC-SERVER.md](MAC-SERVER.md); no private-key transfer needed.
Do not repeat the incorrect assumption that Fleet heartbeat means SSH offline.

# Signed server continuation — 2026-09-28

Read [MAC-SERVER.md](MAC-SERVER.md) first for the corrected server/client boundary,
Mini build evidence, signing prerequisites and next action. PrimsDrive Server.app
was built and its packaged HTTP fixture tests passed on the Mini at source
83c75b36bd34b38078d91618f890a296ed2852f0. It is an ad-hoc candidate, not installed
or notarized. Company Developer ID and notary credentials are absent on the Mini.
Next: provision approved signing access, sign/notarize the same product, install
its stable identity, approve its disk access through native UI, then test its API
against Sandisk. Do not return to diagnosing unrelated Fleet Python permissions.

# Project continuation — 2026-09-27 CT

Daniel authorized completing the project and publishing changes. #2 is merged in PR #9 and live. Start from [PROJECT-PLAN.md](PROJECT-PLAN.md) for the full inventory, candidate code, actual blockers, and acceptance gates. #3–#7 are not complete or deployed. The original handoff follows for history.

2026-09-28 UTC continuation: Drive PR #10 adds explicit verified OAuth issuer
configuration and ChatGPT reauthorization metadata. The existing SSO's gated
Connected Apps consent adapter is in `primfoundation/prims-sso#11`. Neither is
deployed. Remote disk checks have been attributed to both the SSH wrapper and
the long-lived Xcode Python process by macOS TCC; attribution depends on the
execution path. The pack LaunchAgent's access remains unverified. See the plan for receipts and
remaining Stytch configuration/introspection and real ChatGPT acceptance gates.

2026-09-28 UTC robot practice: the existing Mini KVM relay at loopback port
14006 can capture the desktop and deliver keyboard/mouse input through Fleet.
System Settings navigation and screenshot changes confirmed actual control.
The UI showed `sshd-keygen-wrapper` Full Disk Access already enabled, and one
of several `python3` entries had Removable Volumes enabled. No permission switch
was changed. The precise application behind that latter entry remains
unverified; do not infer identity from its display name. A bounded read of
`/Volumes/Sandisk2TB/Prims` through Fleet still returned `PermissionError 1`
(receipt `5ddf97b6db6360af8b92e6fc5e0f23de85d0e2515bda88eb2555d0eec9a0f583`).
The directory is owned by `dshanklin` with mode `drwxr-xr-x`; changing POSIX
ownership/modes is not justified by this evidence. Robot operation is proven;
Sandisk access and real pack-service access are not. Resolve the exact runtime's
native macOS permission before claiming a fix. Do not bypass TCC or create a
second data store. Fleet Robots inventory is tracked in `eidos-agi/fleet#13`;
the page has not been built.

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
