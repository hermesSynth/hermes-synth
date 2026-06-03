import { verifyJwt, parseCookie } from '../lib/auth.js';
import { migrate } from './_migrate.js';

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const { results } = await db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').bind(payload.userId).all();
  return Response.json({ tasks: results || [] });
}

export async function onRequestPost(context) {
  await migrate(context.env.DB);
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { instruction } = await context.request.json();
  if (!instruction) return Response.json({ error: 'Instruction required' }, { status: 400 });

  const db = context.env.DB;
  const keyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, 'venice').first();
  const apiKey = keyRow?.key_value || context.env.VENICE_API_KEY;

  const id = crypto.randomUUID();

  if (!apiKey) {
    await db.prepare('INSERT INTO tasks (id, user_id, instruction, status, result) VALUES (?, ?, ?, ?, ?)')
      .bind(id, payload.userId, instruction, 'failed', 'No API key configured.').run();
    return Response.json({ task: { id, instruction, status: 'failed', result: 'No API key configured.' } });
  }

  await db.prepare('INSERT INTO tasks (id, user_id, instruction, status) VALUES (?, ?, ?, ?)')
    .bind(id, payload.userId, instruction, 'running').run();

  try {
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [
          { role: 'system', content: 'You are an autonomous AI agent. Break down the task into clear steps, execute each step, and return results. Format your response as:\nStep 1: [description]\nResult: [result]\n\nStep 2: [description]\nResult: [result]\n\n...\n\nFinal Result: [summary]' },
          { role: 'user', content: instruction },
        ],
        max_tokens: 2048,
      }),
    });
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || 'Task completed.';

    await db.prepare('UPDATE tasks SET status = ?, result = ? WHERE id = ?')
      .bind('completed', result, id).run();

    // Create notification
    try {
      await db.prepare('INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), payload.userId, 'task', 'Task Completed', instruction.substring(0, 100), new Date().toISOString()).run();
    } catch {}

    return Response.json({ task: { id, instruction, status: 'completed', result } });
  } catch (e) {
    await db.prepare('UPDATE tasks SET status = ?, result = ? WHERE id = ?')
      .bind('failed', e.message, id).run();

    try {
      await db.prepare('INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), payload.userId, 'task', 'Task Failed', instruction.substring(0, 100), new Date().toISOString()).run();
    } catch {}

    return Response.json({ task: { id, instruction, status: 'failed', result: e.message } });
  }
}
