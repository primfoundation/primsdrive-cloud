import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function helloServer(secret: string) {
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error('Expected a 32-byte hex probe secret');
  const expected = Buffer.from(`Bearer ${secret}`);
  return createServer({ requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 4096 }, (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('content-type', 'application/json');
    const supplied = Buffer.from(req.headers.authorization ?? '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.writeHead(401).end('{"ok":false}'); return;
    }
    if (req.url !== '/hello') { res.writeHead(404).end('{"ok":false}'); return; }
    if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }).end('{"ok":false}'); return; }
    const nonce = req.headers['x-probe-nonce'];
    if (typeof nonce !== 'string' || !/^[a-f0-9-]{36}$/.test(nonce)) {
      res.writeHead(400).end('{"ok":false}'); return;
    }
    res.end(JSON.stringify({ ok: true, service: 'primsdrive-mini-hello', sandisk: false, nonce }));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const secretPath = process.env.PRIMSDRIVE_PROBE_SECRET_FILE;
  if (!secretPath) throw new Error('PRIMSDRIVE_PROBE_SECRET_FILE is required');
  const server = helloServer(readFileSync(secretPath, 'utf8').trim());
  // Never accept a configurable interface: this service must remain private.
  server.listen(18746, '127.0.0.1');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}
