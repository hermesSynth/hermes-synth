import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;

  const body = await context.request.json();
  const externalWallet = body.wallet;

  // Check if user already has MCP connection
  let mcp = await db.prepare('SELECT * FROM mcp_connections WHERE user_id = ?').bind(payload.userId).first();

  if (mcp && mcp.status === 'connected' && !externalWallet) {
    return Response.json({
      ok: true,
      wallet: mcp.wallet_address,
      status: 'connected',
      message: 'Already connected to Base Account'
    });
  }

  // Use external wallet if provided (from MetaMask), otherwise generate demo address
  let wallet;
  if (externalWallet && /^0x[a-fA-F0-9]{40}$/.test(externalWallet)) {
    wallet = externalWallet;
  } else {
    const walletBytes = new Uint8Array(20);
    crypto.getRandomValues(walletBytes);
    wallet = '0x' + Array.from(walletBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Store connection
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS mcp_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        status TEXT DEFAULT 'connected',
        network TEXT DEFAULT 'base',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS mcp_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        detail TEXT,
        amount REAL DEFAULT 0,
        token TEXT DEFAULT 'ETH',
        tx_hash TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  } catch {}

  try {
    await db.prepare('DELETE FROM mcp_connections WHERE user_id = ?').bind(payload.userId).run();
    await db.prepare('INSERT INTO mcp_connections (user_id, wallet_address, status, network) VALUES (?, ?, ?, ?)')
      .bind(payload.userId, wallet, 'connected', 'base').run();
  } catch (e) {
    return Response.json({ error: 'Failed to save connection: ' + e.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    wallet,
    status: 'connected',
    network: 'base',
    message: 'Connected to Base Account via MCP'
  });
}
