import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { projectId, action, filename, content } = await context.request.json();
  if (!projectId) return Response.json({ error: 'Project ID required' }, { status: 400 });

  const db = context.env.DB;

  // Verify project ownership
  const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').bind(projectId, payload.userId).first();
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  if (action === 'list') {
    const { results } = await db.prepare('SELECT filename, content FROM project_files WHERE project_id = ?').bind(projectId).all();
    return Response.json({ files: results || [] });
  }

  if (action === 'save') {
    if (!filename) return Response.json({ error: 'Filename required' }, { status: 400 });
    const existing = await db.prepare('SELECT id FROM project_files WHERE project_id = ? AND filename = ?').bind(projectId, filename).first();
    if (existing) {
      await db.prepare('UPDATE project_files SET content = ? WHERE project_id = ? AND filename = ?').bind(content || '', projectId, filename).run();
    } else {
      await db.prepare('INSERT INTO project_files (project_id, filename, content) VALUES (?, ?, ?)').bind(projectId, filename, content || '').run();
    }
    return Response.json({ ok: true });
  }

  if (action === 'read') {
    if (!filename) return Response.json({ error: 'Filename required' }, { status: 400 });
    const file = await db.prepare('SELECT content FROM project_files WHERE project_id = ? AND filename = ?').bind(projectId, filename).first();
    return Response.json({ content: file?.content || '' });
  }

  if (action === 'create') {
    if (!filename) return Response.json({ error: 'Filename required' }, { status: 400 });
    await db.prepare('INSERT INTO project_files (project_id, filename, content) VALUES (?, ?, ?)').bind(projectId, filename, content || '').run();
    return Response.json({ ok: true });
  }

  if (action === 'delete') {
    if (!filename) return Response.json({ error: 'Filename required' }, { status: 400 });
    await db.prepare('DELETE FROM project_files WHERE project_id = ? AND filename = ?').bind(projectId, filename).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}
