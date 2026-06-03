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
  const url = new URL(context.request.url);
  const type = url.searchParams.get('type') || 'all';

  const exportData = { exported_at: new Date().toISOString(), version: '1.0' };

  if (type === 'all' || type === 'agents') {
    const agents = await db.prepare('SELECT id, name, model, system_prompt, description, created_at FROM agents WHERE user_id = ?').bind(payload.userId).all();
    exportData.agents = agents.results || [];
  }

  if (type === 'all' || type === 'tasks') {
    const tasks = await db.prepare('SELECT id, description, status, steps, created_at FROM tasks WHERE user_id = ?').bind(payload.userId).all();
    exportData.tasks = tasks.results || [];
  }

  if (type === 'all' || type === 'skills') {
    const skills = await db.prepare('SELECT id, name, code, description, created_at FROM skills WHERE user_id = ?').bind(payload.userId).all();
    exportData.skills = skills.results || [];
  }

  if (type === 'all' || type === 'config') {
    const user = await db.prepare('SELECT name, email, bio, config, plugins FROM users WHERE id = ?').bind(payload.userId).first();
    exportData.config = {
      name: user?.name,
      email: user?.email,
      bio: user?.bio,
      settings: user?.config ? JSON.parse(user.config) : {},
      plugins: user?.plugins ? JSON.parse(user.plugins) : {},
    };
  }

  if (type === 'all' || type === 'profiles') {
    const profiles = await db.prepare('SELECT id, name, model, system_prompt, temperature, max_tokens, active, created_at FROM profiles WHERE user_id = ?').bind(payload.userId).all();
    exportData.profiles = profiles.results || [];
  }

  if (type === 'all' || type === 'cron') {
    const cron = await db.prepare('SELECT id, name, schedule, command, enabled, created_at FROM cron_jobs WHERE user_id = ?').bind(payload.userId).all();
    exportData.cron_jobs = cron.results || [];
  }

  if (type === 'all' || type === 'chat') {
    const chat = await db.prepare('SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').bind(payload.userId).all();
    exportData.chat_history = (chat.results || []).reverse();
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="hermes-synth-export-${type}-${Date.now()}.json"`,
    },
  });
}
