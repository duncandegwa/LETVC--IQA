const prisma = require('../config/db');
const { recordDecision } = require('../services/workflowEngine');
const { logAudit } = require('../services/auditLog');

/**
 * A user's review queue. By construction (see reviewerAssignment.js), this
 * query can never include a document the user uploaded — but we still
 * filter defensively here as a second guard.
 */
async function myQueue(req, res, next) {
  try {
    const assignments = await prisma.reviewAssignment.findMany({
      where: {
        assigneeId: req.user.id,
        decision: 'PENDING',
        document: { uploaderId: { not: req.user.id } }, // defense in depth
      },
      include: { document: { include: { department: true, uploader: true } } },
      orderBy: { assignedAt: 'asc' },
    });
    res.json(assignments);
  } catch (err) { next(err); }
}

async function approve(req, res, next) {
  try {
    const updated = await recordDecision({
      assignmentId: req.params.assignmentId,
      actorId: req.user.id,
      decision: 'APPROVED',
      comment: req.body.comment || null,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

async function reject(req, res, next) {
  try {
    const updated = await recordDecision({
      assignmentId: req.params.assignmentId,
      actorId: req.user.id,
      decision: 'REJECTED',
      comment: req.body.comment,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

async function returnForCorrection(req, res, next) {
  try {
    const updated = await recordDecision({
      assignmentId: req.params.assignmentId,
      actorId: req.user.id,
      decision: 'RETURNED',
      comment: req.body.comment,
    });
    res.json(updated);
  } catch (err) { next(err); }
}

/** Comment-only, without a decision (e.g. a clarifying question mid-review). */
async function comment(req, res, next) {
  try {
    const assignment = req.reviewAssignment;
    await prisma.reviewAssignment.update({
      where: { id: assignment.id },
      data: { comment: req.body.comment },
    });
    await logAudit({
      actorId: req.user.id, documentId: assignment.documentId,
      action: `${assignment.stage}_COMMENT`, metadata: { comment: req.body.comment },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/**
 * GET /api/reviews/history — everything the current user has ALREADY
 * decided on (approved, rejected, or returned), across every document —
 * not just what's currently pending. This is what a HOD/IQA/DP uses to
 * look back at their own review record and re-download anything they've
 * already acted on. Supports optional ?decision= and ?departmentId= filters;
 * sorting is left to the frontend since the result set is typically small
 * per reviewer.
 */
async function myHistory(req, res, next) {
  try {
    const { decision, departmentId } = req.query;
    const where = {
      assigneeId: req.user.id,
      decision: decision ? decision : { not: 'PENDING' },
      document: {
        uploaderId: { not: req.user.id }, // defense in depth
        ...(departmentId ? { departmentId } : {}),
      },
    };
    const assignments = await prisma.reviewAssignment.findMany({
      where,
      include: { document: { include: { department: true, uploader: true } } },
      orderBy: { decidedAt: 'desc' },
    });
    res.json(assignments);
  } catch (err) { next(err); }
}

module.exports = { myQueue, myHistory, approve, reject, returnForCorrection, comment };
