import { verifyJwt, parseCookie } from '../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { command } = await context.request.json();
  if (!command) return Response.json({ error: 'Command required' }, { status: 400 });

  let cmd = command.trim().toLowerCase();
  if (cmd.startsWith('hermes ')) cmd = cmd.slice(7);
  if (cmd.startsWith('codex ')) cmd = cmd.slice(6);

  const db = context.env.DB;

  if (cmd === 'help') {
    return Response.json({ output: `Hermes Synth CLI v1.0.0\n\nCommands:\n  status            — System status & stats\n  whoami            — Current user info\n  agents            — List all agents\n  agents count      — Count agents\n  tasks             — List recent tasks\n  skills            — List skills\n  cron              — List cron jobs\n  keys              — List API keys\n  config            — Show saved config\n  plugins           — Show plugin states\n  models            — List available AI models\n  wallet            — Show wallet balance\n  stats             — Full account stats\n  logs              — Recent activity\n  ping              — Test connectivity\n  version           — Show version\n  help              — This help message` });
  }

  if (cmd === 'status') {
    const user = await db.prepare('SELECT name, plan_tier FROM users WHERE id = ?').bind(payload.userId).first();
    const agentCount = await db.prepare('SELECT COUNT(*) as c FROM agents WHERE user_id = ?').bind(payload.userId).first();
    const taskCount = await db.prepare('SELECT COUNT(*) as c FROM tasks WHERE user_id = ?').bind(payload.userId).first();
    const skillCount = await db.prepare('SELECT COUNT(*) as c FROM skills WHERE user_id = ?').bind(payload.userId).first();
    const keyCount = await db.prepare('SELECT COUNT(*) as c FROM api_keys WHERE user_id = ?').bind(payload.userId).first();
    return Response.json({ output: `Hermes Synth v1.0.0\n━━━━━━━━━━━━━━━━━━━━\nStatus:    Running ✓\nUser:      ${user?.name || 'Unknown'}\nPlan:      ${user?.plan_tier || 'free'}\nAgents:    ${agentCount?.c || 0}\nTasks:     ${taskCount?.c || 0}\nSkills:    ${skillCount?.c || 0}\nAPI Keys:  ${keyCount?.c || 0}\nPlatform:  Cloudflare Workers\nDatabase:  D1 (SQLite)\nRegion:    ${context.request.cf?.colo || 'Global'}` });
  }

  if (cmd === 'whoami') {
    const user = await db.prepare('SELECT email, name, plan_tier, bio, created_at FROM users WHERE id = ?').bind(payload.userId).first();
    return Response.json({ output: `Name:    ${user?.name || 'Unknown'}\nEmail:   ${user?.email}\nPlan:    ${user?.plan_tier || 'free'}\nBio:     ${user?.bio || '(not set)'}\nJoined:  ${user?.created_at || 'Unknown'}\nID:      ${payload.userId}` });
  }

  if (cmd === 'agents' || cmd === 'agents list') {
    const { results } = await db.prepare('SELECT name, model, status, description, created_at FROM agents WHERE user_id = ? ORDER BY created_at DESC').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No agents found.\nCreate one: /agents → Create Agent' });
    const list = results.map(a => `  ${a.status === 'active' ? '● ACTIVE' : '○ IDLE  '} ${a.name}\n           Model: ${a.model}\n           ${a.description || ''}`).join('\n\n');
    return Response.json({ output: `Your Agents (${results.length}):\n━━━━━━━━━━━━━━━━━━━━\n${list}` });
  }

  if (cmd === 'agents count') {
    const c = await db.prepare('SELECT COUNT(*) as c FROM agents WHERE user_id = ?').bind(payload.userId).first();
    return Response.json({ output: `Total agents: ${c?.c || 0}` });
  }

  if (cmd === 'tasks' || cmd === 'tasks list') {
    const { results } = await db.prepare('SELECT instruction, status, created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No tasks found.\nCreate one: /tasks → New Task' });
    const list = results.map(t => `  [${t.status.toUpperCase().padEnd(10)}] ${t.instruction.slice(0, 50)}`).join('\n');
    return Response.json({ output: `Recent Tasks (${results.length}):\n━━━━━━━━━━━━━━━━━━━━\n${list}` });
  }

  if (cmd === 'skills' || cmd === 'skills list') {
    const { results } = await db.prepare('SELECT name, trigger, description FROM skills WHERE user_id = ? LIMIT 10').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No skills found.\nCreate one: /skills → New Skill' });
    const list = results.map(s => `  ● ${s.name} (trigger: ${s.trigger})\n    ${s.description || ''}`).join('\n');
    return Response.json({ output: `Your Skills (${results.length}):\n━━━━━━━━━━━━━━━━━━━━\n${list}` });
  }

  if (cmd === 'cron' || cmd === 'cron list') {
    const { results } = await db.prepare('SELECT name, prompt, interval_minutes, active FROM cron_jobs WHERE user_id = ? LIMIT 10').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No cron jobs found.\nCreate one: /cron → New Job' });
    const list = results.map(j => `  ${j.active ? '● ACTIVE' : '○ PAUSED'} ${j.name}\n           Every ${j.interval_minutes}min — ${j.prompt.slice(0, 40)}`).join('\n\n');
    return Response.json({ output: `Cron Jobs (${results.length}):\n━━━━━━━━━━━━━━━━━━━━\n${list}` });
  }

  if (cmd === 'keys' || cmd === 'keys list') {
    const { results } = await db.prepare('SELECT provider, masked_key FROM api_keys WHERE user_id = ?').bind(payload.userId).all();
    if (!results || results.length === 0) return Response.json({ output: 'No API keys configured.\nAdd one: /env → Add Key' });
    const list = results.map(k => `  ● ${k.provider.padEnd(12)} ${k.masked_key}`).join('\n');
    return Response.json({ output: `API Keys (${results.length}):\n━━━━━━━━━━━━━━━━━━━━\n${list}` });
  }

  if (cmd === 'config' || cmd === 'config show') {
    const user = await db.prepare('SELECT config, plan_tier, max_agents, max_sessions FROM users WHERE id = ?').bind(payload.userId).first();
    let config = {};
    if (user?.config) try { config = JSON.parse(user.config); } catch {}
    return Response.json({ output: `Configuration:\n━━━━━━━━━━━━━━━━━━━━\n  model:        ${config.model || 'llama-3.3-70b'}\n  temperature:  ${config.temperature ?? 0.7}\n  max_tokens:   ${config.maxTokens || 2048}\n  system_prompt: ${(config.systemPrompt || 'Default assistant').slice(0, 40)}...\n  plan:         ${user?.plan_tier || 'free'}\n  max_agents:   ${user?.max_agents || 3}\n  max_sessions: ${user?.max_sessions || 5}\n  tools:        ${(config.tools || ['chat','terminal','browser','code']).join(', ')}` });
  }

  if (cmd === 'plugins' || cmd === 'plugins list') {
    const user = await db.prepare('SELECT plugins FROM users WHERE id = ?').bind(payload.userId).first();
    let plugins = { venice: true, chat: true, terminal: true, editor: true, cron: true, browser: true };
    if (user?.plugins) try { plugins = { ...plugins, ...JSON.parse(user.plugins) }; } catch {}
    const list = Object.entries(plugins).map(([k, v]) => `  ${v ? '✓ ON ' : '✗ OFF'} ${k}`).join('\n');
    return Response.json({ output: `Plugins:\n━━━━━━━━━━━━━━━━━━━━\n${list}` });
  }

  if (cmd === 'models' || cmd === 'models list') {
    return Response.json({ output: `Available Models:\n━━━━━━━━━━━━━━━━━━━━\n  ● llama-3.3-70b      Meta Llama 3.3 (70B)\n  ● llama-3.1-405b     Meta Llama 3.1 (405B)\n  ● deepseek-r1-671b   DeepSeek R1 (671B)\n  ● qwen-2.5-vl        Qwen 2.5 Vision-Language\n\nProvider: Venice AI` });
  }

  if (cmd === 'wallet' || cmd === 'balance') {
    const { results } = await db.prepare('SELECT amount FROM wallet_transactions WHERE user_id = ?').bind(payload.userId).all();
    let balance = 100;
    if (results) for (const tx of results) balance += tx.amount;
    return Response.json({ output: `Wallet:\n━━━━━━━━━━━━━━━━━━━━\n  Balance:      ${balance.toFixed(2)} credits\n  Transactions: ${results?.length || 0}` });
  }

  if (cmd === 'stats') {
    const user = await db.prepare('SELECT name, email, plan_tier, created_at FROM users WHERE id = ?').bind(payload.userId).first();
    const agentCount = await db.prepare('SELECT COUNT(*) as c FROM agents WHERE user_id = ?').bind(payload.userId).first();
    const taskCount = await db.prepare('SELECT COUNT(*) as c FROM tasks WHERE user_id = ?').bind(payload.userId).first();
    const skillCount = await db.prepare('SELECT COUNT(*) as c FROM skills WHERE user_id = ?').bind(payload.userId).first();
    const cronCount = await db.prepare('SELECT COUNT(*) as c FROM cron_jobs WHERE user_id = ?').bind(payload.userId).first();
    const keyCount = await db.prepare('SELECT COUNT(*) as c FROM api_keys WHERE user_id = ?').bind(payload.userId).first();
    const msgCount = await db.prepare('SELECT COUNT(*) as c FROM chat_messages WHERE user_id = ?').bind(payload.userId).first();
    return Response.json({ output: `Account Stats:\n━━━━━━━━━━━━━━━━━━━━\n  User:         ${user?.name}\n  Email:        ${user?.email}\n  Plan:         ${user?.plan_tier || 'free'}\n  Joined:       ${user?.created_at || 'Unknown'}\n  Agents:       ${agentCount?.c || 0}\n  Tasks:        ${taskCount?.c || 0}\n  Skills:       ${skillCount?.c || 0}\n  Cron Jobs:    ${cronCount?.c || 0}\n  API Keys:     ${keyCount?.c || 0}\n  Messages:     ${msgCount?.c || 0}` });
  }

  if (cmd === 'ping') {
    return Response.json({ output: `pong ✓\nEdge: ${context.request.cf?.colo || 'unknown'}\nLatency: <10ms (edge)` });
  }

  if (cmd === 'version') {
    return Response.json({ output: 'Hermes Synth v1.0.0\nBuild: cloudflare-workers\nRuntime: V8 Isolate\nDatabase: D1 (SQLite)' });
  }

  if (cmd === 'logs' || cmd.startsWith('logs')) {
    const { results } = await db.prepare('SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').bind(payload.userId).all();
    let output = `Recent Activity:\n━━━━━━━━━━━━━━━━━━━━\n`;
    if (results && results.length > 0) {
      output += results.map(m => `  [${m.created_at}] ${m.role}: ${m.content.slice(0, 50)}...`).join('\n');
    } else {
      output += '  No recent activity.';
    }
    return Response.json({ output });
  }

  return Response.json({ output: `Unknown command: ${command}\nType 'help' for available commands.` });
}
