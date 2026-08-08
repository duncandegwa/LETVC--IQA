const express = require('express');
const ctrl = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { uploadSignatureImage, uploadPhoto } = require('../middleware/upload');

const router = express.Router();

// Self-service profile — every user, regardless of role.
router.get('/me/capabilities', requireAuth, ctrl.myCapabilities);
router.get('/me', requireAuth, ctrl.myProfile);
router.patch('/me', requireAuth, ctrl.updateMyProfile);
router.post('/me/photo', requireAuth, uploadPhoto.single('photo'), ctrl.uploadMyPhoto);
router.post('/me/signature', requireAuth, uploadSignatureImage.single('file'), ctrl.uploadMySignature);
router.post('/me/stamp', requireAuth, uploadSignatureImage.single('file'), ctrl.uploadMyStamp);

// Colleague lookup (e.g. "who uploaded this document") — any signed-in user.
router.get('/directory', requireAuth, ctrl.listUserDirectory);
router.get('/:id', requireAuth, ctrl.getUserProfile);
router.get('/:id/photo', requireAuth, ctrl.getUserPhoto);
router.get('/signature-assets/:assetId/file', requireAuth, ctrl.getSignatureAssetFile);

// Administrator-only user management.
router.get('/', requireAuth, requireAdmin, ctrl.listUsers);
router.post('/', requireAuth, requireAdmin, ctrl.createUser);
router.patch('/:id', requireAuth, requireAdmin, ctrl.updateUser);
router.post('/:id/deactivate', requireAuth, requireAdmin, ctrl.deactivateUser);
router.post('/:id/activate', requireAuth, requireAdmin, ctrl.activateUser);
router.post('/:id/reset-password', requireAuth, requireAdmin, ctrl.resetUserPassword);
router.get('/:id/reviewer-assignment', requireAuth, requireAdmin, ctrl.getTrainerReviewerAssignment);
router.post('/:id/reviewer-assignment', requireAuth, requireAdmin, ctrl.setTrainerReviewerAssignment);
// "Administrator can update them anytime" — signatures/stamps for any user.
router.post('/:id/signature', requireAuth, requireAdmin, uploadSignatureImage.single('file'), ctrl.adminUploadSignatureFor);
router.post('/:id/stamp', requireAuth, requireAdmin, uploadSignatureImage.single('file'), ctrl.adminUploadStampFor);

module.exports = router;
