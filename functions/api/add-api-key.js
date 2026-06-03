import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { provider, key } = await context.request.json();
  if (!provider || !key) return Response.json({ error: 'Provider and key required' }, { status: 400 });

  const db = context.env.DB;
  const id = crypto.randomUUID();
  const masked = key.slice(0, 8) + '...' + key.slice(-4);

  await db.prepare('DELETE FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, provider).run();
  await db.prepare('INSERT INTO api_keys (id, user_id, provider, key_value, masked_key) VALUES (?, ?, ?, ?, ?)').bind(id, payload.userId, provider, key, masked).run();

  return Response.json({ ok: true, maskedKey: masked });
}
