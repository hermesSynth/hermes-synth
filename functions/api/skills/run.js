import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { id, code } = await context.request.json();

  const db = context.env.DB;
  const keyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, 'venice').first();
  const apiKey = keyRow?.key_value || context.env.VENICE_API_KEY;

  if (!apiKey) {
    return Response.json({ output: 'No API key configured. Add a Venice AI key in Settings → API Keys.' });
  }

  try {
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [
          { role: 'system', content: 'You are a code execution assistant. Analyze and simulate running the following code. Return the expected output.' },
          { role: 'user', content: `Execute this code and return the output:\n\n${code}` },
        ],
        max_tokens: 1024,
      }),
    });
    const data = await res.json();
    const output = data.choices?.[0]?.message?.content || 'No output.';
    return Response.json({ output });
  } catch (e) {
    return Response.json({ output: `Error: ${e.message}` });
  }
}
