import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const user = await db.prepare('SELECT plan_tier FROM users WHERE id = ?').bind(payload.userId).first();
  const { results } = await db.prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(payload.userId).all();

  // Calculate balance from transactions
  let balance = 100; // Free trial credits
  if (results) {
    for (const tx of results) {
      balance += tx.amount;
    }
  }

  return Response.json({
    balance,
    plan: user?.plan_tier || 'free',
    transactions: results || [],
  });
}

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { type, amount, description } = await context.request.json();
  if (!type || amount === undefined) return Response.json({ error: 'Type and amount required' }, { status: 400 });

  const db = context.env.DB;
  await db.prepare('INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)')
    .bind(payload.userId, type, amount, description || '').run();

  return Response.json({ ok: true });
}
