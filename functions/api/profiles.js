import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const { results } = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ? ORDER BY created_at DESC').bind(payload.userId).all();

  // If no profiles, return defaults
  if (!results || results.length === 0) {
    return Response.json({ profiles: [
      { id: 'default', name: 'Default Assistant', role: 'General Purpose', system_prompt: 'You are a helpful AI assistant.', active: 1 },
      { id: 'coder', name: 'Code Expert', role: 'Software Engineer', system_prompt: 'You are a senior software engineer. Write clean, well-documented code.', active: 0 },
      { id: 'analyst', name: 'Data Analyst', role: 'Data Analysis', system_prompt: 'You are a data analyst expert. Analyze data, find patterns, and provide insights.', active: 0 },
      { id: 'writer', name: 'Content Writer', role: 'Content Creation', system_prompt: 'You are a professional content writer. Create engaging, well-structured content.', active: 0 },
      { id: 'devops', name: 'DevOps Engineer', role: 'Infrastructure', system_prompt: 'You are a DevOps engineer. Help with CI/CD, containers, cloud infrastructure.', active: 0 },
    ] });
  }

  return Response.json({ profiles: results });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { action, id, name, role, system_prompt, active } = await context.request.json();
  const db = context.env.DB;

  if (action === 'activate') {
    // Deactivate all, activate selected
    await db.prepare('UPDATE user_profiles SET active = 0 WHERE user_id = ?').bind(payload.userId).run();
    if (id) {
      await db.prepare('UPDATE user_profiles SET active = 1 WHERE id = ? AND user_id = ?').bind(id, payload.userId).run();
    }
    return Response.json({ ok: true });
  }

  if (action === 'delete') {
    await db.prepare('DELETE FROM user_profiles WHERE id = ? AND user_id = ?').bind(id, payload.userId).run();
    return Response.json({ ok: true });
  }

  // Create new profile
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });
  const newId = crypto.randomUUID();
  await db.prepare('INSERT INTO user_profiles (user_id, name, role, system_prompt, active) VALUES (?, ?, ?, ?, ?)')
    .bind(payload.userId, name, role || '', system_prompt || '', active ? 1 : 0).run();

  return Response.json({ ok: true, profile: { id: newId, name, role, system_prompt, active: active ? 1 : 0 } });
}
