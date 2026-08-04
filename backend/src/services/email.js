const nodemailer = require('nodemailer');

// STUB EXTENSION POINT: wire real SMTP credentials via .env. In dev without
// SMTP_HOST set, we log instead of sending so the app runs without a mail
// server configured.
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendMail(to, subject, text) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email:dev-noop] to=${to} subject="${subject}" body="${text}"`);
    return;
  }
  await t.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}

module.exports = { sendMail };
