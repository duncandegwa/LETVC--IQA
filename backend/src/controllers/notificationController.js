const prisma = require('../config/db');
const { notify } = require('../services/notifications');
const { getUserCapabilities } = require('../services/capabilities');
const { logAudit } = require('../services/auditLog');

async function myNotifications(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id }, // can only mark your own
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

const AUDIENCES = ['ALL', 'TRAINERS', 'HOD', 'IQA', 'DP'];

/**
 * POST /api/notifications/broadcast — lets the Administrator or DP
 * Academics send an announcement to a chosen audience: every user, every
 * user holding a specific department role (HOD/IQA/DP), or trainers
 * generally. Restricted to those two roles per spec ("allow the system
 * admin and the DP Academics to make notifications to every user").
 */
async function broadcast(req, res, next) {
  try {
    const isAdmin = req.user.systemRole === 'ADMIN';
    if (!isAdmin) {
      const caps = await getUserCapabilities(req.user.id);
      const isDp = caps && ((caps.dp?.length || 0) + (caps.dpActing?.length || 0) > 0);
      if (!isDp) {
        return res.status(403).json({ error: 'Only the Administrator or DP Academics can send broadcast notifications.' });
      }
    }

    const { audience, title, message } = req.body;
    if (!AUDIENCES.includes(audience)) {
      return res.status(400).json({ error: `audience must be one of: ${AUDIENCES.join(', ')}` });
    }
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    let recipients;
    if (audience === 'ALL' || audience === 'TRAINERS') {
      // "Trainers" here means every active account, since HOD/IQA/DP are
      // also trainers per the spec's core business rule — this reaches
      // everyone who might have a document in flight, review capability or not.
      recipients = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
    } else {
      const roleMap = { HOD: 'HOD', IQA: 'IQA_OFFICER', DP: 'DP_ACADEMICS' };
      const assignments = await prisma.departmentAssignment.findMany({
        where: { role: roleMap[audience] },
        select: { userId: true },
        distinct: ['userId'],
      });
      recipients = assignments.map((a) => ({ id: a.userId }));
    }

    await Promise.all(recipients.map((r) => notify(r.id, 'BROADCAST', title.trim(), message.trim())));

    await logAudit({
      actorId: req.user.id, action: 'BROADCAST_NOTIFICATION_SENT',
      metadata: { audience, title, recipientCount: recipients.length },
    });
    res.status(201).json({ ok: true, recipientCount: recipients.length });
  } catch (err) { next(err); }
}

module.exports = { myNotifications, markRead, markAllRead, broadcast, AUDIENCES };
