import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const { results } = await db.prepare('SELECT * FROM cron_jobs WHERE user_id = ? ORDER BY created_at DESC').bind(payload.userId).all();
  return Response.json({ jobs: results || [] });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { name, prompt, intervalMinutes } = await context.request.json();
  if (!name || !prompt) return Response.json({ error: 'Name and prompt required' }, { status: 400 });

  const db = context.env.DB;
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO cron_jobs (id, user_id, name, prompt, interval_minutes) VALUES (?, ?, ?, ?, ?)').bind(id, payload.userId, name, prompt, intervalMinutes || 60).run();
  return Response.json({ ok: true, id });
}
