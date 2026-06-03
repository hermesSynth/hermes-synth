import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { agentId } = await context.request.json();
  const db = context.env.DB;
  const { results } = await db.prepare('SELECT role, content, created_at FROM chat_messages WHERE user_id = ? AND agent_id = ? ORDER BY created_at ASC LIMIT 100').bind(payload.userId, agentId || null).all();
  return Response.json({ history: results || [] });
}
