import { hashPassword, signJwt, setTokenCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  try {
    const { email, password, name } = await context.request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    const db = context.env.DB;
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await db.prepare(
      'INSERT INTO users (id, email, name, password_hash, plan_tier, max_agents, max_sessions) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, email, name || email.split('@')[0], passwordHash, 'free_trial', 1, 5).run();

    const token = await signJwt({ userId: id, email }, context.env.JWT_SECRET || 'hermes-synth-secret');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setTokenCookie(token),
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
