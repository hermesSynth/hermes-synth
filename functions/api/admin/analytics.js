import { verifyJwt, parseCookie } from '../../lib/auth.js';
import { migrate } from '../_migrate.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT email FROM users WHERE id = ?').bind(payload.userId).first();
  const adminEmails = ['admin@hermessynth.org'];
  if (!user || !adminEmails.includes(user.email.toLowerCase())) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  await migrate(db);

  // Total API calls
  const totalCalls = await db.prepare('SELECT COUNT(*) as count FROM usage_logs').first();

  // Total tokens
  const totalTokens = await db.prepare('SELECT COALESCE(SUM(prompt_tokens),0) as prompt, COALESCE(SUM(completion_tokens),0) as completion FROM usage_logs').first();

  // Calls per day (last 14 days)
  const dailyCalls = await db.prepare(`
    SELECT DATE(created_at) as day, COUNT(*) as calls,
           COALESCE(SUM(prompt_tokens),0) as prompt_tokens,
           COALESCE(SUM(completion_tokens),0) as completion_tokens
    FROM usage_logs
    WHERE created_at >= datetime('now', '-14 days')
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `).all();

  // Calls per model
  const modelUsage = await db.prepare(`
    SELECT model, COUNT(*) as calls,
           COALESCE(SUM(prompt_tokens),0) as prompt_tokens,
           COALESCE(SUM(completion_tokens),0) as completion_tokens
    FROM usage_logs
    GROUP BY model
    ORDER BY calls DESC
  `).all();

  // Calls per endpoint
  const endpointUsage = await db.prepare(`
    SELECT endpoint, COUNT(*) as calls
    FROM usage_logs
    GROUP BY endpoint
    ORDER BY calls DESC
  `).all();

  // Chat messages count
  const chatCount = await db.prepare('SELECT COUNT(*) as count FROM chat_messages').first();

  // Active users (last 7 days)
  const activeUsers = await db.prepare(`
    SELECT COUNT(DISTINCT user_id) as count FROM usage_logs
    WHERE created_at >= datetime('now', '-7 days')
  `).first();

  // Total agents
  const agentCount = await db.prepare('SELECT COUNT(*) as count FROM agents').first();

  // Total tasks
  let taskCount = { count: 0 };
  try { taskCount = await db.prepare('SELECT COUNT(*) as count FROM tasks').first(); } catch {}

  return Response.json({
    total_api_calls: totalCalls?.count || 0,
    total_prompt_tokens: totalTokens?.prompt || 0,
    total_completion_tokens: totalTokens?.completion || 0,
    total_tokens: (totalTokens?.prompt || 0) + (totalTokens?.completion || 0),
    total_chat_messages: chatCount?.count || 0,
    active_users_7d: activeUsers?.count || 0,
    total_agents: agentCount?.count || 0,
    total_tasks: taskCount?.count || 0,
    daily: dailyCalls.results || [],
    by_model: modelUsage.results || [],
    by_endpoint: endpointUsage.results || [],
  });
}
