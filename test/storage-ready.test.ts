import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

test('storage readiness preserves authenticated tunnel health in both states', async () => {
  for (const sandisk of [false, true]) {
    const env = { MINI_PROBE_SECRET: 'fixture', MINI_HELLO: {
      async fetch(request: Request) {
        assert.equal(request.headers.get('authorization'), 'Bearer fixture');
        return Response.json({ ok: true, service: 'primsdrive-mini-hello',
          nonce: request.headers.get('x-probe-nonce'), sandisk });
      }
    }};
    const response = await worker.fetch(new Request('https://drive.prims.sh/health'), env);
    const body = await response.json();
    assert.equal(body.tunnel, true);
    assert.equal(body.sandisk, sandisk);
    assert.equal(body.status, sandisk ? 'storage-ready' : 'stub');
  }
});
