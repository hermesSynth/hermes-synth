import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const { results } = await db.prepare('SELECT * FROM agents WHERE user_id = ? ORDER BY created_at DESC').bind(payload.userId).all();
  return Response.json({ agents: results || [] });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { name, description, systemPrompt, model, tools } = await context.request.json();
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

  const db = context.env.DB;
  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO agents (id, user_id, name, description, system_prompt, model, tools, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, payload.userId, name, description || '', systemPrompt || '', model || 'llama-3.3-70b', JSON.stringify(tools || []), 'active').run();

  return Response.json({ ok: true, agent: { id, name, description: description || '', system_prompt: systemPrompt, model, tools: tools || [], status: 'active' } });
}
