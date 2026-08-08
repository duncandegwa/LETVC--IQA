const prisma = require('../config/db');

async function logAudit({ actorId = null, documentId = null, action, metadata = null }) {
  return prisma.auditLog.create({
    data: { actorId, documentId, action, metadata: metadata || undefined },
  });
}

module.exports = { logAudit };
