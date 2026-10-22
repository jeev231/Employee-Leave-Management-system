const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Query employee and their department
    const [rows] = await db.query(
      `SELECT e.employee_id, e.full_name, e.email, e.password_hash, e.phone, e.role, e.department_id,
              d.department_name, d.manager_id
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.department_id
       WHERE e.email = ?`,
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const employee = rows[0];
    const passwordMatch = await bcrypt.compare(password, employee.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Get leave summary using Stored Procedure: sp_get_employee_leave_summary
    let leaveSummary = { allocated_days: 5.0, used_days: 0.0, remaining_days: 5.0 };
    try {
      const [spResult] = await db.query('CALL sp_get_employee_leave_summary(?)', [employee.employee_id]);
      if (spResult[0] && spResult[0][0]) {
        leaveSummary = {
          allocated_days: parseFloat(spResult[0][0].allocated_days),
          used_days: parseFloat(spResult[0][0].used_days),
          remaining_days: parseFloat(spResult[0][0].remaining_days)
        };
      }
    } catch (spErr) {
      console.error('Error invoking sp_get_employee_leave_summary:', spErr.message);
    }

    // Generate JWT
    const tokenPayload = {
      employee_id: employee.employee_id,
      email: employee.email,
      full_name: employee.full_name,
      role: employee.role,
      department_id: employee.department_id,
      department_name: employee.department_name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        ...tokenPayload,
        phone: employee.phone,
        leaveSummary
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

async function getProfile(req, res) {
  try {
    const employeeId = req.user.employee_id;

    const [rows] = await db.query(
      `SELECT e.employee_id, e.full_name, e.email, e.phone, e.role, e.department_id,
              d.department_name, d.manager_id
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.department_id
       WHERE e.employee_id = ?`,
      [employeeId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const employee = rows[0];

    // Call stored procedure: sp_get_employee_leave_summary
    const [spResult] = await db.query('CALL sp_get_employee_leave_summary(?)', [employeeId]);
    const summaryRow = spResult[0] && spResult[0][0] ? spResult[0][0] : {};

    return res.json({
      success: true,
      user: {
        employee_id: employee.employee_id,
        full_name: employee.full_name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        department_id: employee.department_id,
        department_name: employee.department_name,
        is_manager_of_dept: employee.manager_id === employee.employee_id,
        leaveSummary: {
          allocated_days: parseFloat(summaryRow.allocated_days || 5.0),
          used_days: parseFloat(summaryRow.used_days || 0.0),
          remaining_days: parseFloat(summaryRow.remaining_days || 5.0)
        }
      }
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
  }
}

module.exports = {
  login,
  getProfile
};
