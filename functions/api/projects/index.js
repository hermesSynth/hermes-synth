import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const { results } = await db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC').bind(payload.userId).all();
  return Response.json({ projects: results || [] });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { name, language } = await context.request.json();
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

  const db = context.env.DB;
  const id = crypto.randomUUID();
  const lang = language || 'javascript';
  await db.prepare('INSERT INTO projects (id, user_id, name, language) VALUES (?, ?, ?, ?)').bind(id, payload.userId, name, lang).run();

  // Create default file
  const defaultContent = lang === 'python' ? '# Hello World\nprint("Hello from Hermes Synth!")' : '// Hello World\nconsole.log("Hello from Hermes Synth!");';
  const defaultFile = lang === 'python' ? 'main.py' : 'index.js';
  await db.prepare('INSERT INTO project_files (project_id, filename, content) VALUES (?, ?, ?)').bind(id, defaultFile, defaultContent).run();

  return Response.json({ ok: true, project: { id, name, language: lang } });
}
