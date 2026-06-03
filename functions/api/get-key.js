import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const key = context.env.VENICE_API_KEY;
  if (!key) return Response.json({ error: 'No AI key configured' }, { status: 500 });

  return Response.json({ key, provider: 'venice', baseUrl: 'https://api.venice.ai/api/v1' });
}
