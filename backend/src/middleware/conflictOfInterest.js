const prisma = require('../config/db');
const { getUserCapabilities, canActAsHod, canActAsIqa, canActAsDp } = require('../services/capabilities');

const STAGE_CHECK = {
  HOD_REVIEW: canActAsHod,
  IQA_REVIEW: canActAsIqa,
  DP_VERIFICATION: canActAsDp,
};

/**
 * Guards POST /api/reviews/:assignmentId/* routes. Loads the assignment +
 * document, then enforces — server-side, unconditionally — that:
 *   1. The assignment is actually assigned to req.user (not someone else's queue).
 *   2. req.user did NOT upload the document (the conflict-of-interest rule).
 *   3. req.user genuinely holds the relevant department capability (defense
 *      in depth in case an assignment row was ever created incorrectly).
 *
 * This is intentionally redundant with the exclusion logic in
 * reviewerAssignment.js — that module prevents a bad assignment from being
 * *created*; this module prevents a bad assignment from being *actioned*,
 * even if one somehow existed.
 */
async function requireReviewerAndNotOwner(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const assignment = await prisma.reviewAssignment.findUnique({
      where: { id: assignmentId },
      include: { document: true },
    });
    if (!assignment) return res.status(404).json({ error: 'Review assignment not found' });

    if (assignment.document.uploaderId === req.user.id) {
      return res.status(403).json({
        error: 'You cannot review your own document.',
        code: 'CONFLICT_OF_INTEREST',
      });
    }
    if (assignment.assigneeId !== req.user.id) {
      return res.status(403).json({ error: 'This document is not assigned to you.' });
    }

    const caps = await getUserCapabilities(req.user.id);
    const check = STAGE_CHECK[assignment.stage];
    if (!check(caps, assignment.document.departmentId)) {
      return res.status(403).json({ error: 'You do not hold the required role for this review.' });
    }

    req.reviewAssignment = assignment;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireReviewerAndNotOwner };
