import { verifyPassword, signJwt, setTokenCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  try {
    const { email, password } = await context.request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    const db = context.env.DB;
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user || !user.password_hash) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = await signJwt({ userId: user.id, email: user.email }, context.env.JWT_SECRET || 'hermes-synth-secret');
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
