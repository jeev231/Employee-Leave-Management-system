const db = require('../config/db');

// Employee: Apply for leave
async function applyLeave(req, res) {
  try {
    const employee_id = req.user.employee_id;
    const { start_date, end_date, days_requested, reason } = req.body;

    if (!start_date || !end_date || days_requested === undefined || days_requested === null || !reason) {
      return res.status(400).json({ success: false, message: 'All fields (start date, end date, days, reason) are required.' });
    }

    const days = parseFloat(days_requested);
    if (isNaN(days) || days <= 0) {
      return res.status(400).json({ success: false, message: 'Days requested must be a positive number.' });
    }

    // Must be in increments of 0.5
    if (Math.round(days * 10) % 5 !== 0) {
      return res.status(400).json({ success: false, message: 'Requested duration must be in increments of 0.5 days.' });
    }

    const startMs = new Date(start_date + 'T00:00:00').getTime();
    const endMs = new Date(end_date + 'T00:00:00').getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      return res.status(400).json({ success: false, message: 'Invalid start or end date format.' });
    }

    if (endMs < startMs) {
      return res.status(400).json({ success: false, message: 'End date cannot be earlier than start date.' });
    }

    // Calculate inclusive calendar span (e.g. 2nd to 5th = 4 days; 2nd to 2nd = 1 day)
    const spanDays = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)) + 1;

    // Validate that requested duration approximately matches the date span:
    // User can request either full days (spanDays) or half-day adjusted (spanDays - 0.5)
    if (days !== spanDays && days !== (spanDays - 0.5)) {
      return res.status(400).json({
        success: false,
        message: `For the selected dates (${start_date} to ${end_date}, spanning ${spanDays} calendar day(s)), you can only request ${spanDays} or ${spanDays - 0.5} day(s) leave.`
      });
    }

    // Check remaining balance
    const [balanceRows] = await db.query('SELECT allocated_days, used_days FROM leave_balances WHERE employee_id = ?', [employee_id]);
    if (balanceRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave balance record not found.' });
    }

    const { allocated_days, used_days } = balanceRows[0];
    const remainingDays = parseFloat(allocated_days) - parseFloat(used_days);

    if (days > remainingDays) {
      return res.status(400).json({
        success: false,
        message: `Requested ${days} day(s) exceeds your remaining balance of ${remainingDays} day(s).`
      });
    }

    const [result] = await db.query(
      `INSERT INTO leave_requests (employee_id, start_date, end_date, days_requested, reason, status)
       VALUES (?, ?, ?, ?, ?, 'Pending')`,
      [employee_id, start_date, end_date, days, reason.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully.',
      requestId: result.insertId
    });
  } catch (err) {
    console.error('Error applying for leave:', err);
    return res.status(500).json({ success: false, message: 'Failed to submit leave application.' });
  }
}

// Employee: View own leave requests (using VIEW vw_leave_request_details)
async function getMyLeaves(req, res) {
  try {
    const employee_id = req.user.employee_id;
    const { status } = req.query;

    let query = `
      SELECT * FROM vw_leave_request_details
      WHERE employee_id = ?
    `;
    const params = [employee_id];

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    }

    // Sort leave history from newest to oldest
    query += ` ORDER BY start_date DESC, request_id DESC`;

    const [requests] = await db.query(query, params);
    return res.json({ success: true, requests });
  } catch (err) {
    console.error('Error fetching personal leaves:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve leave history.' });
  }
}

// Employee: Cancel own pending leave request
async function cancelLeave(req, res) {
  try {
    const employee_id = req.user.employee_id;
    const { id } = req.params;

    const [rows] = await db.query('SELECT * FROM leave_requests WHERE request_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = rows[0];

    // Enforce ownership: employees can only manage their own requests
    if (request.employee_id !== employee_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You can only cancel your own leave requests.' });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Only Pending requests can be cancelled. Current status is ${request.status}.` });
    }

    await db.query(`UPDATE leave_requests SET status = 'Cancelled' WHERE request_id = ?`, [id]);

    return res.json({ success: true, message: 'Leave request cancelled successfully.' });
  } catch (err) {
    console.error('Error cancelling leave request:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel leave request.' });
  }
}

// Manager: View pending requests strictly for employees in their assigned department
async function getManagerRequests(req, res) {
  try {
    const manager_id = req.user.employee_id;

    // Verify which department this manager is assigned to
    const [deptRows] = await db.query('SELECT department_id, department_name FROM departments WHERE manager_id = ?', [manager_id]);
    if (deptRows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned as manager of any department.'
      });
    }

    const managedDeptId = deptRows[0].department_id;

    // Fetch requests for this department only (using the VIEW)
    // Managers cannot approve or review their own requests (Section 2, 5)
    const query = `
      SELECT * FROM vw_leave_request_details
      WHERE department_id = ?
        AND employee_id != ?
      ORDER BY start_date DESC, request_id DESC
    `;
    const [requests] = await db.query(query, [managedDeptId, manager_id]);

    return res.json({
      success: true,
      department: deptRows[0],
      requests
    });
  } catch (err) {
    console.error('Error fetching manager requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve department leave requests.' });
  }
}

// Manager: Approve leave request (Strict Transactional Workflow)
async function approveRequest(req, res) {
  const connection = await db.getConnection();
  try {
    const manager_id = req.user.employee_id;
    const { id } = req.params;

    // Verify manager's assigned department
    const [deptRows] = await connection.query('SELECT department_id, department_name FROM departments WHERE manager_id = ?', [manager_id]);
    if (deptRows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You are not the assigned manager of any department.' });
    }
    const managedDeptId = deptRows[0].department_id;

    // Fetch request and applicant's department
    const [reqRows] = await connection.query(
      `SELECT lr.*, e.department_id AS applicant_dept_id, e.full_name AS applicant_name
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.employee_id
       WHERE lr.request_id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = reqRows[0];

    // Manager cannot approve requests from another department
    if (request.applicant_dept_id !== managedDeptId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You can only approve leave requests from your own department.'
      });
    }

    // Manager cannot approve their own requests
    if (request.employee_id === manager_id) {
      return res.status(403).json({
        success: false,
        message: 'Conflict of interest: Managers cannot approve their own leave requests.'
      });
    }

    // Only Pending requests can be approved
    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Only Pending requests can be approved. This request is already ${request.status}.`
      });
    }

    // 1. BEGIN TRANSACTION
    await connection.beginTransaction();

    // 2. Lock employee's leave balance row for update
    const [balanceRows] = await connection.query(
      'SELECT allocated_days, used_days FROM leave_balances WHERE employee_id = ? FOR UPDATE',
      [request.employee_id]
    );

    if (balanceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Employee leave balance record not found.' });
    }

    const { allocated_days, used_days } = balanceRows[0];
    const newUsedDays = parseFloat(used_days) + parseFloat(request.days_requested);

    // 3. Verify used_days + days_requested <= allocated_days
    if (newUsedDays > parseFloat(allocated_days)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Approval rejected: Requested duration (${request.days_requested} days) exceeds applicant remaining balance (${allocated_days - used_days} days).`
      });
    }

    // 4. Increment used_days
    await connection.query(
      'UPDATE leave_balances SET used_days = ? WHERE employee_id = ?',
      [newUsedDays, request.employee_id]
    );

    // 5. Update request to Approved
    // Note: The MySQL trigger `trg_after_leave_request_update` will automatically fire
    // and insert the record into `leave_history` with (request_id, 'Approved', manager_id, NOW())
    await connection.query(
      `UPDATE leave_requests
       SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [manager_id, id]
    );

    // 6. Ensure leave_history is recorded even if trigger was not present
    await connection.query(
      `INSERT IGNORE INTO leave_history (request_id, status, approved_by, approved_at)
       VALUES (?, 'Approved', ?, NOW())`,
      [id, manager_id]
    );

    // 7. COMMIT TRANSACTION
    await connection.commit();

    return res.json({
      success: true,
      message: `Leave request for ${request.applicant_name} approved successfully. Deducted ${request.days_requested} day(s).`
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error approving leave request:', err);
    return res.status(500).json({ success: false, message: 'Transaction rolled back. Failed to approve leave request.' });
  } finally {
    connection.release();
  }
}

// Manager: Reject leave request
async function rejectRequest(req, res) {
  try {
    const manager_id = req.user.employee_id;
    const { id } = req.params;

    // Verify manager's assigned department
    const [deptRows] = await db.query('SELECT department_id, department_name FROM departments WHERE manager_id = ?', [manager_id]);
    if (deptRows.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized. You are not the assigned manager of any department.' });
    }
    const managedDeptId = deptRows[0].department_id;

    // Fetch request
    const [reqRows] = await db.query(
      `SELECT lr.*, e.department_id AS applicant_dept_id, e.full_name AS applicant_name
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.employee_id
       WHERE lr.request_id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = reqRows[0];

    // Department boundary check
    if (request.applicant_dept_id !== managedDeptId) {
      return res.status(403).json({ success: false, message: 'Forbidden. You can only reject leave requests from your own department.' });
    }

    // Cannot reject own request
    if (request.employee_id === manager_id) {
      return res.status(403).json({ success: false, message: 'Conflict of interest: Managers cannot decide on their own leave requests.' });
    }

    // Only Pending requests can be rejected
    if (request.status !== 'Pending') {
      return res.status(400).json({ success: false, message: `Only Pending requests can be rejected. This request is currently ${request.status}.` });
    }

    // Update request to Rejected
    await db.query(
      `UPDATE leave_requests
       SET status = 'Rejected', reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [manager_id, id]
    );

    // Insert history (trigger also handles this via INSERT IGNORE)
    await db.query(
      `INSERT IGNORE INTO leave_history (request_id, status, approved_by, approved_at)
       VALUES (?, 'Rejected', ?, NOW())`,
      [id, manager_id]
    );

    return res.json({
      success: true,
      message: `Leave request for ${request.applicant_name} has been rejected.`
    });
  } catch (err) {
    console.error('Error rejecting leave request:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject leave request.' });
  }
}

// Admin: View all leave requests with search and filter (READ ONLY — cannot approve/reject)
async function getAllRequests(req, res) {
  try {
    const { department_id, status, search, start_date, end_date } = req.query;

    let query = `
      SELECT * FROM vw_leave_request_details
      WHERE 1=1
    `;
    const params = [];

    if (department_id && department_id !== 'all') {
      query += ` AND department_id = ?`;
      params.push(department_id);
    }

    if (status && status !== 'all') {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (search && search.trim()) {
      query += ` AND (employee_name LIKE ? OR employee_email LIKE ? OR reason LIKE ?)`;
      const searchParam = `%${search.trim()}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (start_date) {
      query += ` AND start_date >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND end_date <= ?`;
      params.push(end_date);
    }

    // Sort leave history from newest to oldest
    query += ` ORDER BY start_date DESC, request_id DESC`;

    const [requests] = await db.query(query, params);
    return res.json({ success: true, requests });
  } catch (err) {
    console.error('Error fetching all requests:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch leave requests.' });
  }
}

// Admin (CEO): Approve leave request for a Manager
async function adminApproveManagerRequest(req, res) {
  const connection = await db.getConnection();
  try {
    const admin_id = req.user.employee_id;
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Admin CEO can approve manager leave requests.' });
    }

    const [reqRows] = await connection.query(
      `SELECT lr.*, e.role AS applicant_role, e.full_name AS applicant_name, e.department_id AS applicant_dept_id, d.department_name
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.employee_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       WHERE lr.request_id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = reqRows[0];

    if (request.applicant_role !== 'manager') {
      return res.status(400).json({
        success: false,
        message: 'Admin approval is specifically designated for Managers. Regular employee requests must be approved by their assigned Department Manager.'
      });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Only Pending requests can be approved. Current status is ${request.status}.`
      });
    }

    await connection.beginTransaction();

    const [balanceRows] = await connection.query(
      'SELECT allocated_days, used_days FROM leave_balances WHERE employee_id = ? FOR UPDATE',
      [request.employee_id]
    );

    if (balanceRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Manager leave balance record not found.' });
    }

    const { allocated_days, used_days } = balanceRows[0];
    const newUsedDays = parseFloat(used_days) + parseFloat(request.days_requested);

    if (newUsedDays > parseFloat(allocated_days)) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Approval failed: Requested duration (${request.days_requested} days) exceeds manager's remaining balance (${allocated_days - used_days} days).`
      });
    }

    await connection.query(
      'UPDATE leave_balances SET used_days = ? WHERE employee_id = ?',
      [newUsedDays, request.employee_id]
    );

    await connection.query(
      `UPDATE leave_requests
       SET status = 'Approved', reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [admin_id, id]
    );

    await connection.query(
      `INSERT IGNORE INTO leave_history (request_id, status, approved_by, approved_at)
       VALUES (?, 'Approved', ?, NOW())`,
      [id, admin_id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `CEO Approval granted: ${request.applicant_name}'s leave request for ${request.days_requested} day(s) has been approved.`
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error in admin approving manager request:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve manager leave request.' });
  } finally {
    connection.release();
  }
}

// Admin (CEO): Reject leave request for a Manager
async function adminRejectManagerRequest(req, res) {
  try {
    const admin_id = req.user.employee_id;
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Admin CEO can reject manager leave requests.' });
    }

    const [reqRows] = await db.query(
      `SELECT lr.*, e.role AS applicant_role, e.full_name AS applicant_name
       FROM leave_requests lr
       JOIN employees e ON lr.employee_id = e.employee_id
       WHERE lr.request_id = ?`,
      [id]
    );

    if (reqRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    const request = reqRows[0];

    if (request.applicant_role !== 'manager') {
      return res.status(400).json({
        success: false,
        message: 'Admin rejection is designated for Managers. Employee requests are reviewed by their assigned Department Manager.'
      });
    }

    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Only Pending requests can be rejected. Current status is ${request.status}.`
      });
    }

    await db.query(
      `UPDATE leave_requests
       SET status = 'Rejected', reviewed_by = ?, reviewed_at = NOW()
       WHERE request_id = ?`,
      [admin_id, id]
    );

    await db.query(
      `INSERT IGNORE INTO leave_history (request_id, status, approved_by, approved_at)
       VALUES (?, 'Rejected', ?, NOW())`,
      [id, admin_id]
    );

    return res.json({
      success: true,
      message: `Manager leave request for ${request.applicant_name} has been rejected by Admin CEO.`
    });
  } catch (err) {
    console.error('Error in admin rejecting manager request:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject manager leave request.' });
  }
}

module.exports = {
  applyLeave,
  getMyLeaves,
  cancelLeave,
  getManagerRequests,
  approveRequest,
  rejectRequest,
  getAllRequests,
  adminApproveManagerRequest,
  adminRejectManagerRequest
};
