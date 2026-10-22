const db = require('../config/db');

// Get all departments with manager details and employee counts
async function getAllDepartments(req, res) {
  try {
    const query = `
      SELECT
        d.department_id,
        d.department_name,
        d.manager_id,
        m.full_name AS manager_name,
        m.email AS manager_email,
        COUNT(e.employee_id) AS total_members
      FROM departments d
      JOIN employees m ON d.manager_id = m.employee_id
      LEFT JOIN employees e ON d.department_id = e.department_id
      GROUP BY d.department_id, d.department_name, d.manager_id, m.full_name, m.email
      ORDER BY d.department_id ASC
    `;
    const [departments] = await db.query(query);
    return res.json({ success: true, departments });
  } catch (err) {
    console.error('Error fetching departments:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch departments.' });
  }
}

// Create department (Admin only)
async function createDepartment(req, res) {
  const connection = await db.getConnection();
  try {
    const { department_name, manager_id } = req.body;

    if (!department_name || !manager_id) {
      return res.status(400).json({ success: false, message: 'Department name and assigned manager are required.' });
    }

    // Check if department name already exists
    const [existingDept] = await connection.query('SELECT department_id FROM departments WHERE department_name = ?', [department_name.trim()]);
    if (existingDept.length > 0) {
      return res.status(409).json({ success: false, message: 'A department with this name already exists.' });
    }

    // Check if the selected manager exists and their current role
    const [managerRows] = await connection.query('SELECT employee_id, full_name, role FROM employees WHERE employee_id = ?', [manager_id]);
    if (managerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Selected manager not found.' });
    }

    // Check if manager is already managing another department
    const [alreadyManaging] = await connection.query('SELECT department_id, department_name FROM departments WHERE manager_id = ?', [manager_id]);
    if (alreadyManaging.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${managerRows[0].full_name} is already the manager of '${alreadyManaging[0].department_name}'. Each manager can manage only one department.`
      });
    }

    await connection.beginTransaction();

    // Ensure employee has 'manager' role
    await connection.query("UPDATE employees SET role = 'manager' WHERE employee_id = ?", [manager_id]);

    // Insert department
    const [result] = await connection.query(
      'INSERT INTO departments (department_name, manager_id) VALUES (?, ?)',
      [department_name.trim(), manager_id]
    );

    const newDeptId = result.insertId;

    // Associate manager with this department
    await connection.query('UPDATE employees SET department_id = ? WHERE employee_id = ?', [newDeptId, manager_id]);

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      department: {
        department_id: newDeptId,
        department_name: department_name.trim(),
        manager_id
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error creating department:', err);
    return res.status(500).json({ success: false, message: 'Failed to create department.' });
  } finally {
    connection.release();
  }
}

// Update department (Admin only)
async function updateDepartment(req, res) {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { department_name, manager_id } = req.body;

    const [deptRows] = await connection.query('SELECT * FROM departments WHERE department_id = ?', [id]);
    if (deptRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    const currentDept = deptRows[0];
    const newDeptName = department_name ? department_name.trim() : currentDept.department_name;
    const newManagerId = manager_id ? parseInt(manager_id) : currentDept.manager_id;

    // If manager is changing
    if (newManagerId !== currentDept.manager_id) {
      const [managerRows] = await connection.query('SELECT employee_id, full_name, role FROM employees WHERE employee_id = ?', [newManagerId]);
      if (managerRows.length === 0) {
        return res.status(404).json({ success: false, message: 'New manager employee not found.' });
      }

      // Check if new manager is already managing another department
      const [alreadyManaging] = await connection.query(
        'SELECT department_id, department_name FROM departments WHERE manager_id = ? AND department_id != ?',
        [newManagerId, id]
      );
      if (alreadyManaging.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${managerRows[0].full_name} is already the manager of '${alreadyManaging[0].department_name}'.`
        });
      }
    }

    await connection.beginTransaction();

    // If manager changed, update roles and departments
    if (newManagerId !== currentDept.manager_id) {
      // Set new manager role to 'manager' and assign department
      await connection.query("UPDATE employees SET role = 'manager', department_id = ? WHERE employee_id = ?", [id, newManagerId]);
    }

    // Update department record
    await connection.query(
      'UPDATE departments SET department_name = ?, manager_id = ? WHERE department_id = ?',
      [newDeptName, newManagerId, id]
    );

    await connection.commit();

    return res.json({ success: true, message: 'Department updated successfully.' });
  } catch (err) {
    await connection.rollback();
    console.error('Error updating department:', err);
    return res.status(500).json({ success: false, message: 'Failed to update department.' });
  } finally {
    connection.release();
  }
}

module.exports = {
  getAllDepartments,
  createDepartment,
  updateDepartment
};
