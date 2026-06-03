import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { agentId, message } = await context.request.json();
  if (!message) return Response.json({ error: 'Message required' }, { status: 400 });

  const db = context.env.DB;

  let agent = null;
  try {
    agent = agentId ? await db.prepare('SELECT * FROM agents WHERE id = ? AND user_id = ?').bind(agentId, payload.userId).first() : null;
  } catch {}

  const systemPrompt = agent?.system_prompt || 'You are a helpful AI assistant.';
  const model = agent?.model || 'llama-3.3-70b';

  // Always use platform key for Venice (most reliable)
  let apiKey = context.env.VENICE_API_KEY;
  if (!apiKey) {
    try {
      const keyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, 'venice').first();
      if (keyRow?.key_value) apiKey = keyRow.key_value;
    } catch {}
  }
  if (!apiKey) return Response.json({ reply: 'AI service not configured.' });

  try {
    await db.prepare('INSERT INTO chat_messages (user_id, agent_id, role, content) VALUES (?, ?, ?, ?)').bind(payload.userId, agentId || null, 'user', message).run();
  } catch {}

  try {
    let res;
    for (let i = 0; i <= 2; i++) {
      res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HermesSynth/1.0',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
          max_tokens: 1024,
        }),
      });
      if (res.status === 429 || res.status === 1015) {
        if (i < 2) { await new Promise(ok => setTimeout(ok, 1000 * (i + 1))); continue; }
      }
      break;
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch {
      if (text.includes('1015') || text.includes('rate limit')) {
        return Response.json({ reply: 'AI service is busy. Please try again in a few seconds.' });
      }
      return Response.json({ reply: `AI service error: ${text.slice(0, 100)}` });
    }

    if (data.error) {
      return Response.json({ reply: `AI error: ${data.error.message || JSON.stringify(data.error)}` });
    }

    const reply = data.choices?.[0]?.message?.content || 'No response from AI.';
    try {
      await db.prepare('INSERT INTO chat_messages (user_id, agent_id, role, content) VALUES (?, ?, ?, ?)').bind(payload.userId, agentId || null, 'assistant', reply).run();
    } catch {}
    return Response.json({ reply });
  } catch (e) {
    return Response.json({ reply: `Connection error: ${e.message}` });
  }
}
