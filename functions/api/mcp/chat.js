import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { message, wallet, connected, balances } = await context.request.json();
  if (!message) return Response.json({ error: 'Message required' }, { status: 400 });

  const db = context.env.DB;
  const msg = message.toLowerCase().trim();

  // Balance check — use real balances passed from frontend
  if (msg.includes('balance') || msg.includes('how much') || msg.includes('saldo') || msg.includes('berapa')) {
    if (!connected) return Response.json({ reply: 'Connect your wallet first to check balances. Click "Connect Wallet" above.' });
    const eth = balances?.eth || '0.00';
    const usdc = balances?.usdc || '0.00';
    return Response.json({
      reply: `💰 Your Base Account:\n\n` +
        `ETH: ${eth}\n` +
        `USDC: ${usdc}\n` +
        `Wallet: ${wallet?.slice(0,6)}...${wallet?.slice(-4)}\n` +
        `Network: Base (Chain 8453)\n\n` +
        `What would you like to do? Send, swap, or check DeFi options.`
    });
  }

  // Send tokens
  if (msg.includes('send') || msg.includes('transfer') || msg.includes('kirim')) {
    if (!connected) return Response.json({ reply: 'Connect your wallet first.' });
    const match = msg.match(/(?:send|transfer|kirim)\s+([\d.]+)\s+(\w+)\s+(?:to|ke)\s+(.+)/i);
    if (match) {
      const [, amount, tokenName, recipient] = match;
      return Response.json({
        reply: `📤 Preparing transaction:\n\n` +
          `Amount: ${amount} ${tokenName.toUpperCase()}\n` +
          `To: ${recipient}\n` +
          `Network: Base\n\n` +
          `Opening send dialog — approve in your wallet.`,
        action: 'send',
        params: { amount, token: tokenName.toUpperCase(), to: recipient.trim() }
      });
    }
    return Response.json({
      reply: `📤 To send tokens, type:\n\n` +
        `"Send [amount] [token] to [address]"\n\n` +
        `Examples:\n` +
        `• Send 0.01 ETH to 0x1234...\n` +
        `• Send 50 USDC to vitalik.eth\n` +
        `• Send 1000 USDC to 0xABC...`
    });
  }

  // Swap tokens
  if (msg.includes('swap') || msg.includes('exchange') || msg.includes('trade') || msg.includes('tukar')) {
    if (!connected) return Response.json({ reply: 'Connect your wallet first.' });
    const match = msg.match(/(?:swap|exchange|trade|tukar)\s+([\d.]+)\s+(\w+)\s+(?:to|for|ke)\s+(\w+)/i);
    if (match) {
      const [, amount, from, to] = match;
      return Response.json({
        reply: `🔄 Preparing swap:\n\n` +
          `${amount} ${from.toUpperCase()} → ${to.toUpperCase()}\n` +
          `Route: Uniswap V3 on Base\n\n` +
          `Opening swap dialog — confirm in your wallet.`,
        action: 'swap',
        params: { amount, from: from.toUpperCase(), to: to.toUpperCase() }
      });
    }
    return Response.json({
      reply: `🔄 To swap tokens, type:\n\n` +
        `"Swap [amount] [token] to [token]"\n\n` +
        `Examples:\n` +
        `• Swap 0.1 ETH to USDC\n` +
        `• Swap 100 USDC to ETH\n` +
        `• Swap 0.05 ETH to USDC`
    });
  }

  // Sign message
  if (msg.includes('sign')) {
    const signMatch = msg.match(/sign\s*(?:message)?[:\s]+(.+)/i);
    if (signMatch) {
      return Response.json({
        reply: `✍️ Ready to sign message:\n"${signMatch[1]}"\n\nOpening sign dialog.`,
        action: 'sign',
        params: { message: signMatch[1] }
      });
    }
    return Response.json({
      reply: `✍️ To sign a message, type:\n"Sign message: [your message]"\n\nOr use the Sign button above.`
    });
  }

  // Contract calls
  if (msg.includes('contract') || msg.includes('call')) {
    if (!connected) return Response.json({ reply: 'Connect your wallet first.' });
    return Response.json({
      reply: `📋 To execute a contract call:\n\n` +
        `Use the Contract button above, or provide:\n` +
        `• Contract address\n` +
        `• Function signature (e.g. "transfer(address,uint256)")\n` +
        `• Arguments`
    });
  }

  // Help
  if (msg.includes('help') || msg.includes('what can') || msg.includes('bantuan') || msg.includes('apa bisa')) {
    return Response.json({
      reply: `🤖 Base MCP Agent Commands:\n\n` +
        `💰 "Balance" — check your wallet\n` +
        `📤 "Send 10 USDC to 0x..." — send tokens\n` +
        `🔄 "Swap 0.1 ETH to USDC" — swap tokens\n` +
        `✍️ "Sign message: hello" — sign a message\n` +
        `📋 "Contract" — call smart contract\n` +
        `🔌 "Plugins" — view DeFi plugins\n` +
        `🪙 "USDC" — token info\n\n` +
        `Or just ask me anything about Base blockchain!`
    });
  }

  // Token info
  if (msg.includes('hscodex') || msg.includes('token') || msg.includes('koin')) {
    return Response.json({
      reply: `🪙 $USDC Token:\n\n` +
        `Network: Base (Chain 8453)\n` +
        `Standard: ERC-20\n\n` +
        `You can send, swap, or trade $USDC through Base MCP.`
    });
  }

  // Plugins / DeFi
  if (msg.includes('plugin') || msg.includes('defi') || msg.includes('morpho') || msg.includes('moonwell') || msg.includes('uniswap') || msg.includes('aerodrome') || msg.includes('virtuals') || msg.includes('bankr')) {
    return Response.json({
      reply: `🔌 DeFi Plugins:\n\n` +
        `• Uniswap — Swap tokens on Base\n` +
        `• Aerodrome — Base native DEX\n` +
        `• Morpho — Optimized lending/borrowing\n` +
        `• Moonwell — DeFi lending on Base\n` +
        `• Virtuals — AI agent tokens\n` +
        `• Bankr — Portfolio management\n\n` +
        `All executed onchain with your approval.`
    });
  }

  // Gas / fees
  if (msg.includes('gas') || msg.includes('fee') || msg.includes('biaya')) {
    return Response.json({
      reply: `⛽ Base Gas Info:\n\n` +
        `Base is an L2 — gas fees are very low (~$0.01 per tx).\n` +
        `You need ETH in your wallet to pay for gas.\n\n` +
        `Current gas: ~0.001 gwei (Base L2)`
    });
  }

  // AI-powered response via Venice
  const keyRow = await db.prepare('SELECT key_value FROM api_keys WHERE user_id = ? AND provider = ?').bind(payload.userId, 'venice').first();
  const apiKey = keyRow?.key_value || context.env.VENICE_API_KEY;

  if (apiKey) {
    try {
      const systemPrompt = `You are the Base MCP Agent for Hermes Synth. You help users interact with Base blockchain (Chain 8453) through the Model Context Protocol.

You can help with:
- Checking wallet balances (ETH, USDC, ERC-20 tokens)
- Sending tokens (ETH, USDC, $USDC)
- Swapping tokens via Uniswap/Aerodrome on Base
- Signing messages
- Smart contract interactions
- DeFi protocols: Morpho, Moonwell, Virtuals, Bankr

$USDC token on Base (ERC-20)

User wallet: ${connected ? wallet : 'not connected'}
${balances ? `Balances: ETH ${balances.eth}, USDC ${balances.usdc}` : ''}

Keep responses concise and helpful. Use emoji sparingly. If the user asks to do something, explain clearly what will happen.`;

      const res = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 512
        })
      });

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return Response.json({ reply });
    } catch {}
  }

  return Response.json({
    reply: `🤖 I'm your Base MCP Agent. I can help you:\n\n` +
      `• Check balances — "balance"\n` +
      `• Send tokens — "send 10 USDC to 0x..."\n` +
      `• Swap tokens — "swap 0.1 ETH to USDC"\n` +
      `• Sign messages — "sign message: hello"\n` +
      `• DeFi plugins — "plugins"\n\n` +
      `Type "help" for all commands.`
  });
}
