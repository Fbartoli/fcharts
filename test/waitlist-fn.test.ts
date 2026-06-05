import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/waitlist.ts';

interface Call {
  sql: string;
  args: unknown[];
}

/** A fake D1 that records the prepared SQL + bound args, so we assert on what would be written. */
function mockEnv(throwOnRun = false): { env: { DB: unknown }; calls: Call[] } {
  const calls: Call[] = [];
  const DB = {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...a: unknown[]) {
          bound = a;
          return stmt;
        },
        async run() {
          if (throwOnRun) throw new Error('d1 down');
          calls.push({ sql, args: bound });
          return { success: true };
        },
      };
      return stmt;
    },
  };
  return { env: { DB }, calls };
}

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://x/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// onRequestPost expects { request, env }; the env mock is shaped like the D1 binding it uses.
const call = (request: Request, env: { DB: unknown }) =>
  onRequestPost({ request, env } as unknown as Parameters<typeof onRequestPost>[0]);

test('waitlist: valid email + consent → 200 and exactly one INSERT (email lowercased)', async () => {
  const { env, calls } = mockEnv();
  const res = await call(req({ email: ' Person@Example.COM ', consent: true, source: 'cta' }), env);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO waitlist .* ON CONFLICT\(email\) DO NOTHING/);
  assert.equal(calls[0].args[0], 'person@example.com');
  assert.equal(calls[0].args[1], 'cta');
});

test('waitlist: invalid email → 422, nothing written', async () => {
  const { env, calls } = mockEnv();
  const res = await call(req({ email: 'not-an-email', consent: true }), env);
  assert.equal(res.status, 422);
  assert.equal(calls.length, 0);
});

test('waitlist: missing consent → 422, nothing written', async () => {
  const { env, calls } = mockEnv();
  const res = await call(req({ email: 'a@b.com', consent: false }), env);
  assert.equal(res.status, 422);
  assert.equal(calls.length, 0);
});

test('waitlist: honeypot filled → 200 but nothing written (bot dropped silently)', async () => {
  const { env, calls } = mockEnv();
  const res = await call(req({ email: 'a@b.com', consent: true, company: 'Acme Bots' }), env);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 0);
});

test('waitlist: malformed JSON → 400', async () => {
  const { env } = mockEnv();
  const res = await call(req('}{ not json'), env);
  assert.equal(res.status, 400);
});

test('waitlist: D1 failure → 500 (does not throw out of the handler)', async () => {
  const { env } = mockEnv(true);
  const res = await call(req({ email: 'a@b.com', consent: true }), env);
  assert.equal(res.status, 500);
});

test('waitlist: over-long email rejected → 422', async () => {
  const { env, calls } = mockEnv();
  const res = await call(req({ email: 'x'.repeat(250) + '@b.com', consent: true }), env);
  assert.equal(res.status, 422);
  assert.equal(calls.length, 0);
});
