# PrimsDrive Server on the Mac mini

## Boundary and triage

The Mini server alone owns `/Volumes/Sandisk2TB/Prims`. Cloudflare is its
network client and the MCP server presented to ChatGPT. ChatGPT and the laptop
are clients. Fleet/KVM is maintenance transport, not the storage service.
`Prims Desktop.app` (`sh.prims.desktop`, port 7749) is an existing connector host;
do not replace it or borrow its permissions to serve this candidate.

Triage in order: server identity/process → mounted volume → server API health →
authorized read → conditional canary CRUD → private tunnel → MCP client.
A Fleet Python EPERM does not establish the server's permission state. A mounted
volume, green UI toggle, or successful robot action does not establish API access.
On failure retain exact process, code identity, endpoint, status and receipt.
Change one relevant cause, then repeat the same server API check.

## Build/release contract

Shared practice: `eidos-agi/eidos-desktop-app-builder`, especially
`docs/workflows/release-lifecycle.md` and `docs/security/tcc-and-code-identity.md`.
Credential custody: `eidos-agi/eidos-infra/docs/apple-cloud-signing.md`.

- App: `PrimsDrive Server.app`; ID: `sh.prims.drive.server`; version 0.1.0 (1).
- Required signer: `Developer ID Application: Eidos AGI LLC (Y6CQ4SWPWM)`.
- Build/test target: arm64 Mini. Other architectures and minimum OS compatibility
  are unverified. Record actual Python/macOS/tool versions per candidate.
- Package the existing Python server and runtime together with PyInstaller.
  Never launch production through `/usr/bin/python3`, Fleet, or an unrelated app.
- Production root remains fixed; HTTP binds only 127.0.0.1:18746, authenticates
  with the existing private probe secret and preserves the existing RPC contract.
- `--self-test` runs actual HTTP requests in the packaged process against a
  disposable fixture. It neither reads Sandisk nor proves Sandisk permission.
- Debug candidates are side-built, ad-hoc signed, never installed over a granted
  release and never used to collect production permission approval.
- Release requires the company identity, hardened runtime, secure timestamp,
  clean source commit, nested signature verification, Accepted notarization,
  stapling and Gatekeeper verification before installation.

On the Mini, in an isolated product checkout:

```sh
uv venv --python /opt/homebrew/bin/python3 .venv-mac
uv pip install --python .venv-mac/bin/python -r macos/requirements-build.txt
.venv-mac/bin/python -m unittest discover -s mini/tests -v
.venv-mac/bin/python macos/build.py --mode candidate --output /absolute/new/candidate
# Only with company signing identity available:
.venv-mac/bin/python macos/build.py --mode release --output /absolute/new/release
```

Retain a resolved build dependency inventory and source SHA alongside evidence.
The release builder checks code signatures; it does not claim notarization or
production installation. Follow the shared handbook's submit/resume/staple
sequence using the authorized `eidos-notary` profile, never credentials in chat.

## Installation and acceptance plan

1. Build and execute the package on the Mini; pass fixture HTTP CRUD, auth,
   conflict, traversal, symlink and missing-volume tests. Prove the release
   preflight refuses missing company keys instead of silently changing identity.
2. Provision the existing company identity and notary authentication through
   approved Keychain/custody procedures. No certificate revocation, guessed team,
   personal signing substitution or private-key export through chat.
3. Sign/notarize/staple and retain exact archive checksum and signature requirement.
4. Install at `~/Applications/PrimsDrive Server.app` with any existing app backed
   up. Preserve `~/Library/Application Support/PrimsDriveCloud` and its secrets.
5. Replace only the `sh.prims.drive.hello` job's executable with the installed
   bundle executable. Preserve the old plist for rollback; keep the tunnel job,
   DNS, port, probe secret and VPC binding. Starts at login, not pre-login boot.
6. Show native macOS permission screens and approve this server's removable-volume
   access. Use API health from the running job to prove attribution and access.
7. Verify a uniquely named canary inside an approved profile through the server
   API: create, exact read, ETag update, list, delete, absent. Never edit real packs.
8. Verify through the existing tunnel and authenticated MCP. OAuth remains a
   separate documented gate in CHATGPT-CONNECTION.md.
9. Upgrade a second signed build at the same path; compare designated requirements,
   verify API access and whether prompts recur. Rehearse rollback to the prior
   server/hello executable and restore its plist without touching library data.

Do not report release success until these live gates pass. Keep the existing
hello/tunnel online while signing custody is unavailable.

## Mini execution evidence — 2026-09-28

Built source `83c75b36bd34b38078d91618f890a296ed2852f0` on macOS 26.4,
arm64, CPython 3.14.5, PyInstaller 6.22.3. Candidate:
`/Users/dshanklin/primsdrive-candidate-83c75b3/dist/PrimsDrive Server.app`.
The source checkout is `/Users/dshanklin/primsdrive-build-3afd320` (its name
reflects the first transfer; HEAD was advanced to the source above).

- Five filesystem tests passed on the Mini, including missing mount, symlink,
  hardlink and directory-swap protections.
- Packaged-process HTTP self-test passed nine reported checks: unauthorized
  rejection, fixture health, create acknowledgment, exact read, conflict rejection,
  ETag update, list, traversal/symlink rejection and verified deletion.
- Recursive strict signature verification passed for this **ad-hoc candidate**.
  `TeamIdentifier=not set`; it is not an Eidos release and is not notarized.
- Release preflight rejected missing company Developer ID private-key identity.
- Installer rejected the retired raw-Python production path before mutation.
- Existing hello PID 21895 and tunnel PID 20778 remained running.
- Local full regression: 17 TS tests, five Python tests, typecheck and Worker dry-run.

Receipts:
- Initial Mini filesystem tests + packaged build:
  `128b65951f65302d182e04eaca64dc0717bc59a78e30ff3f41d779971e4ebc22`.
- Final pinned build:
  `65852e2d40c140e91d64bd30a0a6f95805a5fffbb1a19265934d11da701fe5c8`.
- Packaged evidence + negative release/installer gates:
  `827a4b13ac16f542de7a711632b74db4e78d72e4ddb1335c3434c3989c6a1770`.
- Executable SHA256 (not a final archive checksum):
  `322acd45b78fb8b295247f2355bc2a8f7f965758281b602e02e038e5650d50fd`.

Remaining external prerequisite: authorized access on the signing Mac to
`Developer ID Application: Eidos AGI LLC (Y6CQ4SWPWM)` **with its private key**,
plus notarization authentication. The only currently granted online Mac is the
Mini; the laptop was offline in Fleet. Its historic certificate cannot be inferred
from an already-signed installed app. No secret export, certificate creation,
revocation or permission modification was attempted. Signing, notarization,
production installation, Sandisk CRUD and upgrade permission continuity remain
unproven. Follow the credential custody runbook; never paste private keys here.
