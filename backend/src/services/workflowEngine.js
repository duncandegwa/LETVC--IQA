const prisma = require('../config/db');
const { assignStage } = require('./reviewerAssignment');
const { logAudit } = require('./auditLog');
const { notify } = require('./notifications');
const { stampApprovalPdf } = require('./pdfStamper');

// A document can never skip a stage. This table is the single source of
// truth for what transition is legal from a given status; every mutation
// route must go through transition() rather than writing document.status
// directly.
const ALLOWED_TRANSITIONS = {
  DRAFT: ['PENDING_HOD_REVIEW'],
  PENDING_HOD_REVIEW: ['RETURNED_BY_HOD', 'PENDING_IQA_REVIEW'],
  RETURNED_BY_HOD: ['PENDING_HOD_REVIEW'],
  PENDING_IQA_REVIEW: ['RETURNED_BY_IQA', 'PENDING_DP_VERIFICATION'],
  RETURNED_BY_IQA: ['PENDING_IQA_REVIEW'],
  PENDING_DP_VERIFICATION: ['RETURNED_BY_DP', 'APPROVED'],
  RETURNED_BY_DP: ['PENDING_DP_VERIFICATION'],
  APPROVED: ['ARCHIVED'],
  ARCHIVED: [],
  NEEDS_ADMIN_ASSIGNMENT: ['PENDING_HOD_REVIEW', 'PENDING_IQA_REVIEW', 'PENDING_DP_VERIFICATION'],
};

function assertLegalTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    const err = new Error(`Illegal workflow transition: ${from} -> ${to}`);
    err.status = 409;
    throw err;
  }
}

/** Trainer submits a DRAFT (or resubmits a RETURNED_*) document. */
async function submitForReview(documentId, actorId) {
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  const nextStatus =
    document.status === 'RETURNED_BY_HOD' ? 'PENDING_HOD_REVIEW'
    : document.status === 'RETURNED_BY_IQA' ? 'PENDING_IQA_REVIEW'
    : document.status === 'RETURNED_BY_DP' ? 'PENDING_DP_VERIFICATION'
    : 'PENDING_HOD_REVIEW'; // DRAFT -> first stage

  assertLegalTransition(document.status, nextStatus);

  const stageForStatus = {
    PENDING_HOD_REVIEW: 'HOD_REVIEW',
    PENDING_IQA_REVIEW: 'IQA_REVIEW',
    PENDING_DP_VERIFICATION: 'DP_VERIFICATION',
  }[nextStatus];

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { status: nextStatus },
  });

  await assignStage(updated, stageForStatus);
  await logAudit({ actorId, documentId, action: 'DOCUMENT_SUBMITTED', metadata: { nextStatus } });
  await notify(actorId, 'DOCUMENT_SUBMITTED', 'Document submitted', `"${document.title}" was submitted for review.`);

  return updated;
}

/**
 * Records a reviewer's decision for a given ReviewAssignment and advances
 * (or returns) the workflow accordingly. This is the ONLY function allowed
 * to mutate a ReviewAssignment's decision — callers (controllers) must have
 * already verified, via middleware/conflictOfInterest.js, that the actor is
 * the assignee AND is not the document owner before calling this.
 */
async function recordDecision({ assignmentId, actorId, decision, comment }) {
  const assignment = await prisma.reviewAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { document: true },
  });

  if (assignment.decision !== 'PENDING') {
    const err = new Error('This review has already been decided.');
    err.status = 409;
    throw err;
  }

  // Defense in depth (see ARCHITECTURE.md §4.3): re-verify even though the
  // assignment should structurally never target the owner.
  if (assignment.document.uploaderId === actorId) {
    const err = new Error('You cannot review your own document.');
    err.status = 403;
    throw err;
  }
  if (assignment.assigneeId !== actorId) {
    const err = new Error('This document is not assigned to you for review.');
    err.status = 403;
    throw err;
  }

  await prisma.reviewAssignment.update({
    where: { id: assignmentId },
    data: { decision, comment, decidedAt: new Date() },
  });

  const document = assignment.document;
  let nextStatus;
  let notifyTrainerMsg;

  if (decision === 'REJECTED' || decision === 'RETURNED') {
    nextStatus = {
      HOD_REVIEW: 'RETURNED_BY_HOD',
      IQA_REVIEW: 'RETURNED_BY_IQA',
      DP_VERIFICATION: 'RETURNED_BY_DP',
    }[assignment.stage];
    notifyTrainerMsg = `Your document "${document.title}" was returned${comment ? `: ${comment}` : '.'}`;
  } else if (decision === 'APPROVED') {
    if (assignment.stage === 'HOD_REVIEW') {
      nextStatus = 'PENDING_IQA_REVIEW';
      notifyTrainerMsg = `"${document.title}" was approved by the HOD and sent for IQA review.`;
      await stampApprovalPdf(document.id, { stage: 'HOD', reviewerId: actorId });
    } else if (assignment.stage === 'IQA_REVIEW') {
      nextStatus = 'PENDING_DP_VERIFICATION';
      notifyTrainerMsg = `"${document.title}" was approved by IQA and sent for DP verification.`;
      await stampApprovalPdf(document.id, { stage: 'IQA', reviewerId: actorId });
    } else if (assignment.stage === 'DP_VERIFICATION') {
      nextStatus = 'APPROVED';
      notifyTrainerMsg = `"${document.title}" has been fully approved.`;
      await stampApprovalPdf(document.id, { stage: 'DP', reviewerId: actorId });
    }
  }

  assertLegalTransition(document.status, nextStatus);

  const updatedDoc = await prisma.document.update({
    where: { id: document.id },
    data: { status: nextStatus },
  });

  // If the new status is itself a pending-review status, assign the next stage.
  const nextStageMap = {
    PENDING_HOD_REVIEW: 'HOD_REVIEW',
    PENDING_IQA_REVIEW: 'IQA_REVIEW',
    PENDING_DP_VERIFICATION: 'DP_VERIFICATION',
  };
  if (nextStageMap[nextStatus]) {
    await assignStage(updatedDoc, nextStageMap[nextStatus]);
  }

  await logAudit({
    actorId,
    documentId: document.id,
    action: `${assignment.stage}_${decision}`,
    metadata: { comment },
  });
  await notify(document.uploaderId, 'RETURNED', 'Document status update', notifyTrainerMsg);

  return updatedDoc;
}

module.exports = { ALLOWED_TRANSITIONS, assertLegalTransition, submitForReview, recordDecision };
