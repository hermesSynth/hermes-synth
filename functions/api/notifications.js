import { verifyJwt, parseCookie } from '../lib/auth.js';
import { migrate } from './_migrate.js';

export async function onRequestGet(context) {
  await migrate(context.env.DB);
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const notifications = await db.prepare(
    'SELECT id, type, title, message, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30'
  ).bind(payload.userId).all();

  const unread = await db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
  ).bind(payload.userId).first();

  return Response.json({ notifications: notifications.results || [], unread: unread?.count || 0 });
}

export async function onRequestPost(context) {
  await migrate(context.env.DB);
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { action, id } = await context.request.json();
  const db = context.env.DB;

  if (action === 'read' && id) {
    await db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').bind(id, payload.userId).run();
    return Response.json({ ok: true });
  }
  if (action === 'read_all') {
    await db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(payload.userId).run();
    return Response.json({ ok: true });
  }
  if (action === 'clear') {
    await db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(payload.userId).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
