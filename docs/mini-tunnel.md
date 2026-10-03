# Issue #2 — private Cloudflare → Mac mini probe

Continues `de69ecfdb906ba717f378fbc810a5a4bfa771b6a` and its HANDOFF.md.
The existing Worker, Eidos AGI account and `drive.prims.sh` attachment are retained.

## Decision and trust boundary

Use the Cloudflare Tunnel alternative explicitly allowed by #2, with a Workers
VPC **service** binding restricted to `127.0.0.1:18746` on the mini. This is not
custom origin-pull mTLS: cloudflared authenticates its outbound encrypted tunnel
with its tunnel credential, and the Worker authenticates hello using a separate
256-bit secret. The last hop is HTTP over loopback on the same mini. No public
origin hostname, public listener, DNS record, subnet route, or WARP route exists.
All public tunnel ingress returns 404. No TLS verification is disabled.

Cloudflare VPC is beta; keep this dependency explicit. References:
- https://developers.cloudflare.com/workers-vpc/configuration/tunnel/
- https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/

| Resource | Existing or installed value |
| --- | --- |
| Account | Eidos AGI `3c1d42c77978e6af0e458b6f1130c01b` |
| Worker | `primsdrive-cloud` |
| Tunnel | `primsdrive-mini`, `c05e2d60-5b92-4bf2-9978-5b2038ee47a7` |
| VPC service | `primsdrive-mini-hello`, `01a0e621-4249-7040-9f18-5a3cc637c652` |
| Binding | `MINI_HELLO` |
| Worker secret | `MINI_PROBE_SECRET` |
| Origin | `daniels-mac-mini`, `127.0.0.1:18746/hello` |
| Local state | `~/Library/Application Support/PrimsDriveCloud` (0700) |
| Credentials | `probe-secret`, `tunnel-token` (0600; never committed) |
| Login agents | `sh.prims.drive.hello`, `sh.prims.drive.tunnel` |

This state directory holds code and credentials only. It is not a Prim store.
The only king remains `/Volumes/Sandisk2TB/Prims`, which this code does not read.

## Behavior

`/` and `/health` make a fresh, three-second bounded probe with a random nonce.
Only HTTP 200 with the expected service identity, matching nonce, `ok:true` and
`sandisk:false` yields `tunnel:true`. Missing bindings, bad credentials, offline
origin, redirects, malformed JSON and stale replies yield false. `status:stub`
and `sandisk:false` remain until later work. `ok:true` denotes edge liveness,
not pack readiness. Public requests cannot select the origin URL or forward
headers. `/v1/*` and `/mcp` remain placeholders.

Workers accepts `redirect:manual`, not `redirect:error`; a 3xx response is rejected
by the explicit status check. No diagnostic endpoint is retained.

## Install and operate

The mini already has Node 26 and cloudflared 2026.5.0. Securely place the two
credential files in the state directory, then run:

```sh
python3 scripts/install-mini.py "$HOME/Library/Application Support/PrimsDriveCloud"
```

The installer copies hello code and installs user LaunchAgents with RunAtLoad
and KeepAlive. They start at **login**, not before login after a cold boot. A
reboot/login was not performed as a test. LaunchAgent restart has startup latency;
allow the listener to start before checking recovery.

Use the existing Cloudflare MCP deployment plane for module updates and preserve
`MINI_HELLO` plus `MINI_PROBE_SECRET`. No DNS/deployment bootstrap is necessary.
Future key rotation: replace the private probe-secret file, restart hello, then
update the Worker secret; health fails closed during mismatch. Rotate the tunnel
token in Cloudflare, replace tunnel-token, then restart the tunnel login agent.

Rollback the tunnel slice by booting out only these two user agents and removing
the `MINI_HELLO` binding. The Worker then reports `tunnel:false`. Preserve the
public hostname and all pre-existing services. Do not print credential files or
pass tokens as process arguments; cloudflared uses `--token-file`.

## Verification

`npm run verify`: typecheck, six tests, Worker dry-run all pass. Tests exercise
real loopback HTTP authentication, wrong/missing credentials, invalid nonce,
method/path restrictions, malformed replies, stale nonce, redirect and offline
failure, and healthy edge reporting without Sandisk readiness.

Live on 2026-09-27 CT:
- Cloudflare registered four QUIC tunnel connections from the mini.
- `lsof` showed hello listening exclusively on `127.0.0.1:18746`.
- Unauthenticated local hello returned 401.
- Public health returned `tunnel:true`, `sandisk:false`, `status:stub`.
- Stopping hello made public health return `tunnel:false`; it was bootstrapped
  again in a `finally` block. The immediate recovery check raced startup; a
  subsequent fresh health probe returned `tunnel:true` again.
- An independent HOSTKEY TCP attempt to the mini's observed public IPv4 on
  port 18746 timed out; the same machine fetched public edge health successfully
  with `tunnel:true`. Combined with the loopback-only listener, this demonstrates
  direct public access fails closed. No inbound firewall or NAT rule was added.

Fleet evidence receipts (read back, not merely queued):
- Install succeeded: `d34ad1dee2b6d38a3efd8a70ceec781725e9326be8fbd9bcd53ed6f583dd5067`
- Loopback binding and 401: `27f9bda3805a364946ec59cb8713c3931f6791791f91b57128cafd1a2745ba7d`
- Stop test (immediate restart assertion raced startup): `cebc0539325834b023bf90c75c028270808450435813a5e06a485b659c82dafc`
- Independent public-port failure and recovered healthy edge:
  `3ad84853c3aa1cd8e9f02e8311a69f5a73dd4047a8c6bb3c684251a498a004bc`

Delivery: Daniel authorized publication. PR #9 passed CI and merged as
`e32feb2557a51e0e4e0d20f07728551a1b1d9ab1`; #2 is closed.

Next: issue #3, a separate change to serve packs from the existing Sandisk king.

## LaunchAgent openat wedge — 2026-10-03

Confirmed on daniels-mac-mini. This was not a Worker header mismatch and not a
`MINI_PROBE_SECRET` mismatch. Leave DNS, tunnel `primsdrive-mini`
(`c05e2d60-5b92-4bf2-9978-5b2038ee47a7`), VPC service
`01a0e621-4249-7040-9f18-5a3cc637c652`, and the probe secret as they are.

| Observation | Result |
| --- | --- |
| `sh.prims.drive.hello` exec of PrimsDrive Server.app | `/hello` never returned. The process sat in `openat` on `/Volumes/Sandisk2TB` inside `Store.directory()` |
| Worker `miniStatus` | Aborted at 3s and published `tunnel:false`, `sandisk:false` |
| Same binary via `sshd` | `sandisk:true` in about 20ms |
| Live mitigation already applied | The hello LaunchAgent wraps the server with `ssh -o BatchMode=yes` to `127.0.0.1`, so the open uses the sshd context that can read the volume |
| Public health after that job change | `status:storage-ready`, `tunnel:true`, `sandisk:true` (2026-10-03) |

`Store.directory()` opens `/Volumes/Sandisk2TB` on the request thread before
`/hello` writes a body. Under the LaunchAgent TCC context that `openat` does
not return. The Worker then has nothing to classify and reports the tunnel down.
The volume itself was readable the whole time.

`sandisk_probe` (default 1s) waits for `store.health()` off the request thread.
Hello still returns `ok:true`, `service:"primsdrive-mini-hello"`, and the nonce.
`sandisk` is false when the open does not finish, when it raises, or when an
open is already in flight. A stuck `openat` cannot be killed from Python; the
bound only releases the HTTP response and stops a pile of further opens. That
is what makes a direct LaunchAgent `ProgramArguments` exec safe for the public
probe: tunnel can stay true while the king open is wedged. It does not grant
TCC, and it does not make `sandisk:true` in a context that cannot open the volume.

The running notarized 0.1.2 app does not include `sandisk_probe`. Keep the ssh
BatchMode wrapper until a company-signed build from this source is installed
with the path in [MAC-SERVER.md](MAC-SERVER.md). Do not point the job back at a
raw `python3` or at the current 0.1.2 binary. Hello continues to require
`x-probe-nonce` (the same header as `X-Probe-Nonce`). `X-PrimsDrive-Nonce` alone
is a 400.

A later Worker deploy of this branch adds `probe` on `/health` (`ok`,
`timeout`, `unauthorized`, `rejected`, `redirect`, `bad_response`,
`unconfigured`, `unreachable`). The field has no secret, nonce, or upstream body.
The deployed health-only script does not emit it yet.
