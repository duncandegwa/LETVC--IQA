const prisma = require('../config/db');
const { sendMail } = require('./email');

async function notify(userId, type, title, body) {
  if (!userId) return null;
  const notification = await prisma.notification.create({
    data: { userId, type, title, body },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.email) {
    // Fire-and-forget; email failures must never break the workflow action
    // that triggered them.
    sendMail(user.email, title, body).catch((err) =>
      console.error('[email] failed to send notification email:', err.message)
    );
  }

  return notification;
}

module.exports = { notify };
