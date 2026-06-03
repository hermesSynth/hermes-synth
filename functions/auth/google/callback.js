import { signJwt, setTokenCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  if (!code) {
    return Response.redirect(`${url.origin}/login?error=Google+login+cancelled`, 302);
  }

  try {
    const clientId = context.env.GOOGLE_CLIENT_ID;
    const clientSecret = context.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${url.origin}/auth/google/callback`;

    // Exchange code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return Response.redirect(`${url.origin}/login?error=Google+auth+failed`, 302);
    }

    // Fetch user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await userRes.json();

    // Find or create user
    const db = context.env.DB;
    let user = await db.prepare('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?').bind('google', profile.id).first();
    if (!user) {
      user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(profile.email).first();
      if (user) {
        await db.prepare('UPDATE users SET oauth_provider = ?, oauth_id = ?, avatar = ? WHERE id = ?').bind('google', profile.id, profile.picture || null, user.id).run();
      }
    }
    if (!user) {
      const id = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO users (id, email, name, oauth_provider, oauth_id, avatar, plan_tier, max_agents, max_sessions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, profile.email, profile.name || profile.email.split('@')[0], 'google', profile.id, profile.picture || null, 'free_trial', 1, 5).run();
      user = { id, email: profile.email };
    }

    const token = await signJwt({ userId: user.id, email: user.email || profile.email }, context.env.JWT_SECRET || 'hermes-synth-secret');
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
