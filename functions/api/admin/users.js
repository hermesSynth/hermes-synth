import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  // Check if admin (first registered user or specific email)
  const db = context.env.DB;
  const user = await db.prepare('SELECT email FROM users WHERE id = ?').bind(payload.userId).first();
  const adminEmails = ['admin@hermessynth.org'];
  if (!user || !adminEmails.includes(user.email.toLowerCase())) {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Get all users with agent count
  const usersWithAgents = await db.prepare(`
    SELECT u.id, u.name, u.email, u.oauth_provider, u.plan_tier, u.created_at,
           COUNT(a.id) as agent_count
    FROM users u
    LEFT JOIN agents a ON u.id = a.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  const all = usersWithAgents.results || [];
  const withAgents = all.filter(u => u.agent_count > 0);
  const onlyRegistered = all.filter(u => u.agent_count === 0);

  // Stats only — no PII
  const agentStats = withAgents.map((u, i) => ({
    user: `User #${i + 1}`,
    agents: u.agent_count,
    plan: u.plan_tier || 'free_trial',
  }));

  return Response.json({
    total_users: all.length,
    users_with_agents: withAgents.length,
    users_only_registered: onlyRegistered.length,
    agent_breakdown: agentStats,
  });
}
