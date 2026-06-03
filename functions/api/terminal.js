import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { command } = await context.request.json();
  if (!command) return Response.json({ error: 'Command required' }, { status: 400 });

  const cmd = command.trim();
  const lower = cmd.toLowerCase();
  const db = context.env.DB;

  // Built-in commands
  if (lower === 'help') return Response.json({ output: `Available commands:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  help           — Show this help
  ls             — List files
  pwd            — Current directory
  whoami         — Current user info
  date           — Current date/time
  uptime         — System info
  agents         — List your agents
  tasks          — List your tasks
  skills         — List your skills
  clear          — Clear terminal
  
  run <lang>     — Execute code (start typing code after)
  python <code>  — Run Python code
  node <code>    — Run JavaScript code
  bash <code>    — Run Bash script
  
  Supported languages: Python, JavaScript, TypeScript,
  C, C++, Go, Rust, Java, Ruby, PHP, Bash, and 20+ more.
  
  Example:
    python print("hello world")
    node console.log(2+2)
    run rust fn main() { println!("hi"); }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
  if (lower === 'clear') return Response.json({ output: '', clear: true });
  if (lower === 'pwd') return Response.json({ output: '/home/codex/workspace' });
  if (lower === 'date') return Response.json({ output: new Date().toISOString() });
  if (lower === 'uptime') return Response.json({ output: `Edge worker active\nRegion: ${context.request.cf?.colo || 'global'}\nRuntime: Cloudflare Workers V8` });
  if (lower === 'node -v') return Response.json({ output: 'v20.17.0' });
  if (lower === 'python --version' || lower === 'python3 --version') return Response.json({ output: 'Python 3.12.7' });
  if (lower.startsWith('echo ')) return Response.json({ output: cmd.slice(5) });

  // Real data commands
  if (lower === 'whoami') {
    const user = await db.prepare('SELECT name, email, plan_tier FROM users WHERE id = ?').bind(payload.userId).first();
    return Response.json({ output: `user: ${user?.name || 'Unknown'}\nemail: ${user?.email}\nplan: ${user?.plan_tier || 'free'}\nid: ${payload.userId}` });
  }
  if (lower === 'ls' || lower === 'ls -la') {
    const { results: projects } = await db.prepare('SELECT name FROM projects WHERE user_id = ? LIMIT 10').bind(payload.userId).all();
    const { results: agents } = await db.prepare('SELECT name FROM agents WHERE user_id = ? LIMIT 10').bind(payload.userId).all();
    let output = 'drwxr-xr-x  codex  agents/\ndrwxr-xr-x  codex  projects/\n-rw-r--r--  codex  README.md\n-rw-r--r--  codex  package.json\n';
    if (agents && agents.length > 0) output += '\nagents/:\n' + agents.map(a => `  ${a.name}/`).join('\n');
    if (projects && projects.length > 0) output += '\n\nprojects/:\n' + projects.map(p => `  ${p.name}/`).join('\n');
    return Response.json({ output });
  }
  if (lower === 'agents' || lower === 'agents list') {
    const { results } = await db.prepare('SELECT name, model, status FROM agents WHERE user_id = ?').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No agents found. Create one at /agents' });
    return Response.json({ output: results.map(a => `${a.status === 'active' ? '●' : '○'} ${a.name} (${a.model})`).join('\n') });
  }
  if (lower === 'tasks' || lower === 'tasks list') {
    const { results } = await db.prepare('SELECT instruction, status FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No tasks found. Create one at /tasks' });
    return Response.json({ output: results.map(t => `[${t.status}] ${t.instruction.slice(0, 60)}`).join('\n') });
  }
  if (lower === 'skills' || lower === 'skills list') {
    const { results } = await db.prepare('SELECT name, trigger FROM skills WHERE user_id = ? LIMIT 10').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No skills found. Create one at /skills' });
    return Response.json({ output: results.map(s => `● ${s.name} (${s.trigger})`).join('\n') });
  }
  if (lower === 'languages' || lower === 'langs') {
    return Response.json({ output: `Supported languages:
  python, javascript, typescript, bash, c, c++, go, rust,
  java, ruby, php, swift, kotlin, scala, haskell, lua,
  perl, r, crystal, elixir, erlang, nim, zig, julia, d` });
  }

  // Code execution via Wandbox
  const execResult = await tryExecuteCode(cmd);
  if (execResult) return Response.json({ output: execResult });

  // Fallback: AI-powered terminal
  const keyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, 'venice').first();
  const apiKey = keyRow?.key_value || context.env.VENICE_API_KEY;
  if (!apiKey) {
    return Response.json({ output: `$ ${cmd}\nCommand not recognized. Type 'help' for available commands.` });
  }

  try {
    const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: [
          { role: 'system', content: 'You are a Linux terminal emulator. The user types shell commands and you respond with realistic terminal output. Be concise, respond exactly like a real terminal would. Do not add explanations. Keep responses short and terminal-like.' },
          { role: 'user', content: cmd },
        ],
        max_tokens: 512,
      }),
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Command not recognized.';
    return Response.json({ output: reply });
  } catch {
    return Response.json({ output: `$ ${cmd}\nError: Service unavailable. Try again.` });
  }
}

// Language detection and code execution
async function tryExecuteCode(cmd) {
  const compilerMap = {
    python: 'cpython-3.12.7',
    python3: 'cpython-3.12.7',
    py: 'cpython-3.12.7',
    node: 'nodejs-20.17.0',
    javascript: 'nodejs-20.17.0',
    js: 'nodejs-20.17.0',
    typescript: 'typescript-5.6.2',
    ts: 'typescript-5.6.2',
    bash: 'bash',
    sh: 'bash',
    c: 'gcc-head',
    gcc: 'gcc-head',
    'c++': 'gcc-head',
    cpp: 'gcc-head',
    'g++': 'gcc-head',
    go: 'go-1.23.2',
    golang: 'go-1.23.2',
    rust: 'rust-1.82.0',
    rs: 'rust-1.82.0',
    java: 'openjdk-jdk-22+36',
    ruby: 'ruby-4.0.2',
    rb: 'ruby-4.0.2',
    php: 'php-8.3.12',
    swift: 'swift-6.0.1',
    lua: 'lua-5.4.7',
    perl: 'perl-5.42.0',
    r: 'r-4.4.1',
    crystal: 'crystal-1.13.3',
    elixir: 'elixir-1.17.3',
    haskell: 'ghc-9.10.1',
    nim: 'nim-2.2.10',
    zig: 'zig-head',
    julia: 'julia-1.10.5',
    scala: 'scala-3.5.1',
  };

  const lower = cmd.toLowerCase();

  // Pattern: `run <lang> <code>` or `run <lang>\n<code>`
  const runMatch = cmd.match(/^run\s+(\w+)\s+([\s\S]+)$/i);
  if (runMatch) {
    const lang = runMatch[1].toLowerCase();
    const code = runMatch[2];
    const compiler = compilerMap[lang];
    if (compiler) {
      return await executeOnWandbox(compiler, code);
    }
    return `Error: Unsupported language '${runMatch[1]}'. Type 'languages' to see supported languages.`;
  }

  // Pattern: `python <code>`, `node <code>`, etc.
  for (const [prefix, compiler] of Object.entries(compilerMap)) {
    // Match commands like: python print("hello")
    const regex = new RegExp(`^${prefix.replace('+', '\\+')}\\s+(.+)$`, 'is');
    const match = cmd.match(regex);
    if (match && match[1] && !match[1].startsWith('-')) {
      return await executeOnWandbox(compiler, match[1]);
    }
  }

  // Detect code blocks (multiline with obvious code patterns)
  if (cmd.includes('```')) {
    const codeMatch = cmd.match(/```(\w+)?\n?([\s\S]+?)```/);
    if (codeMatch) {
      const lang = (codeMatch[1] || 'python').toLowerCase();
      const code = codeMatch[2].trim();
      const compiler = compilerMap[lang] || 'cpython-3.12.7';
      return await executeOnWandbox(compiler, code);
    }
  }

  return null; // Not a code execution command
}

async function executeOnWandbox(compiler, code) {
  try {
    const res = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, compiler }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return `Compiler error: ${text.slice(0, 200)}`;
    }

    let output = '';
    if (data.compiler_error) output += data.compiler_error + '\n';
    if (data.program_output) output += data.program_output;
    if (data.program_error) output += data.program_error;
    if (!output.trim()) {
      if (data.status === '0') output = '(no output)';
      else output = `Exit code: ${data.status || 'error'}`;
    }
    return output.trim();
  } catch (e) {
    return `Execution error: ${e.message}`;
  }
}
