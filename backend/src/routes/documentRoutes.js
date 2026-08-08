const express = require('express');
const ctrl = require('../controllers/documentController');
const msgCtrl = require('../controllers/messageController');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/', requireAuth, upload.single('file'), ctrl.uploadDocument);
router.post('/:id/versions', requireAuth, upload.single('file'), ctrl.uploadNewVersion);
router.post('/:id/submit', requireAuth, ctrl.submit);
router.get('/mine', requireAuth, ctrl.myDocuments);
// Must be registered before '/:id' — otherwise Express would treat
// "approved" itself as an :id value and this route would never match.
router.get('/approved', requireAuth, ctrl.listApprovedDocuments);
router.get('/:id', requireAuth, ctrl.getDocument);
router.get('/:id/download', requireAuth, ctrl.downloadLatest);
router.get('/:id/preview', requireAuth, ctrl.previewLatest);
router.get('/:id/messages', requireAuth, msgCtrl.listMessages);
router.post('/:id/messages', requireAuth, msgCtrl.postMessage);

module.exports = router;
