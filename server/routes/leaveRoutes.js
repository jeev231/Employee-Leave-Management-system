const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Employee routes
router.post('/apply', authenticateToken, leaveController.applyLeave);
router.get('/my-leaves', authenticateToken, leaveController.getMyLeaves);
router.post('/cancel/:id', authenticateToken, leaveController.cancelLeave);

// Manager review routes (Manager role required, strictly enforces department scoping and non-self-approval)
router.get('/manager/requests', authenticateToken, requireRole('manager'), leaveController.getManagerRequests);
router.post('/manager/approve/:id', authenticateToken, requireRole('manager'), leaveController.approveRequest);
router.post('/manager/reject/:id', authenticateToken, requireRole('manager'), leaveController.rejectRequest);

// Admin view and manager approval routes (Admin role required)
router.get('/admin/all', authenticateToken, requireRole('admin'), leaveController.getAllRequests);
router.post('/admin/approve/:id', authenticateToken, requireRole('admin'), leaveController.adminApproveManagerRequest);
router.post('/admin/reject/:id', authenticateToken, requireRole('admin'), leaveController.adminRejectManagerRequest);

module.exports = router;
