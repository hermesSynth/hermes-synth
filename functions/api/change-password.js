import { verifyJwt, parseCookie, hashPassword, verifyPassword } from '../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { currentPassword, newPassword } = await context.request.json();
  if (!newPassword) return Response.json({ error: 'New password required' }, { status: 400 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').bind(payload.userId).first();

  if (user?.password_hash && currentPassword) {
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return Response.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, payload.userId).run();
  return Response.json({ ok: true });
}
