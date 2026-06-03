import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { name, provider } = await context.request.json();
  const db = context.env.DB;
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO agents (id, user_id, name, system_prompt, model) VALUES (?, ?, ?, ?, ?)')
    .bind(id, payload.userId, name || 'My Agent', 'You are a helpful AI assistant.', 'llama-3.3-70b').run();

  return Response.json({ ok: true, agent: { id, name: name || 'My Agent', status: 'running' } });
}
