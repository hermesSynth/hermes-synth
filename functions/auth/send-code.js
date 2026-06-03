import { hashPassword } from '../lib/auth.js';

export async function onRequestPost(context) {
  try {
    const { email, password, name } = await context.request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const db = context.env.DB;
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) {
      return Response.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Delete old codes for this email
    await db.prepare('DELETE FROM verification_codes WHERE email = ?').bind(email).run();

    // Store code + pending user data
    await db.prepare(
      'INSERT INTO verification_codes (id, email, code, expires_at, used, password_hash, name) VALUES (?, ?, ?, ?, 0, ?, ?)'
    ).bind(id, email, code, expiresAt, passwordHash, name || email.split('@')[0]).run();

    // Send email via Resend
    const resendKey = context.env.RESEND_API_KEY;
    if (!resendKey) {
      return Response.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Hermes Synth <noreply@hermessynth.org>',
        to: [email],
        subject: `${code} — Your Hermes Synth verification code`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 20px; color: #1c1917; margin: 0;">Hermes Synth</h1>
            </div>
            <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 32px; text-align: center;">
              <p style="font-size: 14px; color: #57534e; margin: 0 0 24px;">Your verification code is:</p>
              <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #b8860b; margin: 0 0 24px; font-family: monospace;">${code}</div>
              <p style="font-size: 13px; color: #a8a29e; margin: 0;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
            </div>
            <p style="font-size: 12px; color: #a8a29e; text-align: center; margin-top: 24px;">© 2026 Hermes Synth · hermessynth.org</p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json().catch(() => ({}));
      console.error('Resend error:', JSON.stringify(errData));
      return Response.json({ error: errData.message || 'Failed to send verification email' }, { status: 500 });
    }

    return Response.json({ ok: true, message: 'Verification code sent' });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
