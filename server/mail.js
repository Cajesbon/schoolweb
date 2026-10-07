'use strict';
const nodemailer = require('nodemailer');

let transport; // undefined = not created yet, null = not configured

function getTransport() {
  if (transport !== undefined) return transport;
  if (!process.env.SMTP_HOST) {
    transport = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

// Resolves to 'sent' | 'failed' | 'not_configured'. Never throws.
async function sendMail({ to, subject, text, html, replyTo }) {
  const t = getTransport();
  if (!t) {
    console.warn('[mail] SMTP is not configured, email was not sent.');
    return 'not_configured';
  }
  if (!to) {
    console.warn('[mail] No recipient email is set, email was not sent.');
    return 'not_configured';
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html, replyTo });
    return 'sent';
  } catch (err) {
    console.error('[mail] Failed to send:', err.message);
    return 'failed';
  }
}

module.exports = { sendMail };
