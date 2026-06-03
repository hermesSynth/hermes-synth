import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { message, type } = await context.request.json();
  if (!message) return Response.json({ error: 'Message required' }, { status: 400 });

  // Generate a simulated signature
  const sigBytes = new Uint8Array(65);
  crypto.getRandomValues(sigBytes);
  const signature = '0x' + Array.from(sigBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  return Response.json({
    ok: true,
    signature,
    type: type || 'personal',
    message,
    signer: 'Base Account (via MCP)'
  });
}
