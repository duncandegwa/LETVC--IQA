const express = require('express');
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Login, logout, session refresh, "forgot password" emails, and the actual
// password reset flow are all handled client-side by the Firebase Auth SDK
// now (see frontend/src/api/AuthContext.jsx) — this backend never sees a
// password. These two routes just keep the Postgres-side profile in sync.
router.get('/me', requireAuth, ctrl.me);
router.post('/complete-password-change', requireAuth, ctrl.completePasswordChange);

module.exports = router;
