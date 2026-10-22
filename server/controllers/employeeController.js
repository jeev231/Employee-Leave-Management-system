const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Get all employees with search and filter
async function getAllEmployees(req, res) {
  try {
    const { search, role, department_id } = req.query;

    let query = `
      SELECT
        e.employee_id,
        e.full_name,
        e.email,
        e.phone,
        e.role,
        e.department_id,
        d.department_name,
        d.manager_id AS dept_manager_id,
        COALESCE(lb.allocated_days, 5.0) AS allocated_days,
        COALESCE(lb.used_days, 0.0) AS used_days,
        COALESCE(lb.allocated_days - lb.used_days, 5.0) AS remaining_days
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.department_id
      LEFT JOIN leave_balances lb ON e.employee_id = lb.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      query += ` AND (e.full_name LIKE ? OR e.email LIKE ? OR e.phone LIKE ?)`;
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (role && role !== 'all') {
      query += ` AND e.role = ?`;
      params.push(role);
    }

    if (department_id && department_id !== 'all') {
      query += ` AND e.department_id = ?`;
      params.push(department_id);
    }

    query += ` ORDER BY e.employee_id ASC`;

    const [employees] = await db.query(query, params);
    return res.json({ success: true, employees });
  } catch (err) {
    console.error('Error fetching employees:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch employees.' });
  }
}

// Create new employee (Admin only)
async function createEmployee(req, res) {
  const connection = await db.getConnection();
  try {
    const { full_name, email, password, phone, role, department_id } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({ success: false, message: 'Full name and email are required.' });
    }

    const validRoles = ['admin', 'manager', 'employee'];
    const assignedRole = validRoles.includes(role) ? role : 'employee';

    // Check if email already exists
    const [existing] = await connection.query('SELECT employee_id FROM employees WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An employee with this email already exists.' });
    }

    // Hash password (default to 'PASSWORD' if not provided)
    const rawPassword = password && password.trim() ? password.trim() : 'PASSWORD';
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO employees (full_name, email, password_hash, phone, role, department_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name.trim(), email.trim().toLowerCase(), passwordHash, phone || null, assignedRole, department_id || null]
    );

    const newEmployeeId = result.insertId;

    // Create leave balance record (allocated = 5.0, used = 0.0)
    await connection.query(
      `INSERT INTO leave_balances (employee_id, allocated_days, used_days)
       VALUES (?, 5.0, 0.0)`,
      [newEmployeeId]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      employee: {
        employee_id: newEmployeeId,
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        role: assignedRole,
        department_id: department_id || null
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error creating employee:', err);
    return res.status(500).json({ success: false, message: 'Failed to create employee.' });
  } finally {
    connection.release();
  }
}

// Update employee (Admin only)
async function updateEmployee(req, res) {
  try {
    const { id } = req.params;
    const { full_name, phone, role, department_id, password } = req.body;

    // Check if employee exists
    const [existing] = await db.query('SELECT * FROM employees WHERE employee_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const currentEmp = existing[0];

    // If changing role away from 'manager' or changing department, verify they are not actively managing a department
    if (currentEmp.role === 'manager' && (role !== 'manager' || (department_id && parseInt(department_id) !== currentEmp.department_id))) {
      const [managingDepts] = await db.query('SELECT department_id, department_name FROM departments WHERE manager_id = ?', [id]);
      if (managingDepts.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot change role or department of ${currentEmp.full_name} because they are the assigned manager of '${managingDepts[0].department_name}'. Please reassign department manager first.`
        });
      }
    }

    const validRoles = ['admin', 'manager', 'employee'];
    const newRole = validRoles.includes(role) ? role : currentEmp.role;

    let updateQuery = `UPDATE employees SET full_name = ?, phone = ?, role = ?, department_id = ?`;
    const params = [
      full_name || currentEmp.full_name,
      phone !== undefined ? phone : currentEmp.phone,
      newRole,
      department_id !== undefined ? (department_id || null) : currentEmp.department_id
    ];

    if (password && password.trim()) {
      const newHash = await bcrypt.hash(password.trim(), 10);
      updateQuery += `, password_hash = ?`;
      params.push(newHash);
    }

    updateQuery += ` WHERE employee_id = ?`;
    params.push(id);

    await db.query(updateQuery, params);

    return res.json({ success: true, message: 'Employee updated successfully.' });
  } catch (err) {
    console.error('Error updating employee:', err);
    return res.status(500).json({ success: false, message: 'Failed to update employee.' });
  }
}

// Safe employee deactivation / removal (Admin only)
async function deactivateEmployee(req, res) {
  try {
    const { id } = req.params;

    // Check if employee is managing any department
    const [managingDepts] = await db.query('SELECT department_id, department_name FROM departments WHERE manager_id = ?', [id]);
    if (managingDepts.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot deactivate employee. They are the active manager of '${managingDepts[0].department_name}'. Assign another manager first.`
      });
    }

    // Check if employee has leave requests or history
    const [requests] = await db.query('SELECT COUNT(*) AS count FROM leave_requests WHERE employee_id = ? OR reviewed_by = ?', [id, id]);

    if (requests[0].count > 0) {
      // Safe deactivation: detach department and invalidate password to prevent login while preserving relational integrity
      const disabledHash = '$2a$10$DISABLED_ACCOUNT_CANNOT_LOGIN_' + Date.now();
      await db.query(
        `UPDATE employees SET department_id = NULL, password_hash = ? WHERE employee_id = ?`,
        [disabledHash, id]
      );
      return res.json({
        success: true,
        message: 'Employee safely deactivated (login access revoked and unassigned from department) to preserve historical DBMS records.'
      });
    } else {
      // Clean delete if no foreign key constraints depend on them
      await db.query('DELETE FROM leave_balances WHERE employee_id = ?', [id]);
      await db.query('DELETE FROM employees WHERE employee_id = ?', [id]);
      return res.json({ success: true, message: 'Employee deleted successfully.' });
    }
  } catch (err) {
    console.error('Error deactivating employee:', err);
    return res.status(500).json({ success: false, message: 'Failed to safely deactivate employee.' });
  }
}

// Manage employee leave balances (Admin only)
async function updateLeaveBalance(req, res) {
  try {
    const { id } = req.params;
    const { used_days } = req.body;

    const numUsed = parseFloat(used_days);
    if (isNaN(numUsed) || numUsed < 0 || numUsed > 5.0) {
      return res.status(400).json({
        success: false,
        message: 'Used days must be a number between 0.0 and 5.0 (maximum 5-day allocation).'
      });
    }

    await db.query(
      `UPDATE leave_balances SET used_days = ? WHERE employee_id = ?`,
      [numUsed, id]
    );

    return res.json({
      success: true,
      message: 'Leave balance updated successfully.',
      balance: {
        employee_id: parseInt(id),
        allocated_days: 5.0,
        used_days: numUsed,
        remaining_days: 5.0 - numUsed
      }
    });
  } catch (err) {
    console.error('Error updating leave balance:', err);
    return res.status(500).json({ success: false, message: 'Failed to update leave balance.' });
  }
}

module.exports = {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  updateLeaveBalance
};
