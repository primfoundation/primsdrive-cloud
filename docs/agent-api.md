# Agent API and MCP candidate

Status: implemented/tested locally; real Sandisk and Prims SSO acceptance pending.
See PROJECT-PLAN.md. Do not assume deployed placeholder routes already expose this.

Issue short-lived `agt_...` tokens through the **existing Prims SSO** account and
agent API at `login.prims.sh`; its README documents issuance, expiry, revocation,
and rotation (issue replacement, switch consumer, revoke old token). No second
key store is created in Drive. Operator assigns account profiles in
`DRIVE_ACCOUNT_PROFILES={"<account_id>":["<profile>"]}`. Grant SSO policy resource
`primsdrive:profile:<profile>` with `read` and/or `write`; write does not imply read.
Introspection and policy checks run for every request; revoked tokens fail on
subsequent requests. An already executing operation may complete after revocation.

| Method / path | Operation |
| --- | --- |
| GET `/v1/packs?profile=P` | List profile root |
| POST `/v1/packs?profile=P&path=DIR` with `{}` | List directory |
| GET `/v1/packs?profile=P&path=FILE` | Read `{content_base64, etag}` |
| PUT `/v1/packs?profile=P&path=FILE` | Write `{content_base64}` |
| DELETE `/v1/packs?profile=P&path=FILE` | Delete one file |
| GET `/v1/health?profile=P` | Authorized mounted/readable/free space/last acknowledgement |

All require `Authorization: Bearer <agent token>`. JSON request bodies require
`Content-Type: application/json`. Set `If-None-Match: *` for create only, or
`If-Match: "<sha256>"` to overwrite/delete. Missing condition is 428, stale is 412.
Use `offset` for directory pages; response `next_offset` is null at the end.
No cookie, human session token, supplied local path, or caller-selected origin is
accepted. Bodies are bounded; maximum decoded object is 16 MiB.

MCP URL: `https://drive.prims.sh/mcp`, bearer header as above. Stateless Streamable
HTTP JSON responses; GET streaming is not supported (405). POST accepts
`application/json` and requires `Accept: application/json, text/event-stream`.
Supported protocol versions: 2025-11-25, 2025-06-18, 2025-03-26. Initialize,
notifications/initialized, ping, tools/list and tools/call are supported.
Tools: `pack_list`, `pack_read`, `pack_write`, `pack_delete`, `drive_health`.
Write accepts `create:true` or `match` ETag; delete requires `match`.
Tool input schemas are returned by tools/list. Transport auth failures return
401/403; operation failures return MCP `isError:true`. Every call reauthenticates.

References:
- https://github.com/primfoundation/prims-sso
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
