const express = require('express');
const ctrl = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/mine', requireAuth, ctrl.myNotifications);
router.post('/:id/read', requireAuth, ctrl.markRead);
router.post('/mark-all-read', requireAuth, ctrl.markAllRead);
// Authorization (Administrator or DP Academics only) is checked inside the
// controller, since it depends on department-role capability, not just a
// static systemRole check that requireAdmin alone could express.
router.post('/broadcast', requireAuth, ctrl.broadcast);

module.exports = router;
