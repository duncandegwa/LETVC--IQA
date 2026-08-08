const prisma = require('../config/db');
const admin = require('../config/firebaseAdmin');
const { logAudit } = require('../services/auditLog');
const { notify } = require('../services/notifications');
const { getUserCapabilities } = require('../services/capabilities');
const { generateFileKey } = require('../middleware/upload');
const storage = require('../services/storage');

// Every new account — and every admin-triggered password reset — starts
// with this same known password. Security still comes from
// mustChangePassword forcing a change on first login (and from Profile.jsx
// now also letting a user change it any time afterward), not from secrecy
// of the starting password itself.
const DEFAULT_PASSWORD = 'Changeme@1';
function generateTempPassword() {
  return DEFAULT_PASSWORD;
}

async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      include: { deptAssignments: { include: { department: true } }, primaryDepartment: true },
      orderBy: { fullName: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
}

/**
 * Creates BOTH the Firebase Auth account (identity + credential) and the
 * Postgres profile (role, department, everything Firebase doesn't know
 * about) in one call, keyed together by firebaseUid. If the Postgres write
 * fails after the Firebase account was created, we clean up the Firebase
 * side too, so the two stores never drift out of sync into a half-created
 * account a person can log into but that has no profile.
 */
async function createUser(req, res, next) {
  let firebaseUser = null;
  try {
    const { fullName, staffNumber, email, phone, designation, primaryDepartmentId } = req.body;
    const tempPassword = generateTempPassword();

    firebaseUser = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: fullName,
      disabled: false,
    });

    const user = await prisma.user.create({
      data: {
        firebaseUid: firebaseUser.uid,
        fullName, staffNumber, email, phone, designation, primaryDepartmentId,
        mustChangePassword: true,
      },
    });

    await logAudit({ actorId: req.user.id, action: 'USER_CREATED', metadata: { userId: user.id } });
    await notify(user.id, 'ACCOUNT_CREATED', 'Welcome to the Laikipia East TVC IQA System',
      `Your account has been created. Temporary password: ${tempPassword}. You will be required to change it on first login.`);

    // Returned once so the Administrator can hand it over securely if email
    // isn't configured yet — never retrievable again after this response.
    res.status(201).json({ ...user, tempPassword });
  } catch (err) {
    if (firebaseUser) {
      // Roll back the Firebase account so a failed Postgres write doesn't
      // leave an orphaned login with no corresponding profile/role.
      await admin.auth().deleteUser(firebaseUser.uid).catch(() => {});
    }
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { fullName, phone, designation, primaryDepartmentId, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id },
      data: { fullName, phone, designation, primaryDepartmentId, isActive },
    });

    // Keep Firebase's own record (used for display name, and disabled-state
    // enforcement at the identity layer) in step with Postgres.
    if (fullName) {
      await admin.auth().updateUser(user.firebaseUid, { displayName: fullName }).catch(() => {});
    }

    await logAudit({ actorId: req.user.id, action: 'USER_UPDATED', metadata: { userId: id } });
    res.json(user);
  } catch (err) { next(err); }
}

/**
 * Deactivation/reactivation happens at BOTH layers: Postgres (so RBAC checks
 * everywhere in this app stop treating them as active) and Firebase itself
 * (`disabled: true`, so their existing session tokens stop working and they
 * can't sign back in at all — the identity provider enforces it, not just
 * this app's own logic).
 */
async function deactivateUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({ where: { id }, data: { isActive: false } });
    await admin.auth().updateUser(user.firebaseUid, { disabled: true });
    await logAudit({ actorId: req.user.id, action: 'USER_DEACTIVATED', metadata: { userId: id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function activateUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await prisma.user.update({ where: { id }, data: { isActive: true } });
    await admin.auth().updateUser(user.firebaseUid, { disabled: false });
    await logAudit({ actorId: req.user.id, action: 'USER_ACTIVATED', metadata: { userId: id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

/** Admin-initiated reset: sets a new temporary password directly in Firebase. */
async function resetUserPassword(req, res, next) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    const tempPassword = generateTempPassword();

    await admin.auth().updateUser(user.firebaseUid, { password: tempPassword });
    await prisma.user.update({ where: { id }, data: { mustChangePassword: true } });

    await logAudit({ actorId: req.user.id, action: 'USER_PASSWORD_RESET_BY_ADMIN', metadata: { userId: id } });
    await notify(id, 'PASSWORD_RESET', 'Your password was reset', `Temporary password: ${tempPassword}`);
    res.json({ ok: true, tempPassword });
  } catch (err) { next(err); }
}

/** GET /api/users/me/capabilities — used by the frontend to decide which dashboards/nav items to show. */
async function myCapabilities(req, res, next) {
  try {
    const caps = await getUserCapabilities(req.user.id);
    res.json(caps);
  } catch (err) { next(err); }
}

/**
 * GET /api/users/me — a user's own full profile: department assignments
 * (i.e. which capabilities they hold, and where), plus their current
 * signature/stamp assets so the Profile page can show what's on file.
 */
async function myProfile(req, res, next) {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.id },
      include: {
        deptAssignments: { include: { department: true } },
        primaryDepartment: true,
        signatureAssets: { where: { isActive: true } },
      },
    });
    const capabilities = await getUserCapabilities(user.id);
    res.json({ ...user, capabilities });
  } catch (err) { next(err); }
}

/** A user may edit their own contact/designation info; role and status stay Administrator-only. */
async function updateMyProfile(req, res, next) {
  try {
    const { phone, designation } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { phone, designation },
    });
    await logAudit({ actorId: req.user.id, action: 'PROFILE_UPDATED', metadata: { userId: req.user.id } });
    res.json(user);
  } catch (err) { next(err); }
}

/**
 * GET /api/users/:id — lets a reviewer see who uploaded a document, or any
 * colleague's basic identity/role, without exposing the full admin-only
 * record. Anyone signed in can look up a colleague's name/designation/
 * department/roles (a normal office directory expectation); only the
 * Administrator or the user themself sees contact details (email/phone) and
 * account status through this endpoint.
 */
async function getUserProfile(req, res, next) {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: { deptAssignments: { include: { department: true } }, primaryDepartment: true },
    });
    const isSelfOrAdmin = req.user.id === id || req.user.systemRole === 'ADMIN';

    const { email, phone, isActive, firebaseUid, ...publicFields } = user;
    res.json(isSelfOrAdmin ? user : publicFields);
  } catch (err) { next(err); }
}

/** GET /api/users/:id/photo — streams a user's profile photo, if set. */
async function getUserPhoto(req, res, next) {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } });
    if (!user.profilePhotoUrl) return res.status(404).json({ error: 'No profile photo set' });
    try {
      const buffer = await storage.load(user.profilePhotoUrl);
      res.send(buffer);
    } catch {
      return res.status(404).json({ error: 'No profile photo set' });
    }
  } catch (err) { next(err); }
}

async function uploadMyPhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'An image file is required' });
    const fileKey = generateFileKey(req.file.originalname);
    await storage.save(fileKey, req.file.buffer);
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { profilePhotoUrl: fileKey },
    });
    await logAudit({ actorId: req.user.id, action: 'PROFILE_PHOTO_UPDATED' });
    res.json(user);
  } catch (err) { next(err); }
}

/**
 * Shared by both self-service and Administrator-on-behalf-of-someone-else
 * signature/stamp uploads (the spec explicitly allows the latter: "Administrator
 * can update them anytime"). Deactivates any previously active asset of the
 * same kind for that user first, so pdfStamper.js's "most recent active"
 * lookup always resolves to exactly one current signature and one current
 * stamp per person.
 */
async function setSignatureAsset(userId, kind, fileKey, actorId) {
  await prisma.signatureAsset.updateMany({
    where: { userId, kind, isActive: true },
    data: { isActive: false },
  });
  const asset = await prisma.signatureAsset.create({
    data: { userId, kind, fileUrl: fileKey, isActive: true },
  });
  await logAudit({ actorId, action: `${kind}_ASSET_UPLOADED`, metadata: { userId, assetId: asset.id } });
  return asset;
}

async function uploadMySignature(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A transparent PNG signature is required' });
    const fileKey = generateFileKey(req.file.originalname);
    await storage.save(fileKey, req.file.buffer);
    const asset = await setSignatureAsset(req.user.id, 'SIGNATURE', fileKey, req.user.id);
    res.status(201).json(asset);
  } catch (err) { next(err); }
}

async function uploadMyStamp(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A transparent PNG stamp is required' });
    const fileKey = generateFileKey(req.file.originalname);
    await storage.save(fileKey, req.file.buffer);
    const asset = await setSignatureAsset(req.user.id, 'STAMP', fileKey, req.user.id);
    res.status(201).json(asset);
  } catch (err) { next(err); }
}

/** Administrator uploading/replacing a signature or stamp on behalf of another user. */
async function adminUploadSignatureFor(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A transparent PNG signature is required' });
    const fileKey = generateFileKey(req.file.originalname);
    await storage.save(fileKey, req.file.buffer);
    const asset = await setSignatureAsset(req.params.id, 'SIGNATURE', fileKey, req.user.id);
    res.status(201).json(asset);
  } catch (err) { next(err); }
}

async function adminUploadStampFor(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A transparent PNG stamp is required' });
    const fileKey = generateFileKey(req.file.originalname);
    await storage.save(fileKey, req.file.buffer);
    const asset = await setSignatureAsset(req.params.id, 'STAMP', fileKey, req.user.id);
    res.status(201).json(asset);
  } catch (err) { next(err); }
}

/** GET /api/users/signature-assets/:assetId/file — streams a signature/stamp PNG (owner or Administrator only). */
async function getSignatureAssetFile(req, res, next) {
  try {
    const asset = await prisma.signatureAsset.findUniqueOrThrow({ where: { id: req.params.assetId } });
    if (asset.userId !== req.user.id && req.user.systemRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to view this asset' });
    }
    try {
      const buffer = await storage.load(asset.fileUrl);
      res.setHeader('Content-Type', 'image/png');
      res.send(buffer);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
  } catch (err) { next(err); }
}

/**
 * GET /api/users/:id/reviewer-assignment — the Administrator's explicit
 * Trainer -> HOD / Trainer -> IQA mapping for this trainer, if one has been set.
 */
async function getTrainerReviewerAssignment(req, res, next) {
  try {
    const link = await prisma.trainerReviewerAssignment.findUnique({
      where: { trainerId: req.params.id },
      include: { hod: true, iqa: true },
    });
    res.json(link || { trainerId: req.params.id, hodId: null, iqaId: null });
  } catch (err) { next(err); }
}

/**
 * POST /api/users/:id/reviewer-assignment — Administrator sets which HOD
 * and/or IQA Officer reviews this specific trainer's documents. This is the
 * primary reviewer-resolution path (see services/reviewerAssignment.js);
 * the department capability pool is only a fallback for trainers who
 * haven't been explicitly assigned yet.
 */
async function setTrainerReviewerAssignment(req, res, next) {
  try {
    const { id: trainerId } = req.params;
    const { hodId, iqaId } = req.body;

    if (hodId && hodId === trainerId) {
      return res.status(400).json({ error: 'A trainer cannot be assigned as their own HOD reviewer.' });
    }
    if (iqaId && iqaId === trainerId) {
      return res.status(400).json({ error: 'A trainer cannot be assigned as their own IQA reviewer.' });
    }

    const link = await prisma.trainerReviewerAssignment.upsert({
      where: { trainerId },
      update: { hodId: hodId || null, iqaId: iqaId || null, updatedBy: req.user.id },
      create: { trainerId, hodId: hodId || null, iqaId: iqaId || null, updatedBy: req.user.id },
    });

    await logAudit({
      actorId: req.user.id, action: 'TRAINER_REVIEWER_ASSIGNMENT_SET',
      metadata: { trainerId, hodId, iqaId },
    });
    res.json(link);
  } catch (err) { next(err); }
}

/**
 * GET /api/users/directory — a minimal, non-sensitive listing (name,
 * department, and department-role capabilities only — no email/phone) that
 * any signed-in user can call. Used to populate filter dropdowns like
 * "browse approved documents by trainer / IQA officer" without exposing
 * the full admin-only user list (GET /api/users) more broadly.
 */
async function listUserDirectory(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true, fullName: true, designation: true, systemRole: true,
        primaryDepartment: { select: { id: true, name: true } },
        deptAssignments: { select: { role: true, isActing: true, departmentId: true } },
      },
      orderBy: { fullName: 'asc' },
    });
    res.json(users);
  } catch (err) { next(err); }
}

module.exports = {
  listUsers, listUserDirectory, createUser, updateUser, deactivateUser, activateUser, resetUserPassword, myCapabilities,
  myProfile, updateMyProfile, getUserProfile, getUserPhoto, uploadMyPhoto,
  uploadMySignature, uploadMyStamp, adminUploadSignatureFor, adminUploadStampFor, getSignatureAssetFile,
  getTrainerReviewerAssignment, setTrainerReviewerAssignment,
};
