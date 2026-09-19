import { logger } from './logger.js'

const SCHEME = process.env.APP_SCHEME ?? 'prime'

export async function sendViaResend({ to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text
    })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend returned ${res.status}: ${body}`)
  }
  return res.json()
}

export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.EMAIL_API_KEY) {
    logger.info('[email] DEV MODE - email not delivered (paste the code in the mobile app)', {
      to,
      subject,
      text
    })
    return { dev: true, to, subject }
  }
  return sendViaResend({ to, subject, html, text })
}

export async function sendVerificationEmail({ to, token }) {
  const deepLink = `${SCHEME}://auth/verify-email?token=${encodeURIComponent(token)}`
  const text = [
    'Welcome to PRIME.',
    'Open the PRIME app and paste this verification code:',
    token,
    `Or tap this link on the device where PRIME is installed: ${deepLink}`
  ].join('\n')
  const html = `<p>Welcome to PRIME.</p><p>Open the PRIME app and paste this verification code:</p><p><strong>${token}</strong></p><p><a href="${deepLink}">Open in PRIME</a></p>`
  return sendEmail({
    to,
    subject: 'Verify your PRIME account',
    html,
    text
  })
}

export async function sendPasswordResetEmail({ to, token }) {
  const deepLink = `${SCHEME}://auth/reset-password?token=${encodeURIComponent(token)}`
  const text = [
    'You requested a password reset for your PRIME account.',
    'Open the PRIME app, go to Reset password, and paste this code:',
    token,
    `Or tap this link on the device where PRIME is installed: ${deepLink}`,
    'This code expires in 30 minutes.'
  ].join('\n')
  const html = `<p>You requested a password reset for your PRIME account.</p><p>Open the PRIME app and paste this code:</p><p><strong>${token}</strong></p><p><a href="${deepLink}">Open in PRIME</a></p><p>This code expires in 30 minutes.</p>`
  return sendEmail({
    to,
    subject: 'Reset your PRIME password',
    html,
    text
  })
}
