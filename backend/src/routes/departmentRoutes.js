const express = require('express');
const ctrl = require('../controllers/departmentController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, ctrl.listDepartments);
router.post('/', requireAuth, requireAdmin, ctrl.createDepartment);
router.post('/:departmentId/assignments', requireAuth, requireAdmin, ctrl.createAssignment);
router.delete('/assignments/:assignmentId', requireAuth, requireAdmin, ctrl.endAssignment);

module.exports = router;
