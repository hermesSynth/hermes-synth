import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { id } = await context.request.json();
  if (!id) return Response.json({ error: 'Agent ID required' }, { status: 400 });

  const db = context.env.DB;
  await db.prepare('DELETE FROM agents WHERE id = ? AND user_id = ?').bind(id, payload.userId).run();
  await db.prepare('DELETE FROM chat_messages WHERE agent_id = ? AND user_id = ?').bind(id, payload.userId).run();
  return Response.json({ ok: true });
}
