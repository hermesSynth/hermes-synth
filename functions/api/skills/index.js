import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const { results } = await db.prepare('SELECT * FROM skills WHERE user_id = ? ORDER BY created_at DESC').bind(payload.userId).all();
  return Response.json({ skills: results || [] });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { name, code, trigger } = await context.request.json();
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

  const id = crypto.randomUUID();
  const db = context.env.DB;
  await db.prepare('INSERT INTO skills (id, user_id, name, trigger, code) VALUES (?, ?, ?, ?, ?)')
    .bind(id, payload.userId, name, trigger || 'manual', code || '').run();

  return Response.json({ ok: true, skill: { id, name, trigger: trigger || 'manual', code } });
}
