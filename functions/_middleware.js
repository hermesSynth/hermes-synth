import { verifyJwt } from './lib/auth.js';

const PUBLIC_PATHS = ['/', '/login', '/register', '/logo.png', '/logo.svg', '/landing.html', '/docs', '/roadmap', '/mcp'];
const AUTH_PATHS_PREFIX = '/auth/';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Public paths — always serve
  if (PUBLIC_PATHS.includes(path) || path.startsWith(AUTH_PATHS_PREFIX) || path.endsWith('.css') || path.endsWith('.js') || path.endsWith('.svg') || path.endsWith('.png')) {
    return context.next();
  }

  // Protected pages — check JWT cookie
  const cookie = context.request.headers.get('cookie') || '';
  const token = parseCookie(cookie, 'hermes_token');

  if (!token) {
    return Response.redirect(new URL('/login', context.request.url).toString(), 302);
  }

  const payload = await verifyJwt(token, context.env.JWT_SECRET || 'hermes-synth-secret');
  if (!payload) {
    return Response.redirect(new URL('/login', context.request.url).toString(), 302);
  }

  // Attach user info to request
  context.data = { user: payload };
  return context.next();
}

function parseCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}
