const express = require('express');
const ctrl = require('../controllers/reviewController');
const { requireAuth } = require('../middleware/auth');
const { requireReviewerAndNotOwner } = require('../middleware/conflictOfInterest');

const router = express.Router();

router.get('/queue', requireAuth, ctrl.myQueue);
router.get('/history', requireAuth, ctrl.myHistory);
router.post('/:assignmentId/approve', requireAuth, requireReviewerAndNotOwner, ctrl.approve);
router.post('/:assignmentId/reject', requireAuth, requireReviewerAndNotOwner, ctrl.reject);
router.post('/:assignmentId/return', requireAuth, requireReviewerAndNotOwner, ctrl.returnForCorrection);
router.post('/:assignmentId/comment', requireAuth, requireReviewerAndNotOwner, ctrl.comment);

module.exports = router;
