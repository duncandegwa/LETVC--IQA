const crypto = require('crypto');
const prisma = require('../config/db');
const { logAudit } = require('../services/auditLog');
const { scanFile, generateFileKey } = require('../middleware/upload');
const storage = require('../services/storage');
const { submitForReview } = require('../services/workflowEngine');
const { stampSubmission } = require('../services/pdfStamper');
const { getUserCapabilities } = require('../services/capabilities');

function fileHashOf(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Who is allowed to preview/download a document, at ANY stage of its
 * lifecycle — not just while it happens to be sitting in their queue.
 * This is deliberately broader than "the person currently assigned to
 * review it": the uploader, anyone who has ever been assigned to review it
 * (so a HOD can still open a document after they've already approved it),
 * every Administrator, and — since the review chain for a department is a
 * standing group of stakeholders, not a one-time queue — anyone currently
 * holding an HOD/IQA/DP capability (natural or acting) for the document's
 * own department. It intentionally does NOT extend to every user in the
 * system: a Trainer in another department has no legitimate reason to open
 * a document from a department they have no role in.
 */
async function userCanAccessDocument(user, document) {
  if (user.systemRole === 'ADMIN') return true;
  if (document.uploaderId === user.id) return true;

  const wasEverAssigned = await prisma.reviewAssignment.findFirst({
    where: { documentId: document.id, assigneeId: user.id },
  });
  if (wasEverAssigned) return true;

  const caps = await getUserCapabilities(user.id);
  if (!caps) return false;
  const deptId = document.departmentId;
  return (
    caps.hod.includes(deptId) || caps.hodActing.includes(deptId) ||
    caps.iqa.includes(deptId) || caps.iqaActing.includes(deptId) ||
    caps.dp.includes(deptId) || caps.dpActing.includes(deptId)
  );
}

async function uploadDocument(req, res, next) {
  try {
    const { type, title, departmentId, academicYear, semester, submitNow } = req.body;
    if (!req.file) return res.status(400).json({ error: 'A PDF file is required' });

    const scan = await scanFile(req.file.buffer);
    if (!scan.clean) {
      return res.status(400).json({ error: 'File failed the security scan' });
    }

    const document = await prisma.document.create({
      data: {
        type, title, departmentId, academicYear, semester,
        uploaderId: req.user.id, status: 'DRAFT', currentVersionNo: 1,
      },
    });

    const fileKey = generateFileKey(req.file.originalname);
    await storage.save(fileKey, req.file.buffer);
    await prisma.documentVersion.create({
      data: {
        documentId: document.id, versionNo: 1,
        fileUrl: fileKey, fileHash: fileHashOf(req.file.buffer),
      },
    });

    await logAudit({ actorId: req.user.id, documentId: document.id, action: 'DOCUMENT_UPLOADED' });

    // Immediately append the uploader's own name/date/signature ("Submitted
    // by", in blue) — this happens on every upload, independent of whether
    // it's submitted for review right away or left as a draft first.
    await stampSubmission(document.id, req.user.id);

    let result = document;
    if (submitNow === 'true' || submitNow === true) {
      result = await submitForReview(document.id, req.user.id);
    }

    res.status(201).json(result);
  } catch (err) { next(err); }
}

/** Replace the file for an existing document the user owns (creates a new version). */
async function uploadNewVersion(req, res, next) {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUniqueOrThrow({ where: { id } });
    if (document.uploaderId !== req.user.id) {
      return res.status(403).json({ error: 'Only the original uploader can replace this file' });
    }
    if (!req.file) return res.status(400).json({ error: 'A PDF file is required' });

    const scan = await scanFile(req.file.buffer);
    if (!scan.clean) {
      return res.status(400).json({ error: 'File failed the security scan' });
    }

    const fileKey = generateFileKey(req.file.originalname);
    await storage.save(fileKey, req.file.buffer);

    const nextVersionNo = document.currentVersionNo + 1;
    await prisma.documentVersion.create({
      data: {
        documentId: id, versionNo: nextVersionNo,
        fileUrl: fileKey, fileHash: fileHashOf(req.file.buffer),
      },
    });
    const updated = await prisma.document.update({
      where: { id }, data: { currentVersionNo: nextVersionNo },
    });

    await logAudit({ actorId: req.user.id, documentId: id, action: 'DOCUMENT_VERSION_REPLACED' });
    res.json(updated);
  } catch (err) { next(err); }
}

async function submit(req, res, next) {
  try {
    const document = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
    if (document.uploaderId !== req.user.id) {
      return res.status(403).json({ error: 'Only the uploader can submit this document' });
    }
    const updated = await submitForReview(document.id, req.user.id);
    res.json(updated);
  } catch (err) { next(err); }
}

async function myDocuments(req, res, next) {
  try {
    const documents = await prisma.document.findMany({
      where: { uploaderId: req.user.id },
      include: { department: true, reviews: { include: { assignee: true }, orderBy: { assignedAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(documents);
  } catch (err) { next(err); }
}

/**
 * GET /api/documents/approved — lets DP Academics (or an Administrator)
 * browse and download every fully-approved document, filtered by
 * department, by trainer, or by which IQA Officer processed it. This is
 * broader than userCanAccessDocument's per-document check: it's a
 * department-spanning report, available only to DP-capable users.
 */
async function listApprovedDocuments(req, res, next) {
  try {
    const caps = await getUserCapabilities(req.user.id);
    const isDp = req.user.systemRole === 'ADMIN' ||
      (caps && ((caps.dp?.length || 0) + (caps.dpActing?.length || 0) > 0));
    if (!isDp) {
      return res.status(403).json({ error: 'Only DP Academics (or an Administrator) can browse approved documents this way.' });
    }

    const { departmentId, trainerId, iqaOfficerId } = req.query;
    const where = { status: 'APPROVED' };
    if (departmentId) where.departmentId = departmentId;
    if (trainerId) where.uploaderId = trainerId;
    if (iqaOfficerId) {
      where.reviews = { some: { stage: 'IQA_REVIEW', assigneeId: iqaOfficerId, decision: 'APPROVED' } };
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        department: true, uploader: true,
        reviews: { include: { assignee: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(documents);
  } catch (err) { next(err); }
}

async function getDocument(req, res, next) {
  try {
    const document = await prisma.document.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        department: true, uploader: true, versions: { orderBy: { versionNo: 'desc' } },
        reviews: { include: { assignee: true }, orderBy: { assignedAt: 'asc' } },
      },
    });

    if (!(await userCanAccessDocument(req.user, document))) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }

    // isOwnDocument / canReview flags let the frontend render correctly
    // without making its own access-control decisions (see ARCHITECTURE.md §4.4).
    const isOwnDocument = document.uploaderId === req.user.id;
    const myPendingAssignment = document.reviews.find(
      (r) => r.assigneeId === req.user.id && r.decision === 'PENDING'
    );

    res.json({
      ...document,
      isOwnDocument,
      canReview: Boolean(myPendingAssignment) && !isOwnDocument,
      myPendingAssignmentId: myPendingAssignment?.id || null,
    });
  } catch (err) { next(err); }
}

async function downloadLatest(req, res, next) {
  try {
    const document = await prisma.document.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
    });
    if (!(await userCanAccessDocument(req.user, document))) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }
    const version = document.versions[0];
    if (!version) return res.status(404).json({ error: 'No file available' });

    const buffer = await storage.load(version.fileUrl);
    await logAudit({ actorId: req.user.id, documentId: document.id, action: 'DOCUMENT_DOWNLOADED' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.title}.pdf"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

/**
 * Same access rule and same file as downloadLatest, but streamed inline
 * (Content-Disposition: inline) so the browser/PDF.js can render it in a
 * viewer tab instead of forcing a save-to-disk prompt — this is what
 * "preview at any stage" uses on the frontend.
 */
async function previewLatest(req, res, next) {
  try {
    const document = await prisma.document.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } },
    });
    if (!(await userCanAccessDocument(req.user, document))) {
      return res.status(403).json({ error: 'You do not have access to this document.' });
    }
    const version = document.versions[0];
    if (!version) return res.status(404).json({ error: 'No file available' });

    const buffer = await storage.load(version.fileUrl);
    await logAudit({ actorId: req.user.id, documentId: document.id, action: 'DOCUMENT_PREVIEWED' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${document.title}.pdf"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = {
  uploadDocument, uploadNewVersion, submit, myDocuments, getDocument, downloadLatest, previewLatest,
  listApprovedDocuments, userCanAccessDocument,
};
