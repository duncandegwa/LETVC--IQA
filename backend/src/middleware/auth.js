const admin = require('../config/firebaseAdmin');
const prisma = require('../config/db');

/**
 * Verifies the Firebase ID token sent as `Authorization: Bearer <token>`,
 * then loads the corresponding Postgres profile (role, department
 * assignments, etc. — none of which Firebase knows about) and attaches it
 * to req.user. Downstream RBAC/conflict-of-interest checks rely on
 * req.user.id (the Postgres UUID, not the Firebase UID) being trustworthy,
 * so this is the one place that establishes identity for the rest of the app.
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const idToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: 'Not authenticated' });

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
    if (!user) {
      // Firebase Auth knows this person, but no profile has been created for
      // them in Postgres yet — this normally shouldn't happen, since only
      // the Administrator module creates accounts (in both places, together).
      return res.status(403).json({
        error: 'Your account exists in the identity provider but has no profile in this system. Contact your Administrator.',
        code: 'NO_PROFILE',
      });
    }
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    req.user = user;
    req.firebaseUid = decoded.uid;
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.systemRole !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
