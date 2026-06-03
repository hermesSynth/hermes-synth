import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT id, email, name, avatar, bio, plan_tier, max_agents, max_sessions, created_at FROM users WHERE id = ?').bind(payload.userId).first();
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  return Response.json({ user });
}
