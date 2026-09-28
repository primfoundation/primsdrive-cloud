# PrimsDrive cloud — completion plan and release gates

Updated 2026-09-27 CT after Daniel explicitly authorized publishing and completing
this project. Continue the canonical issue sequence; do not rebuild DNS, move the
king, or create a second identity issuer. PR #9 merged as
`e32feb2557a51e0e4e0d20f07728551a1b1d9ab1` closes #2.

## Inventory and current truth

| Issue | Implementation state | Required live acceptance |
| --- | --- | --- |
| #1 | Existing edge/domain live | Already proved; leave DNS alone |
| #2 | Merged, deployed, verified | Complete; login startup (not pre-login boot) |
| #3 | Candidate Python pack service + filesystem tests | Real Sandisk create/read/update/delete canary; currently OS access blocked |
| #4 | Candidate SSO-backed scoped REST API | Real agent issue/rotate/revoke; immediate revoked-token rejection through edge |
| #5 | Candidate stateless Streamable HTTP MCP | Real ChatGPT plugin OAuth connection and tool canary round-trip |
| #6 | Candidate Access JWT verifier; upstream provider unfinished | Prims SSO OIDC → Access → Drive redirect/sign-in/logout/expiry proof |
| #7 | Candidate authenticated, read-only folder browser | Real signed-in human browses actual king profiles and mount health |

The candidate branch is **not a production-complete release**. #3–#7 stay open.
Local validation passes but does not substitute for the live acceptance above.

**Direct ChatGPT connection is a required deliverable.** See
[CHATGPT-CONNECTION.md](CHATGPT-CONNECTION.md). Its OAuth provider work is ahead
of web UI polish; generic bearer MCP tests alone do not close #5.
The deployed Worker and mini retain the proven #2 hello implementation.

## Concrete blockers found

1. Fleet runs as `dshanklin` on `Daniels-Mac-mini.local`. A bounded read found
   `/Volumes/Sandisk2TB` mounted and the `Prims` root present, then `os.listdir`
   returned `PermissionError: [Errno 1] Operation not permitted`. Receipt:
   `5fefd90fc21be33398751a22ea0a66f1cd94cb08bb8d3ddf36719b558ed21172`.
   This is an OS access denial, not an unmounted volume. Do not bypass it with
   another account, privileged process, broad chmod, copied data, or TCC edits.
   An administrator must authorize the intended mini service's removable-volume
   access through macOS's supported permission UI. Exact responsible process
   attribution must be checked in macOS; do not assume a Python/Node permission
   automatically grants Fleet or vice versa. Until then no real canary is claimed.
2. `primfoundation/prims-sso` has passkey sessions, agent tokens and policy APIs,
   but its #2 OIDC provider and #3 Drive integration remain open. Login cookies
   are host-only on `login.prims.sh`; copying them across hosts is not SSO.
   Read-only Cloudflare inventory found **zero Access apps** and no Prims OIDC
   provider (only the built-in cloudflare identity provider). The candidate verifier
   fails closed without an actual issuer and audience; no fake session is minted.
3. Profile assignments need to be anchored to the existing library layout and
   verified account/Access subject. Inventory of actual profile names is blocked
   by (1). Do not auto-grant the whole disk to anyone with a Prims account.

## Ordered execution from here

1. Resolve mini OS access using the intended service identity. Read only the
   immediate Prims children and record the actual profile contract.
2. Install the reviewed candidate using `scripts/install-mini.py STATE --pack-service`.
   Reuse the existing probe secret, tunnel token, port, login-agent labels, and VPC
   service. No secrets in git or command arguments; never change the root.
3. Bind the existing `prims-sso` Worker as `PRIMS_SSO`; set operator-owned
   `DRIVE_ACCOUNT_PROFILES` for the verified owner account. Issue a short-lived
   test agent at Prims SSO and grant `primsdrive:profile:<profile>` read/write.
4. Update only the existing Worker via Cloudflare MCP, preserving its bindings
   and `MINI_PROBE_SECRET`. Write one uniquely named canary, read exact bytes,
   overwrite with its ETag, list it, delete with its ETag, verify absent. Repeat
   via MCP; revoke the token and verify the next request fails. No real pack edits.
5. Prioritize direct ChatGPT OAuth integration per CHATGPT-CONNECTION.md. Finish the existing SSO provider/integration work in prims-sso#2/#3. Configure
   Access with **that** IdP for `/` and `/app`, keeping `/health`, `/v1/*`, `/mcp`
   outside the human gate. No substitute email OTP or second account store.
6. Set `ACCESS_ISSUER`, `ACCESS_AUD`, and verified-subject `DRIVE_HUMAN_PROFILES`.
   Test a real passkey login with Daniel, browse actual directories, logout and
   expiry. Confirm agent bearers cannot open HTML and cookies cannot call APIs.
7. Merge/release candidate only after the corresponding live gates, read back CI
   and production, close original issues individually, update HANDOFF.md. Keep
   failed or pending gates explicit; do not label local fixtures as Sandisk proof.

## Candidate contracts

- Mini root is fixed in `mini/server.py`: `/Volumes/Sandisk2TB/Prims`. Filesystem
  operations use descriptor-relative paths and no-follow traversal. Symlinks,
  hardlinks, special files, cross-device directories, hidden/parent components,
  absent mounts and inaccessible roots fail closed. No fallback data directory.
- Profiles are explicit top-level directories. Object payloads use base64 JSON;
  maximum decoded size is 16 MiB. Directory pages contain up to 128 entries.
- Creates require `If-None-Match: *`; overwrite/delete require the SHA-256 ETag
  returned by read. Writes use same-directory temporary files, fsync and atomic
  rename/link, then read back before `king_ack`. Deletes are single files only.
- The service serializes its own writes. ETag comparison is not a distributed
  lock against concurrent File Provider writers; external writes can race the
  comparison. Coordinate active edits; do not claim cross-writer CAS guarantees.
- Recent `king_ack` is in-process metadata and resets on service restart. It is
  not a persistent audit ledger. Free space is measured on the opened king root.
- Prims SSO is the only issuer. Drive introspects the token and checks live policy
  on each request (no auth cache). Operator account-profile mapping is an
  additional restriction: a self-registered account cannot self-grant disk access.
- Human HTML verifies RS256 signatures against the configured Access issuer's
  JWKS, exact audience, time claims and explicit subject-profile grants. It never
  uses agent keys. `/app` is read-only and does not render pack content as HTML.
- The SSO policy store is currently its documented policy stub, not OpenFGA.
- `npm run verify`: typecheck, TS tests (including real Python HTTP/filesystem
  round-trip), Python path-isolation tests, Worker build. Human JWT tests use
  generated signing keys; SSO token/policy replies in tests are fixtures.
