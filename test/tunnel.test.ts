import assert from 'node:assert/strict';
import { it } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { helloServer } from '../mini/hello.ts';
import worker from '../src/index.ts';
import { probeMini } from '../src/tunnel.ts';

const secret = 'a'.repeat(64);
it('private probe authenticates, rejects bypasses, and leaves Sandisk false', async () => {
  const server = helloServer(secret).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const authorization of ['', 'Bearer wrong']) {
      assert.equal((await fetch(`${url}/hello`, { headers: { authorization } })).status, 401);
    }
    const headers = { authorization: `Bearer ${secret}`, 'x-probe-nonce': crypto.randomUUID() };
    assert.equal((await fetch(`${url}/hello`, { method: 'POST', headers })).status, 405);
    assert.equal((await fetch(`${url}/packs`, { headers })).status, 404);
    assert.equal((await fetch(`${url}/hello`, { headers: { authorization: headers.authorization } })).status, 400);
    const env = {
      MINI_PROBE_SECRET: secret,
      MINI_HELLO: { fetch: (req: Request) => {
        assert.equal(req.url, 'http://127.0.0.1:18746/hello');
        assert.equal(req.redirect, 'manual');
        return fetch(new Request(`${url}/hello`, req));
      } },
    };
    assert.equal(await probeMini(env), true);
    assert.equal(await probeMini({ ...env, MINI_PROBE_SECRET: 'bad' }), false);
    const response = await worker.fetch(new Request('https://drive.prims.sh/health?url=https://evil.invalid'), env);
    const health = await response.json() as Record<string, unknown>;
    assert.equal(health.tunnel, true);
    assert.equal(health.sandisk, false);
    assert.equal(health.status, 'stub');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

it('fails closed for missing configuration, offline tunnel, redirects, stale and malformed responses', async () => {
  assert.equal(await probeMini({}), false);
  for (const response of [new Response('{}'), new Response('bad'), new Response(null, {status: 302}),
    Response.json({ok: true, service: 'primsdrive-mini-hello', sandisk: false, nonce: 'stale'})]) {
    assert.equal(await probeMini({ MINI_PROBE_SECRET: secret, MINI_HELLO: { fetch: async () => response } }), false);
  }
  assert.equal(await probeMini({ MINI_PROBE_SECRET: secret, MINI_HELLO: { fetch: async () => { throw new Error('offline'); } } }), false);
});
