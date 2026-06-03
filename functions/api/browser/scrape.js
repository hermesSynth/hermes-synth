import { verifyJwt, parseCookie } from '../../lib/auth.js';

export async function onRequestPost(context) {
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');
  if (!token) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) return Response.json({ error: 'Invalid token' }, { status: 401 });

  const { url, action } = await context.request.json();
  if (!url) return Response.json({ error: 'URL required' }, { status: 400 });

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HermesCodex/1.0 Bot' } });
    const html = await res.text();

    // Basic text extraction
    const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    // Extract links
    const links = [];
    const linkRegex = /href="(https?:\/\/[^"]+)"/g;
    let m;
    while ((m = linkRegex.exec(html)) && links.length < 20) links.push(m[1]);

    return Response.json({ text, links, status: res.status, url });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
