/**
 * Cloudflare Pages Function — `POST /api/waitlist`.
 *
 * Stores a waitlist signup in D1 (SQLite). Runs on the Workers runtime; Cloudflare/Wrangler
 * compiles this file, so it is intentionally outside the library's app build. Zero dependencies:
 * the small slice of the D1 API we use is described by local interfaces (no @cloudflare/workers-types).
 *
 * Behaviour: validates the email, requires consent, drops honeypot-tripping bots silently, and
 * upserts (ON CONFLICT DO NOTHING) so resubmits don't error. Never echoes the stored data back.
 */

interface D1Result {
  success: boolean;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Env {
  DB: D1Database;
}
interface Ctx {
  request: Request;
  env: Env;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function onRequestPost(ctx: Ctx): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await ctx.request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  // Honeypot: a real person never fills "company" (it's offscreen + aria-hidden). Accept silently
  // so bots get no signal that they were caught — but store nothing.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return json({ ok: true }, 200);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: 'Enter a valid email address.' }, 422);
  }
  if (body.consent !== true) {
    return json({ error: 'Consent is required.' }, 422);
  }

  const source = String(body.source ?? 'unknown').slice(0, 32);
  const ua = (ctx.request.headers.get('user-agent') ?? '').slice(0, 256);

  try {
    await ctx.env.DB.prepare(
      'INSERT INTO waitlist (email, source, user_agent) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING',
    )
      .bind(email, source, ua)
      .run();
  } catch {
    return json({ error: 'Could not save right now. Please try again.' }, 500);
  }

  return json({ ok: true }, 200);
}
