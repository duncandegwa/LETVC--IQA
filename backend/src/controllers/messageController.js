const prisma = require('../config/db');
const { userCanAccessDocument } = require('./documentController');
const { notify } = require('../services/notifications');
const { logAudit } = require('../services/auditLog');

/**
 * GET /api/documents/:id/messages — the full discussion thread for a
 * document. Same access rule as preview/download (userCanAccessDocument):
 * the uploader, anyone ever assigned to review it, the department's
 * review-chain roles, and Administrators. This is deliberately the same
 * stakeholder set — if you can see the document, you can see and join its
 * discussion.
 */
async function listMessages(req, res, next) {
  try {
    const document = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
    if (!(await userCanAccessDocument(req.user, document))) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }
    const messages = await prisma.message.findMany({
      where: { documentId: document.id },
      include: { sender: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (err) { next(err); }
}

/**
 * POST /api/documents/:id/messages — post a message (a chat message, or a
 * reply to a reviewer's comment — the thread doesn't distinguish the two,
 * since a reply IS just the next message). Notifies every OTHER
 * stakeholder who has actually participated in the document so far (the
 * uploader plus anyone ever assigned to review it), so a trainer's reply
 * reaches their reviewer and vice versa, without spamming the whole
 * department's review-chain roles for every message.
 */
async function postMessage(req, res, next) {
  try {
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message cannot be empty' });

    const document = await prisma.document.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { reviews: true },
    });
    if (!(await userCanAccessDocument(req.user, document))) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }

    const message = await prisma.message.create({
      data: { documentId: document.id, senderId: req.user.id, body: body.trim() },
      include: { sender: true },
    });

    const recipientIds = new Set([document.uploaderId, ...document.reviews.map((r) => r.assigneeId).filter(Boolean)]);
    recipientIds.delete(req.user.id);
    await Promise.all(
      [...recipientIds].map((uid) =>
        notify(uid, 'NEW_MESSAGE', `New message on "${document.title}"`, `${req.user.fullName}: ${body.trim()}`)
      )
    );

    await logAudit({ actorId: req.user.id, documentId: document.id, action: 'MESSAGE_POSTED' });
    res.status(201).json(message);
  } catch (err) { next(err); }
}

module.exports = { listMessages, postMessage };
