"""Hello must prove the tunnel even when the king check does not return."""
import json
import pathlib
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from http.server import ThreadingHTTPServer
from server import handler
from store import Store, StoreError

SECRET = 'a' * 64
NONCE = '12345678-1234-1234-1234-123456789abc'


class SlowDisk:
    def health(self):
        time.sleep(5)


class DeniedDisk:
    def health(self):
        raise StoreError(503, 'volume_unmounted')


def serve(store, budget=1.0):
    http = ThreadingHTTPServer(('127.0.0.1', 0), handler(store, SECRET, budget))
    http.daemon_threads = True
    thread = threading.Thread(target=http.serve_forever, daemon=True)
    thread.start()
    return http, thread


def call(http, headers, timeout=2):
    request = urllib.request.Request(
        'http://127.0.0.1:%s/hello' % http.server_port, headers=headers)
    try:
        response = urllib.request.urlopen(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        return response.status, json.load(response)


class HelloBudgetTests(unittest.TestCase):
    def tearDown(self):
        if getattr(self, 'http', None):
            self.http.shutdown()
            self.http.server_close()
            self.thread.join(timeout=2)

    def test_lowercase_probe_nonce_matches_worker_header(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.http, self.thread = serve(Store(tmp))
            status, body = call(self.http, {
                'Authorization': 'Bearer ' + SECRET,
                'x-probe-nonce': NONCE,
            })
        self.assertEqual(status, 200)
        self.assertEqual(body['service'], 'primsdrive-mini-hello')
        self.assertEqual(body['nonce'], NONCE)
        self.assertIs(body['sandisk'], True)
        self.assertIs(body['ok'], True)

    def test_other_nonce_header_is_rejected(self):
        self.http, self.thread = serve(SlowDisk(), 0.05)
        status, body = call(self.http, {
            'Authorization': 'Bearer ' + SECRET,
            'X-PrimsDrive-Nonce': NONCE,
        })
        self.assertEqual(status, 400)
        self.assertEqual(body, {'error': 'invalid_nonce'})

    def test_wedged_disk_still_returns_hello(self):
        self.http, self.thread = serve(SlowDisk(), 0.15)
        started = time.monotonic()
        status, body = call(self.http, {
            'Authorization': 'Bearer ' + SECRET,
            'X-Probe-Nonce': NONCE,
        })
        elapsed = time.monotonic() - started
        self.assertLess(elapsed, 1.0)
        self.assertEqual(status, 200)
        self.assertEqual(body['ok'], True)
        self.assertEqual(body['service'], 'primsdrive-mini-hello')
        self.assertEqual(body['nonce'], NONCE)
        self.assertIs(body['sandisk'], False)

    def test_in_flight_open_does_not_stack(self):
        calls = {'n': 0}

        class Counting:
            def health(self):
                calls['n'] += 1
                time.sleep(0.4)

        self.http, self.thread = serve(Counting(), 0.15)
        headers = {'Authorization': 'Bearer ' + SECRET, 'x-probe-nonce': NONCE}
        first, body = call(self.http, headers)
        second, again = call(self.http, headers)
        self.assertEqual(first, 200)
        self.assertEqual(second, 200)
        self.assertIs(body['sandisk'], False)
        self.assertIs(again['sandisk'], False)
        self.assertEqual(calls['n'], 1)
        time.sleep(0.35)
        self.assertEqual(calls['n'], 1)

    def test_disk_error_keeps_tunnel_proof(self):
        self.http, self.thread = serve(DeniedDisk(), 0.5)
        status, body = call(self.http, {
            'Authorization': 'Bearer ' + SECRET,
            'x-probe-nonce': NONCE,
        })
        self.assertEqual(status, 200)
        self.assertIs(body['sandisk'], False)
        self.assertEqual(body['nonce'], NONCE)


if __name__ == '__main__':
    unittest.main()
