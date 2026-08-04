const prisma = require('../config/db');
const { getUserCapabilities } = require('../services/capabilities');
const { logAudit } = require('../services/auditLog');

/**
 * GET /api/auth/me
 * Called once right after a successful Firebase sign-in (and on app load
 * while a session persists). Firebase already proved who the person is —
 * requireAuth has loaded req.user from Postgres by firebaseUid — so this
 * just hands back the profile plus the role-derived capabilities the
 * frontend uses to pick which dashboards/nav items to show.
 */
async function me(req, res, next) {
  try {
    const caps = await getUserCapabilities(req.user.id);
    res.json({ user: req.user, capabilities: caps, mustChangePassword: req.user.mustChangePassword });
  } catch (err) { next(err); }
}

/**
 * POST /api/auth/complete-password-change
 * The frontend calls Firebase's own updatePassword() directly — this
 * backend never sees or stores the password. Once that succeeds, it calls
 * this endpoint purely to flip the mustChangePassword flag we keep in
 * Postgres (Firebase has no equivalent concept).
 */
async function completePasswordChange(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { mustChangePassword: false },
    });
    await logAudit({ actorId: req.user.id, action: 'PASSWORD_CHANGED' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { me, completePasswordChange };
