import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT config FROM users WHERE id = ?').bind(payload.userId).first();
  let config = {};
  if (user?.config) {
    try { config = JSON.parse(user.config); } catch {}
  }

  return Response.json({
    model: config.model || 'llama-3.3-70b',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens || 2048,
    systemPrompt: config.systemPrompt || 'You are a helpful AI assistant.',
    topP: config.topP ?? 0.9,
    envVars: config.envVars || [],
    tools: config.tools || ['chat', 'tasks', 'browser', 'terminal'],
  });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const body = await context.request.json();
  const config = JSON.stringify(body);

  const db = context.env.DB;
  await db.prepare('UPDATE users SET config = ? WHERE id = ?').bind(config, payload.userId).run();

  return Response.json({ ok: true });
}
