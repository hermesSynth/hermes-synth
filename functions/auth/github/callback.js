import { signJwt, setTokenCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  if (!code) {
    return Response.redirect(`${url.origin}/login?error=GitHub+login+cancelled`, 302);
  }

  try {
    const clientId = context.env.GITHUB_CLIENT_ID;
    const clientSecret = context.env.GITHUB_CLIENT_SECRET;

    // Exchange code for token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return Response.redirect(`${url.origin}/login?error=GitHub+auth+failed`, 302);
    }

    // Fetch user info
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'HermesCodex/1.0' },
    });
    const profile = await userRes.json();

    // Fetch email if not public
    let email = profile.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'HermesCodex/1.0' },
      });
      const emails = await emailsRes.json();
      const primary = emails.find(e => e.primary) || emails[0];
      email = primary ? primary.email : `${profile.login}@github.local`;
    }

    // Find or create user
    const db = context.env.DB;
    let user = await db.prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?').bind('github', String(profile.id)).first();
    if (!user) {
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
      if (user) {
        await db.prepare('UPDATE users SET oauth_provider = ?, oauth_id = ?, avatar = ? WHERE id = ?').bind('github', String(profile.id), profile.avatar_url || null, user.id).run();
      }
    }
    if (!user) {
      const id = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO users (id, email, name, oauth_provider, oauth_id, avatar, plan_tier, max_agents, max_sessions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, email, profile.name || profile.login, 'github', String(profile.id), profile.avatar_url || null, 'free_trial', 1, 5).run();
      user = { id, email };
    }

    const token = await signJwt({ userId: user.id, email: user.email || email }, context.env.JWT_SECRET || 'hermes-synth-secret');
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/chat',
        'Set-Cookie': setTokenCookie(token),
      },
    });
  } catch (e) {
    return Response.redirect(`${url.origin}/login?error=${encodeURIComponent(e.message)}`, 302);
  }
}
