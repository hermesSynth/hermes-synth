import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;

  // Get connection
  let mcp;
  try {
    mcp = await db.prepare('SELECT * FROM mcp_connections WHERE user_id = ?').bind(payload.userId).first();
  } catch {
    return Response.json({ eth: 0, usdc: 0, txCount: 0, activity: [] });
  }

  if (!mcp) {
    return Response.json({ eth: 0, usdc: 0, txCount: 0, activity: [] });
  }

  // Get transactions
  let transactions = [];
  try {
    const txRes = await db.prepare('SELECT * FROM mcp_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
      .bind(payload.userId).all();
    transactions = txRes.results || [];
  } catch {}

  // Calculate balances from transactions
  let ethBalance = 0.5;  // Starting balance for demo
  let usdcBalance = 100;
  for (const tx of transactions) {
    if (tx.token === 'ETH') ethBalance += tx.amount;
    if (tx.token === 'USDC') usdcBalance += tx.amount;
  }

  const activity = transactions.map(tx => ({
    type: tx.type,
    title: tx.title,
    detail: tx.detail || tx.tx_hash || '',
    amount: tx.amount,
    token: tx.token
  }));

  return Response.json({
    eth: Math.max(0, ethBalance),
    usdc: Math.max(0, usdcBalance),
    txCount: transactions.length,
    wallet: mcp.wallet_address,
    network: mcp.network || 'base',
    activity
  });
}
