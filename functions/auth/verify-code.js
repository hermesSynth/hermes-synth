import { signJwt, setTokenCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  try {
    const { email, code } = await context.request.json();
    if (!email || !code) {
      return Response.json({ error: 'Email and code required' }, { status: 400 });
    }

    const db = context.env.DB;

    // Find valid code
    const record = await db.prepare(
      'SELECT * FROM verification_codes WHERE email = ? AND code = ? AND used = 0'
    ).bind(email, code).first();

    if (!record) {
      return Response.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Check expiration
    if (new Date(record.expires_at) < new Date()) {
      return Response.json({ error: 'Verification code expired. Please register again.' }, { status: 400 });
    }

    // Check if email already registered (race condition)
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Mark code as used
    await db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').bind(record.id).run();

    // Create user
    const userId = crypto.randomUUID();
    await db.prepare(
      'INSERT INTO users (id, email, name, password_hash, email_verified, plan_tier, max_agents, max_sessions) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
    ).bind(userId, email, record.name || email.split('@')[0], record.password_hash, 'free_trial', 1, 5).run();

    // Sign in
    const token = await signJwt({ userId, email }, context.env.JWT_SECRET || 'hermes-synth-secret');
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
