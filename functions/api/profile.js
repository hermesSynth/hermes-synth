import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT id, email, name, avatar, bio, plan_tier FROM users WHERE id = ?').bind(payload.userId).first();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  return Response.json({ user });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { name, bio, avatar } = await context.request.json();
  const db = context.env.DB;

  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
  if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }

  if (updates.length === 0) return Response.json({ error: 'No fields to update' }, { status: 400 });

  values.push(payload.userId);
  await db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();

  const user = await db.prepare('SELECT id, email, name, avatar, bio, plan_tier FROM users WHERE id = ?').bind(payload.userId).first();
  return Response.json({ ok: true, user });
}
