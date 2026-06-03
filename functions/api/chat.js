import { verifyJwt, parseCookie } from '../lib/auth.js';
import { migrate } from './_migrate.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { message, agentId, model, history } = await context.request.json();
  if (!message) return Response.json({ error: 'Message required' }, { status: 400 });

  const db = context.env.DB;

  // Get user config
  const user = await db.prepare('SELECT config FROM users WHERE id = ?').bind(payload.userId).first();
  let userConfig = {};
  if (user?.config) try { userConfig = JSON.parse(user.config); } catch {}

  // Get API key — always use platform key for Venice (most reliable)
  let apiKey = context.env.VENICE_API_KEY;
  if (!apiKey) {
    // Fallback to user's personal key if platform key not set
    try {
      const keyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, 'venice').first();
      if (keyRow?.key_value) apiKey = keyRow.key_value;
    } catch {}
  }
  if (!apiKey) {
    return Response.json({ reply: 'AI service not configured. Please contact support.' });
  }

  // Get system prompt from agent or user config
  let systemPrompt = userConfig.systemPrompt || 'You are Synth, an AI assistant powered by Hermes Synth platform. You are helpful, knowledgeable, and concise.';
  if (agentId) {
    const agent = await db.prepare('SELECT system_prompt, name FROM agents WHERE id = ? AND user_id = ?').bind(agentId, payload.userId).first();
    if (agent?.system_prompt) systemPrompt = agent.system_prompt;
  }

  // Use model from request, user config, or default
  const rawModel = model || userConfig.model || 'llama-3.3-70b';
  const temperature = userConfig.temperature ?? 0.7;
  const maxTokens = userConfig.maxTokens || 2048;

  // Parse provider:model format
  let provider = 'venice';
  let useModel = rawModel;
  if (rawModel.includes(':')) {
    const parts = rawModel.split(':');
    provider = parts[0];
    useModel = parts.slice(1).join(':');
  }

  // Get provider-specific API key
  let providerKey = apiKey;
  let apiUrl = 'https://api.venice.ai/api/v1/chat/completions';

  if (provider !== 'venice') {
    const providerKeyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, provider).first();
    if (!providerKeyRow?.key_value) {
      return Response.json({ reply: `No API key configured for ${provider}. Go to API Keys page to add one.` });
    }
    providerKey = providerKeyRow.key_value;

    const urls = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions',
      together: 'https://api.together.xyz/v1/chat/completions',
    };
    apiUrl = urls[provider] || urls.openai;
  }

  // Build messages array with history for context
  const messages = [{ role: 'system', content: systemPrompt }];
  if (history && Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  try {
    let res;
    const fetchWithRetry = async (url, opts, retries = 2) => {
      for (let i = 0; i <= retries; i++) {
        const r = await fetch(url, opts);
        if (r.status === 429 || r.status === 1015) {
          if (i < retries) { await new Promise(ok => setTimeout(ok, 1000 * (i + 1))); continue; }
        }
        return r;
      }
    };

    if (provider === 'anthropic') {
      const anthropicMessages = messages.filter(m => m.role !== 'system');
      res = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HermesSynth/1.0',
          'x-api-key': providerKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: useModel,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: anthropicMessages,
        }),
      });
    } else {
      res = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HermesSynth/1.0',
          Authorization: `Bearer ${providerKey}`,
        },
        body: JSON.stringify({
          model: useModel,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });
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

    let reply;
    if (provider === 'anthropic') {
      reply = data.content?.[0]?.text || 'No response from AI.';
    } else {
      reply = data.choices?.[0]?.message?.content || 'No response from AI.';
    }

    // Save to chat history
    try {
      await db.prepare('INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), payload.userId, 'user', message, new Date().toISOString()).run();
      await db.prepare('INSERT INTO chat_messages (id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), payload.userId, 'assistant', reply, new Date().toISOString()).run();
    } catch {}

    // Track usage
    const promptTokens = data.usage?.prompt_tokens || Math.ceil(message.length / 4);
    const completionTokens = data.usage?.completion_tokens || Math.ceil(reply.length / 4);
    try {
      await migrate(db);
      await db.prepare('INSERT INTO usage_logs (id, user_id, endpoint, model, prompt_tokens, completion_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), payload.userId, 'chat', useModel, promptTokens, completionTokens, new Date().toISOString()).run();
    } catch {}

    return Response.json({ reply, model: useModel });
  } catch (e) {
    return Response.json({ reply: `Error: ${e.message}` });
  }
}
