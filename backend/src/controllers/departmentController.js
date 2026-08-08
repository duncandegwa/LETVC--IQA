const prisma = require('../config/db');
const { logAudit } = require('../services/auditLog');

async function listDepartments(req, res, next) {
  try {
    const departments = await prisma.department.findMany({
      include: { assignments: { include: { user: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  } catch (err) { next(err); }
}

async function createDepartment(req, res, next) {
  try {
    const { name, code } = req.body;
    const department = await prisma.department.create({ data: { name, code } });
    await logAudit({ actorId: req.user.id, action: 'DEPARTMENT_CREATED', metadata: { departmentId: department.id } });
    res.status(201).json(department);
  } catch (err) { next(err); }
}

/**
 * Admin assigns a user to a HOD / IQA_OFFICER / DP_ACADEMICS capability for
 * a department, optionally as an `isActing` (delegated/alternate) reviewer.
 * This is the ONLY place these assignments are created — it is what the
 * conflict-of-interest engine reads from.
 */
async function createAssignment(req, res, next) {
  try {
    const { departmentId } = req.params;
    const { userId, role, isActing = false } = req.body;

    if (!['HOD', 'IQA_OFFICER', 'DP_ACADEMICS'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const assignment = await prisma.departmentAssignment.create({
      data: { departmentId, userId, role, isActing },
    });
    await logAudit({
      actorId: req.user.id,
      action: 'DEPARTMENT_ASSIGNMENT_CREATED',
      metadata: { departmentId, userId, role, isActing },
    });
    res.status(201).json(assignment);
  } catch (err) { next(err); }
}

async function endAssignment(req, res, next) {
  try {
    const { assignmentId } = req.params;
    await prisma.departmentAssignment.update({
      where: { id: assignmentId },
      data: { endDate: new Date() },
    });
    await logAudit({ actorId: req.user.id, action: 'DEPARTMENT_ASSIGNMENT_ENDED', metadata: { assignmentId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { listDepartments, createDepartment, createAssignment, endAssignment };
