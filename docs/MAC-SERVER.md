# Verified profile mapping — 2026-09-28

Current installed server: **0.1.2**, source `799865e` on the Mini.
The physical profiles are under `/Volumes/Sandisk2TB/Prims/profiles`, not directly
under Prims. Production `PROFILE_ROOT` now uses that verified subdirectory;
KING remains the same Sandisk. The private profiles RPC returns only actual
profile directories. Do not grant the container `profiles` as a tenant profile.

Apple Accepted submission `be5b42c1-0cd9-4bb3-b1f4-0fd3fc56fd14`.
Stapled ZIP SHA256: `bedd419470342b7139297b64d136cc2f7d843265eaeec268719b4a40066d89d8`.
Ten packaged fixture checks passed on the Mini. Versions 0.1.0, 0.1.1 and 0.1.2
have the same designated requirement (bundle + Apple chain + Eidos AGI team).
Both upgrades retained disk permission; API calls succeeded without new consent.
A real rollback to 0.1.0 and restoration to 0.1.2 also passed API disk health
(receipt `652e8a08a446816cf5aac9fd0ee06ea0fe5a401ca0bf023059f16aeb61b8f6bb`).

Real 0.1.2 server acceptance receipt:
`1d2f6a2705e47fb36e94068b0ba267db7f935cef19b39a20d0c010b766838cde`.
Twelve checks passed: actual profile mapping, unauthorized rejection, create ACK,
exact read, duplicate and stale-update rejection, conditional update ACK, updated
exact read, listing, traversal rejection, delete ACK, verified absence.
The unique canary was in `eidos-agi` and is deleted. No existing pack was edited.
Earlier 0.1.1 `_scratch` canary also passed and was removed.

Observed profiles: aic-holdings, boone-voyage, daniel-shanklin-inbox,
daniel-shanklin-personal, eidos-agi, greenmark-waste, howjadoo, jetta-operating.
Backups: `~/Applications/PrimsDrive Server-0.1.0-backup.app` and
`PrimsDrive Server-0.1.1-backup.app`; original hello plist remains `.before-server`.

---

# Live server acceptance — 2026-09-28

The dedicated server 0.1.0 is installed at
`/Users/dshanklin/Applications/PrimsDrive Server.app` on the Mini. Company
Developer ID team Y6CQ4SWPWM, hardened runtime, timestamp, strict signature,
Apple notarization, staple and Gatekeeper checks passed. Notary submission:
`9cdce3ed-ca8b-4581-b8f0-0e2bdfb0f7a6` (Accepted).
Archive SHA256: `6ef4c6e4d84901ba531c37f617e00d6b4db8c11530dfed486caef773b63baa70`.

The Keychain problem was SSH-session-specific. Daniel's screenshot showed the
login keychain unlocked; the same notarytool command succeeded in a visible
Terminal desktop session. Signing and submitting from that session succeeded.
Do not keep asking Daniel to unlock an already-unlocked keychain. No keys were
exported or ACLs changed. 1Password integration is still future release work.

The first bootstrap returned error 5; retry after the old job disappeared worked.
The installer now bounds retries and restores the prior plist on persistent
failure. Both regression tests pass (`python3 -m unittest discover -s scripts/tests -v`).

KVM showed the actual PrimsDrive Server local-network prompt; Allow was clicked.
A stale python3.11 cross-app-data prompt was dismissed with Don't Allow, revealing
the queued PrimsDrive Server removable-volume prompt. Allow was clicked for the
server. TCC logs attributed the volume request to `sh.prims.drive.server`.
`/hello` now returns `sandisk:true`; authenticated `/rpc` health returns mounted
and readable true (receipt `cc8bc4fdf5b465e2838da287743c5d920933bdaf971e81f6038e35535fa722e4`).
The maintenance shell remains denied; that is not a server failure.

Public `https://drive.prims.sh/health` returned a stub-shaped health response with
sandisk/tunnel false (receipt `d7ee3240f9831854ca765c75ca42c4f322909c2ab6cb8441a0aaf89a7ae06811`).
Root cause: the deployed issue-2 probe explicitly requires `sandisk === false`,
so real disk success makes it incorrectly report tunnel false. The existing
Worker version is `8ea0f952-1467-4c1b-9f58-228887b8e1cd`; its binding and secret
are present. A health-only patch is prepared on `fix/storage-ready-health`. Do not redo DNS or create
another worker/tunnel/identity issuer.

Version 0.1.1 adds an authenticated private `profiles` RPC that lists only root
directories, excluding symlinks/files, with pagination. Source built on Mini:
`c8123f87cb908776d43fe74de21cd09ca0e1613f`; published source-equivalent commit:
`a57e74a1e7268d2b036ceaee4e9b3a253b9b8a2a` (same Git tree).
Ten packaged tests and full npm verify passed. Notary submission
`ad3a841b-62f1-4a25-8f80-ccad9a6b2647` is Accepted, stapled, Gatekeeper accepted.
Final ZIP SHA256: `50fe9d45ca1bc6d07c79a069fa4901a9cf300a92b43964475e7474cd1fdd55e1`.
Upgrade, real canary and rollback outcomes follow below when verified.

---

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

## SSH signing route correction — 2026-09-28

Fleet's laptop heartbeat is stale, but the Mini's existing SSH alias `laptop`
reaches `dshanklinbv@100.72.135.59` with existing host-key verification. Do not
infer SSH reachability from Fleet heartbeat. The laptop DOES contain the company
Developer ID identity (fingerprint `6CD0067D35977EA48B528BDA26511C0403A76E3B`).
Its login Keychain is locked: notarytool returned `keychainLocked`; an actual
candidate executable signing attempt returned `errSecInternalComponent`.
Keychain Access was opened via shell for native local unlock. No password was
retrieved, security control disabled, ACL changed or private key exported.

The original Mini-built archive and corresponding source are staged on laptop:
`~/primsdrive-signing-83c75b3/`. `candidate.zip` SHA256:
`dde6d3df197b71d4bbbc046f26c76efbff054f31cfebd71c6028916d08a3ab42`.
The original Mini app remains intact. The failed signing attempt modified only
an extracted signing copy; always start the real run in a NEW output directory.

After local login Keychain unlock, use the staged script (also committed as
`macos/sign-candidate.py`) to verify archive hash, extract a fresh copy, sign
nested Mach-O code and frameworks inside-out, sign the bundle, verify company
identity/runtime/timestamp, and run its packaged HTTP self-test. It leaves keys
on the laptop and produces a submission archive, not a notarization claim.

```sh
cd ~/primsdrive-signing-83c75b3
python3 sign-candidate.py candidate.zip \
  --sha256 dde6d3df197b71d4bbbc046f26c76efbff054f31cfebd71c6028916d08a3ab42 \
  --output signed-attempt-1
xcrun notarytool submit signed-attempt-1/submission.zip \
  --keychain-profile eidos-notary --output-format json > signed-attempt-1/submission.json
```

Record submission ID; poll that ID rather than uploading again. On Accepted,
staple and verify the app, make a final archive, checksum it, transfer that archive
back over SSH and verify its checksum on Mini. Repeat packaged self-test there,
then perform the installation and Sandisk gates above. The profile's presence
and validity remain unverified until the Keychain is unlocked.

Receipts: SSH identity/notary check
`362985ef2d9019a22f45b5e316d340cfcdafd032fa3c33372791c722b26ac058`;
artifact transfer `502e12df4e4be9c975a1f271c5f16eca58d36899d2014f9fdc8eb93faafc293b`;
real signing attempt `bfb2857bf74accf26c1eec57f7e400b6a85096203c87e2f219a287550413fa0d`.
