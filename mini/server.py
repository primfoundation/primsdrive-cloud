"""Private, authenticated mini service. Never accepts a configurable data root."""
import base64
import binascii
import hmac
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from store import MAX_BYTES, Store, StoreError, parts

KING = '/Volumes/Sandisk2TB/Prims'
VOLUME = '/Volumes/Sandisk2TB'


def handler(store, secret):
    if len(secret) != 64 or any(c not in '0123456789abcdef' for c in secret):
        raise ValueError('Invalid probe secret')

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Never log Authorization, content, or object paths.

        def setup(self):
            super().setup()
            self.connection.settimeout(15)

        def reply(self, status, body):
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def dispatch(self):
            if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + secret):
                return self.reply(401, dict(error='unauthorized'))
            if self.path == '/hello' and self.command == 'GET':
                nonce = self.headers.get('X-Probe-Nonce', '')
                if len(nonce) != 36 or any(c not in '0123456789abcdef-' for c in nonce):
                    return self.reply(400, dict(error='invalid_nonce'))
                try:
                    store.health()
                    accessible = True
                except (OSError, StoreError):
                    accessible = False
                return self.reply(200, dict(ok=True, service='primsdrive-mini-hello', nonce=nonce, sandisk=accessible))
            if self.path != '/rpc':
                return self.reply(404, dict(error='not_found'))
            if self.command != 'POST':
                return self.reply(405, dict(error='method_not_allowed'))
            try:
                limit = MAX_BYTES * 4 // 3 + 8192
                lengths = self.headers.get_all('Content-Length', [])
                transfer = self.headers.get_all('Transfer-Encoding', [])
                if transfer:
                    if lengths or transfer != ['chunked']:
                        raise StoreError(400, 'ambiguous_body')
                    chunks = []; total = 0
                    while True:
                        line = self.rfile.readline(100)
                        if not re.fullmatch(b'[0-9a-fA-F]+\r\n', line):
                            raise StoreError(400, 'invalid_chunk')
                        size = int(line.strip(), 16)
                        total += size
                        if total > limit:
                            raise StoreError(413, 'request_too_large')
                        if size == 0:
                            if self.rfile.readline(3) != b'\r\n':
                                raise StoreError(400, 'trailers_not_supported')
                            break
                        chunk = self.rfile.read(size)
                        if len(chunk) != size or self.rfile.read(2) != b'\r\n':
                            raise StoreError(400, 'invalid_chunk')
                        chunks.append(chunk)
                    raw = b''.join(chunks)
                else:
                    if len(lengths) != 1:
                        raise StoreError(411, 'content_length_required')
                    length = int(lengths[0])
                    if length < 0 or length > limit:
                        raise StoreError(413, 'request_too_large')
                    raw = self.rfile.read(length)
                    if len(raw) != length:
                        raise StoreError(400, 'incomplete_body')
                body = json.loads(raw)
                if not isinstance(body, dict):
                    raise StoreError(400, 'invalid_body')
                op = body.get('op')
                if op == 'health':
                    return self.reply(200, store.health())
                profile = body.get('profile')
                if len(parts(profile)) != 1:
                    raise StoreError(400, 'invalid_profile')
                relative = body.get('path', '')
                parts(relative, allow_empty=op == 'list')
                path = profile + ('/' + relative if relative else '')
                if op == 'list':
                    result = store.listing(path, body.get('offset', 0))
                elif op == 'get':
                    content, etag = store.get(path)
                    result = dict(content_base64=base64.b64encode(content).decode(), etag=etag)
                elif op in ('put', 'delete'):
                    content = None if op == 'delete' else base64.b64decode(body['content_base64'], validate=True)
                    if body.get('create', False) not in (True, False):
                        raise StoreError(400, 'invalid_precondition')
                    result = store.mutate(path, content, body.get('match'), body.get('create', False))
                else:
                    raise StoreError(400, 'unknown_operation')
                return self.reply(200, result)
            except StoreError as e:
                return self.reply(e.status, dict(error=e.code))
            except FileNotFoundError:
                return self.reply(404, dict(error='not_found'))
            except PermissionError:
                return self.reply(503, dict(error='king_permission_denied'))
            except (ValueError, TypeError, KeyError, binascii.Error):
                return self.reply(400, dict(error='invalid_body'))
            except OSError:
                return self.reply(503, dict(error='king_unavailable'))

        do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = dispatch

    return Handler


def main():
    if sys.argv[1:] == ['--self-test']:
        from selftest import run
        run()
        return
    if sys.argv[1:]:
        raise SystemExit('Only --self-test is supported; production root and port are fixed')
    state = Path.home() / 'Library/Application Support/PrimsDriveCloud'
    secret = Path(os.environ.get('PRIMSDRIVE_PROBE_SECRET_FILE', str(state / 'probe-secret'))).read_text().strip()
    server = ThreadingHTTPServer(('127.0.0.1', 18746), handler(Store(KING, VOLUME), secret))
    server.daemon_threads = True
    server.serve_forever()


if __name__ == '__main__':
    main()
