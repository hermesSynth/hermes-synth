import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT plugins FROM users WHERE id = ?').bind(payload.userId).first();
  let plugins = {};
  if (user?.plugins) {
    try { plugins = JSON.parse(user.plugins); } catch {}
  }

  // Default plugin states
  const defaults = {
    venice: true,
    chat: true,
    terminal: true,
    editor: true,
    cron: true,
    browser: true,
    openai: false,
    anthropic: false,
    email: false,
    analytics: false,
    webhooks: false,
  };

  return Response.json({ plugins: { ...defaults, ...plugins } });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { plugin, enabled } = await context.request.json();
  if (!plugin) return Response.json({ error: 'Plugin name required' }, { status: 400 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT plugins FROM users WHERE id = ?').bind(payload.userId).first();
  let plugins = {};
  if (user?.plugins) {
    try { plugins = JSON.parse(user.plugins); } catch {}
  }

  plugins[plugin] = !!enabled;
  await db.prepare('UPDATE users SET plugins = ? WHERE id = ?').bind(JSON.stringify(plugins), payload.userId).run();

  return Response.json({ ok: true, plugin, enabled: !!enabled });
}
