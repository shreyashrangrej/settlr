import { env } from './_generated/server'

const OTP_SUBJECT = 'Your Settlr sign-in code'

// Sends the one-time sign-in code. Uses Resend's HTTP API when
// RESEND_API_KEY is set; otherwise logs the code so local development works
// without an email provider.
export async function sendSignInCode({ to, otp }: { to: string; otp: string }) {
  if (!env.RESEND_API_KEY) {
    console.warn(
      `[auth] RESEND_API_KEY is not set, so the code was not emailed. Sign-in code for ${to}: ${otp}`,
    )
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM ?? 'Settlr <onboarding@resend.dev>',
      to: [to],
      subject: OTP_SUBJECT,
      text: `Your Settlr sign-in code is ${otp}. It expires in 5 minutes.\n\nIf you didn't try to sign in, you can ignore this email.`,
      html: otpHtml(otp),
    }),
  })
  if (!response.ok) {
    throw new Error(
      `Resend rejected the sign-in email (${response.status}): ${await response.text()}`,
    )
  }
}

function otpHtml(otp: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f7f7f5;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1c1a">
    <table role="presentation" width="100%" style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #e3e3de;border-radius:14px">
      <tr><td style="padding:32px">
        <p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#2f6f5e">Settlr</p>
        <p style="margin:0 0 8px;font-size:16px">Your sign-in code:</p>
        <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:8px">${otp}</p>
        <p style="margin:0;font-size:14px;color:#6b6b66">It expires in 5 minutes. If you didn't try to sign in, you can ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`
}
