import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { from, to, amount, txHash } = await context.request.json();
  if (!from || !to || !amount) return Response.json({ error: 'From, to, and amount required' }, { status: 400 });

  const db = context.env.DB;

  // Log the onchain swap transaction
  try {
    await db.prepare(
      'INSERT INTO mcp_transactions (user_id, type, title, detail, amount, token, tx_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(payload.userId, 'swapped', `Swapped ${from} → ${to}`, `${amount} ${from} via Uniswap V3`, -Math.abs(parseFloat(amount)), from, txHash || '', 'confirmed').run();
  } catch {}

  return Response.json({ ok: true });
}
