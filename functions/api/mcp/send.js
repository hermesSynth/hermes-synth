import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { to, amount, token: tokenType } = await context.request.json();
  if (!to || !amount) return Response.json({ error: 'Recipient and amount required' }, { status: 400 });

  const db = context.env.DB;

  // Verify MCP connection
  let mcp;
  try {
    mcp = await db.prepare('SELECT * FROM mcp_connections WHERE user_id = ? AND status = ?')
      .bind(payload.userId, 'connected').first();
  } catch {
    return Response.json({ error: 'Not connected to Base MCP' }, { status: 400 });
  }

  if (!mcp) return Response.json({ error: 'Not connected to Base MCP. Please connect first.' }, { status: 400 });

  // Generate mock transaction hash
  const hashBytes = new Uint8Array(32);
  crypto.getRandomValues(hashBytes);
  const txHash = '0x' + Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Store transaction
  try {
    await db.prepare(
      'INSERT INTO mcp_transactions (user_id, type, title, detail, amount, token, tx_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      payload.userId,
      'sent',
      `Sent ${tokenType || 'ETH'}`,
      `To: ${to}`,
      -Math.abs(parseFloat(amount)),
      tokenType || 'ETH',
      txHash,
      'confirmed'
    ).run();
  } catch {}

  // In production, this would call mcp.base.org API and return an approvalUrl
  // For demo, simulate a successful send
  return Response.json({
    ok: true,
    txHash,
    amount: parseFloat(amount),
    token: tokenType || 'ETH',
    to,
    network: 'base',
    status: 'confirmed',
    blockExplorer: `https://basescan.org/tx/${txHash}`
  });
}
