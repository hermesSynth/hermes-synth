import { verifyJwt, parseCookie, clearTokenCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  await db.prepare('DELETE FROM chat_messages WHERE user_id = ?').bind(payload.userId).run();
  await db.prepare('DELETE FROM agents WHERE user_id = ?').bind(payload.userId).run();
  await db.prepare('DELETE FROM api_keys WHERE user_id = ?').bind(payload.userId).run();
  await db.prepare('DELETE FROM projects WHERE user_id = ?').bind(payload.userId).run();
  await db.prepare('DELETE FROM cron_jobs WHERE user_id = ?').bind(payload.userId).run();
  await db.prepare('DELETE FROM users WHERE id = ?').bind(payload.userId).run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearTokenCookie() },
  });
}
