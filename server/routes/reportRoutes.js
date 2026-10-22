const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Reports accessible to Admin and Manager (Admin views all, Manager can see org/team analytics)
router.get('/', authenticateToken, requireRole('admin', 'manager'), reportController.getReports);

module.exports = router;
