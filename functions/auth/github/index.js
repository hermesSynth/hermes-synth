export async function onRequestGet(context) {
  const clientId = context.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response('GitHub OAuth not configured', { status: 503 });
  }
  const url = new URL(context.request.url);
  const redirectUri = `${url.origin}/auth/github/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  return Response.redirect(authUrl, 302);
}
