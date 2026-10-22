const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Departments list can be viewed by all authenticated users (needed for dropdowns when admin creates employees)
router.get('/', authenticateToken, departmentController.getAllDepartments);

// Modification routes are Admin only
router.post('/', authenticateToken, requireRole('admin'), departmentController.createDepartment);
router.put('/:id', authenticateToken, requireRole('admin'), departmentController.updateDepartment);

module.exports = router;
