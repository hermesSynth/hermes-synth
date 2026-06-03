export async function onRequestGet(context) {
  const clientId = context.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return new Response('Google OAuth not configured', { status: 503 });
  }
  const url = new URL(context.request.url);
  const redirectUri = `${url.origin}/auth/google/callback`;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&access_type=offline`;
  return Response.redirect(authUrl, 302);
}
