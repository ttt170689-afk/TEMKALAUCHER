// Test-only transport. Never imported by the launcher or included in its runtime.
// The real CI request escaped context routing after window destruction/reload.
// Intercept in the Electron session instead, below renderer/CDP lifetimes. Every HTTP(S) request gets a synthetic reply; there is NO passthrough.
const http = require('node:http');
const assert = require('node:assert/strict');

async function installSmokeNetwork(app, dispatch) {
  const errors = [];
  const server = http.createServer(async (incoming, outgoing) => {
    try {
      const target = new URL(incoming.url, 'http://fixture.invalid').searchParams.get('url');
      if (!target || !/^https?:\/\//.test(target)) throw Error('Invalid smoke fixture target');
      const chunks = []; let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 6 * 1024 * 1024) throw Error('Smoke fixture request exceeds 6 MiB');
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const request = {
        url: () => target, method: () => incoming.method,
        headers: () => incoming.headers,
        postDataJSON: () => body.length ? JSON.parse(body.toString('utf8')) : null,
        postDataBuffer: () => body
      };
      const fulfill = async ({ status = 200, contentType = 'application/json', headers = {}, body = '' }) => {
        assert(!outgoing.headersSent, 'Smoke fixture must respond exactly once');
        outgoing.writeHead(status, {
          'content-type': contentType,
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'access-control-allow-headers': 'authorization, apikey, content-type, x-upsert',
          'cache-control': 'no-store',
          ...headers
        });
        outgoing.end(body);
      };
      if (incoming.method === 'OPTIONS') await fulfill({ status: 204 });
      else await dispatch({ request: () => request, fulfill });
      assert(outgoing.writableEnded, 'Smoke fixture must not fall through to the internet');
    } catch (error) {
      errors.push(String(error.stack || error));
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'content-type': 'application/json' });
      if (!outgoing.writableEnded) outgoing.end('{"message":"Smoke fixture failed"}');
    }
  });
  const close = async () => {
    const closed = new Promise(resolve => server.close(resolve));
    server.closeAllConnections();
    await closed;
  };
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const bridge = `http://127.0.0.1:${server.address().port}/?url=`;
  try {
    await app.evaluate(async ({ session }, bridge) => {
      // Node fetch goes ONLY to our loopback bridge, not to request.url.
      // The original HTTPS URL and Authorization survive without a redirect.
      const handler = async request => {
        const headers = Object.fromEntries(request.headers);
        for (const name of ['host', 'connection', 'content-length', 'transfer-encoding']) delete headers[name];
        const body = ['GET', 'HEAD'].includes(request.method) ? undefined : new Uint8Array(await request.arrayBuffer());
        const reply = await globalThis.fetch(bridge + encodeURIComponent(request.url), {
          method: request.method, headers, body, redirect: 'error', signal: AbortSignal.timeout(15000)
        });
        const responseHeaders = Object.fromEntries(reply.headers);
        for (const name of ['connection', 'keep-alive', 'transfer-encoding']) delete responseHeaders[name];
        const responseBody = [204, 205, 304].includes(reply.status) ? null : await reply.arrayBuffer();
        return new Response(responseBody, { status: reply.status, headers: responseHeaders });
      };
      const protocol = session.defaultSession.protocol;
      await protocol.handle('https', handler);
      await protocol.handle('http', handler);
      if (!await protocol.isProtocolHandled('https') || !await protocol.isProtocolHandled('http')) throw Error('Smoke protocol isolation not installed');
    }, bridge);
  } catch (error) { await close(); throw error; }
  return { close, errors, assertHealthy: () => assert.deepEqual(errors, [], 'Smoke fixture transport errors') };
}
module.exports = { installSmokeNetwork };
