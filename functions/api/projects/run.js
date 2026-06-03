import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { projectId, filename } = await context.request.json();
  if (!projectId || !filename) return Response.json({ error: 'Project ID and filename required' }, { status: 400 });

  const db = context.env.DB;
  const project = await db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').bind(projectId, payload.userId).first();
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });

  const file = await db.prepare('SELECT content FROM project_files WHERE project_id = ? AND filename = ?').bind(projectId, filename).first();
  if (!file) return Response.json({ error: 'File not found' }, { status: 404 });

  const code = file.content || '';
  const lang = project.language || detectLanguage(filename);

  const keyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, 'venice').first();
  const apiKey = keyRow?.key_value || context.env.VENICE_API_KEY;

  if (!apiKey) {
    return Response.json({ output: `${lang} execution requires Venice AI API key.\nAdd one in Settings → API Keys.`, exitCode: 1 });
  }

  try {
    const systemPrompts = {
      javascript: 'You are a JavaScript runtime. Execute the given JavaScript code and return ONLY the console output. Do not explain the code. Show the exact output that console.log/console.error would produce. If there is an error, show the error message.',
      python: 'You are a Python interpreter. Execute the given Python code and return ONLY the output. Do not explain the code. Show the exact terminal output. If there is an error, show the Python traceback.',
      html: 'You are a web browser. Analyze the given HTML/CSS code and describe what it would render visually. Be concise.',
    };
    const systemPrompt = systemPrompts[lang] || `You are a ${lang} interpreter. Execute the given code and return ONLY the output. Do not explain. Show the exact output.`;

    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: code },
        ],
        max_tokens: 1024,
        temperature: 0,
      }),
    });
    const data = await res.json();
    const output = data.choices?.[0]?.message?.content || 'No output';
    return Response.json({ output, exitCode: 0 });
  } catch {
    return Response.json({ output: `Could not execute ${lang} code. AI service unavailable.`, exitCode: 1 });
  }
}

function detectLanguage(filename) {
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.js') || filename.endsWith('.mjs')) return 'javascript';
  if (filename.endsWith('.ts')) return 'typescript';
  if (filename.endsWith('.html') || filename.endsWith('.htm')) return 'html';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.md')) return 'markdown';
  if (filename.endsWith('.sh') || filename.endsWith('.bash')) return 'bash';
  if (filename.endsWith('.rb')) return 'ruby';
  if (filename.endsWith('.go')) return 'go';
  if (filename.endsWith('.rs')) return 'rust';
  if (filename.endsWith('.java')) return 'java';
  if (filename.endsWith('.c') || filename.endsWith('.cpp')) return 'c/c++';
  return 'text';
}
