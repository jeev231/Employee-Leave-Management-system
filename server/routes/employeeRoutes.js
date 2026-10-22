const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All employee management routes require Admin role
router.get('/', authenticateToken, requireRole('admin'), employeeController.getAllEmployees);
router.post('/', authenticateToken, requireRole('admin'), employeeController.createEmployee);
router.put('/:id', authenticateToken, requireRole('admin'), employeeController.updateEmployee);
router.delete('/:id', authenticateToken, requireRole('admin'), employeeController.deactivateEmployee);
router.put('/:id/balance', authenticateToken, requireRole('admin'), employeeController.updateLeaveBalance);

module.exports = router;
