"""Packaged-process HTTP acceptance against a disposable fixture, never the king."""
import base64
import json
import pathlib
import tempfile
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from store import Store


def run():
    from server import handler
    checks = []
    with tempfile.TemporaryDirectory(prefix='primsdrive-selftest-') as tmp:
        root = pathlib.Path(tmp).resolve()
        secret = 'a' * 64
        http = ThreadingHTTPServer(('127.0.0.1', 0), handler(Store(str(root)), secret))
        http.daemon_threads = True
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        def rpc(body, status=200, token=secret):
            request = urllib.request.Request('http://127.0.0.1:%s/rpc' % http.server_port,
                data=json.dumps(body).encode(), headers={'Authorization':'Bearer '+token,
                                                         'Content-Type':'application/json'})
            try:
                response = urllib.request.urlopen(request, timeout=5)
            except urllib.error.HTTPError as e:
                response = e
            with response:
                actual = response.status
                payload = json.load(response)
            if actual != status:
                raise AssertionError((body.get('op'), actual, status, payload))
            return payload
        def obj(op, **kw):
            return dict(op=op, profile='canary', path='probe.prim', **kw)
        try:
            rpc({'op':'health'}, 401, token='wrong'); checks.append('reject_unauthorized')
            assert rpc({'op':'health'})['readable']; checks.append('fixture_health')
            one = base64.b64encode(b'first').decode()
            created = rpc(obj('put', content_base64=one, create=True))
            assert created['king_ack']; checks.append('create_ack')
            (root/'not-a-profile.txt').write_text('fixture')
            (root/'alias').symlink_to(root/'canary')
            rpc({'op':'profiles'}, 401, token='wrong')
            assert [p['name'] for p in rpc({'op':'profiles'})['entries']] == ['canary']
            checks.append('authenticated_profile_inventory')
            assert rpc(obj('get'))['content_base64'] == one; checks.append('read_exact_bytes')
            rpc(obj('put', content_base64=one, create=True), 412)
            rpc(obj('put', content_base64=one, match='stale'), 412)
            checks.append('reject_conflicts')
            changed = rpc(obj('put', content_base64=base64.b64encode(b'second').decode(), match=created['etag']))
            assert rpc(obj('get'))['etag'] == changed['etag']; checks.append('update_etag')
            listing = rpc({'op':'list','profile':'canary','path':''})
            assert listing['entries'][0]['name'] == 'probe.prim'; checks.append('list')
            rpc({'op':'get','profile':'canary','path':'../outside'}, 400)
            (root/'canary'/'link').symlink_to(root)
            rpc({'op':'get','profile':'canary','path':'link/probe.prim'}, 503)
            checks.append('reject_traversal_and_symlink')
            rpc(obj('delete', match=changed['etag']))
            rpc(obj('get'), 404); checks.append('delete_verified')
        finally:
            http.shutdown(); http.server_close(); thread.join(timeout=5)
    print(json.dumps({'ok':True,'scope':'disposable-fixture-only','checks':checks}))
