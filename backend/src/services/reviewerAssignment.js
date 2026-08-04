const prisma = require('../config/db');
const { logAudit } = require('./auditLog');
const { notify } = require('./notifications');

const STAGE_TO_DEPT_ROLE = {
  HOD_REVIEW: 'HOD',
  IQA_REVIEW: 'IQA_OFFICER',
  DP_VERIFICATION: 'DP_ACADEMICS',
};

/**
 * Resolves who should review `document` at `stage`.
 *
 * HARD RULE (non-negotiable, see ARCHITECTURE.md §4):
 *   The returned assignee ID is NEVER document.uploaderId.
 *
 * Algorithm:
 *   1. For HOD_REVIEW and IQA_REVIEW: check whether the Administrator has
 *      set an explicit Trainer -> HOD / Trainer -> IQA assignment for this
 *      document's uploader (TrainerReviewerAssignment). If so, and that
 *      assigned reviewer isn't the uploader themself, use them directly —
 *      this is the primary path per spec ("the system admin is the one who
 *      assigns a trainer the HOD/IQA to review his/her documents").
 *   2. Otherwise (no explicit assignment yet, or DP_VERIFICATION which is
 *      department-scoped rather than per-trainer): fall back to the
 *      department-wide capability pool —
 *        a. Find all users with the natural capability for this dept/role.
 *        b. Remove the uploader from that pool.
 *        c. If pool non-empty -> pick the member with the fewest open
 *           (PENDING) assignments (simple workload balancing).
 *        d. If pool empty -> fall back to Administrator-configured
 *           acting/alternate reviewers for the department (again excluding
 *           the uploader).
 *   3. If STILL empty -> no automatic assignment is possible. The document
 *      is marked NEEDS_ADMIN_ASSIGNMENT and the Administrator is notified.
 *      Under no circumstances does this function fall back to the uploader.
 */
async function resolveReviewer(document, stage) {
  const deptRole = STAGE_TO_DEPT_ROLE[stage];

  if (stage === 'HOD_REVIEW' || stage === 'IQA_REVIEW') {
    const link = await prisma.trainerReviewerAssignment.findUnique({
      where: { trainerId: document.uploaderId },
    });
    const explicitId = stage === 'HOD_REVIEW' ? link?.hodId : link?.iqaId;
    if (explicitId && explicitId !== document.uploaderId) {
      return { assigneeId: explicitId, needsAdminAssignment: false, usedActingFallback: false };
    }
  }

  const naturalAssignments = await prisma.departmentAssignment.findMany({
    where: {
      departmentId: document.departmentId,
      role: deptRole,
      isActing: false,
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
  });

  let candidateIds = naturalAssignments
    .map((a) => a.userId)
    .filter((id) => id !== document.uploaderId); // <-- the conflict-of-interest exclusion

  let usedActingFallback = false;

  if (candidateIds.length === 0) {
    const actingAssignments = await prisma.departmentAssignment.findMany({
      where: {
        departmentId: document.departmentId,
        role: deptRole,
        isActing: true,
        OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
      },
    });
    candidateIds = actingAssignments
      .map((a) => a.userId)
      .filter((id) => id !== document.uploaderId);
    usedActingFallback = candidateIds.length > 0;
  }

  if (candidateIds.length === 0) {
    await logAudit({
      actorId: null,
      documentId: document.id,
      action: 'REVIEWER_ASSIGNMENT_FAILED_NO_ELIGIBLE_REVIEWER',
      metadata: { stage, departmentId: document.departmentId },
    });
    return { assigneeId: null, needsAdminAssignment: true, usedActingFallback };
  }

  // Workload balancing: pick whoever currently has the fewest PENDING assignments.
  const openCounts = await prisma.reviewAssignment.groupBy({
    by: ['assigneeId'],
    where: { assigneeId: { in: candidateIds }, decision: 'PENDING' },
    _count: { assigneeId: true },
  });
  const countMap = new Map(candidateIds.map((id) => [id, 0]));
  for (const row of openCounts) countMap.set(row.assigneeId, row._count.assigneeId);

  const assigneeId = [...countMap.entries()].sort((a, b) => a[1] - b[1])[0][0];

  return { assigneeId, needsAdminAssignment: false, usedActingFallback };
}

/**
 * Creates the ReviewAssignment row for a stage, using resolveReviewer(),
 * and notifies the assignee. Called by workflowEngine whenever a document
 * enters a new pending-review status.
 */
async function assignStage(document, stage) {
  const { assigneeId, needsAdminAssignment, usedActingFallback } = await resolveReviewer(
    document,
    stage
  );

  const assignment = await prisma.reviewAssignment.create({
    data: {
      documentId: document.id,
      stage,
      assigneeId, // may be null if needsAdminAssignment
      wasReassignedForConflict: usedActingFallback,
    },
  });

  if (needsAdminAssignment) {
    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'NEEDS_ADMIN_ASSIGNMENT' },
    });
    const admins = await prisma.user.findMany({ where: { systemRole: 'ADMIN' } });
    await Promise.all(
      admins.map((a) =>
        notify(a.id, 'REVIEWER_ASSIGNED', 'Manual reviewer assignment needed', 
          `No eligible reviewer (without conflict of interest) was found for "${document.title}" at ${stage}. Please assign one manually.`)
      )
    );
  } else {
    await notify(
      assigneeId,
      'REVIEWER_ASSIGNED',
      'New document assigned for review',
      `"${document.title}" has been assigned to you for ${stage.replace('_', ' ')}.`
    );
    await logAudit({
      actorId: null,
      documentId: document.id,
      action: 'REVIEWER_ASSIGNED',
      metadata: { stage, assigneeId, usedActingFallback },
    });
  }

  return assignment;
}

module.exports = { resolveReviewer, assignStage };
