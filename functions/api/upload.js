import { verifyJwt, parseCookie } from '../lib/auth.js';
import { migrate } from './_migrate.js';

export async function onRequestPost(context) {
  await migrate(context.env.DB);
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const formData = await context.request.formData();
  const file = formData.get('file');
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const id = crypto.randomUUID();
  const ext = file.name.split('.').pop() || 'bin';
  const mimeType = file.type || 'application/octet-stream';

  const db = context.env.DB;
  await db.prepare(
    'INSERT INTO uploads (id, user_id, filename, mime_type, size, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, payload.userId, file.name, mimeType, file.size, base64, new Date().toISOString()).run();

  // Create notification
  try {
    await db.prepare('INSERT INTO notifications (id, user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), payload.userId, 'upload', 'File Uploaded', `${file.name} (${(file.size/1024).toFixed(1)}KB)`, new Date().toISOString()).run();
  } catch {}

  return Response.json({ ok: true, id, filename: file.name, size: file.size, mime_type: mimeType });
}

export async function onRequestGet(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const db = context.env.DB;
  const files = await db.prepare(
    'SELECT id, filename, mime_type, size, created_at FROM uploads WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(payload.userId).all();

  return Response.json({ files: files.results || [] });
}
