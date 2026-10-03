## 2026-10-03T21:10:00Z Diagnosis

- **What changed:** Timed live `/health` while it reported `tunnel:false`. Each sample took 3.02–3.09s, matching the Worker abort.
- **Why:** A fast 401/400/shape mismatch was already a poor fit. The mini later confirmed the cause: LaunchAgent direct exec of PrimsDrive Server.app blocked forever in `openat` on `/Volumes/Sandisk2TB` inside `Store.directory()` during `/hello`. The same binary via `sshd` returned `sandisk:true` in about 20ms.
- **Supporting Research:** Live curls 2026-10-03. Mini report the same day. Worker budget in `src/tunnel.ts`.

## 2026-10-03T21:40:00Z Confirmed cause and bound

- **What changed:** Documented the LaunchAgent TCC/`openat` wedge, the ssh BatchMode wrapper already running on the mini, and `sandisk_probe` (1s) so a later direct LaunchAgent exec can still finish `/hello`. Public health rechecked: `storage-ready`, `tunnel:true`, `sandisk:true`.
- **Why:** The wrapper restores the sshd open context. The timeout is what makes direct LaunchAgent execution safe for the probe, because a stuck `openat` cannot be cancelled and must not hold the HTTP body. DNS and `MINI_PROBE_SECRET` stay as they are.
- **Supporting Research:** Mini ops note 2026-10-03 CT. Follow-up curl of `https://drive.prims.sh/health`.

- [x] Confirmed cause recorded
- [x] Volume-open waiter tested (wedged `health()` still returns hello)
- [x] Live health storage-ready after the wrapper
- [ ] Signed build containing `sandisk_probe` installed (wrapper stays until then)

`Handler.dispatch` remains longer than 50 lines. It was already the single fail-closed RPC parser; this change only replaced the hello disk call with `sandisk_probe`. Splitting the parser is a separate refactor.
