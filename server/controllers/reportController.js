const db = require('../config/db');

async function getReports(req, res) {
  try {
    // 1. Department Leave Analytics (JOIN, COUNT, SUM, AVG, GROUP BY)
    const [deptAnalytics] = await db.query(`
      SELECT
        d.department_id,
        d.department_name,
        m.full_name AS manager_name,
        COUNT(DISTINCT e.employee_id) AS total_employees,
        COUNT(DISTINCT lr.request_id) AS total_requests,
        COALESCE(SUM(CASE WHEN lr.status = 'Approved' THEN lr.days_requested ELSE 0 END), 0) AS total_approved_days,
        COALESCE(ROUND(AVG(lb.used_days), 2), 0) AS avg_used_days,
        COALESCE(ROUND(AVG(lb.allocated_days - lb.used_days), 2), 5.00) AS avg_remaining_days
      FROM departments d
      JOIN employees m ON d.manager_id = m.employee_id
      LEFT JOIN employees e ON d.department_id = e.department_id
      LEFT JOIN leave_requests lr ON e.employee_id = lr.employee_id
      LEFT JOIN leave_balances lb ON e.employee_id = lb.employee_id
      GROUP BY d.department_id, d.department_name, m.full_name
      ORDER BY d.department_name ASC
    `);

    // 2. Status Distribution (COUNT, SUM, AVG, GROUP BY)
    const [statusCounts] = await db.query(`
      SELECT
        status,
        COUNT(*) AS count,
        COALESCE(SUM(days_requested), 0) AS total_days,
        COALESCE(ROUND(AVG(days_requested), 2), 0) AS avg_days
      FROM leave_requests
      GROUP BY status
    `);

    // 3. Top Leave Utilizers
    const [topLeaveUsers] = await db.query(`
      SELECT
        e.employee_id,
        e.full_name,
        e.email,
        d.department_name,
        lb.allocated_days,
        lb.used_days,
        (lb.allocated_days - lb.used_days) AS remaining_days,
        COUNT(lr.request_id) AS total_approved_requests
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.department_id
      JOIN leave_balances lb ON e.employee_id = lb.employee_id
      LEFT JOIN leave_requests lr ON e.employee_id = lr.employee_id AND lr.status = 'Approved'
      WHERE e.role != 'admin'
      GROUP BY e.employee_id, e.full_name, e.email, d.department_name, lb.allocated_days, lb.used_days
      ORDER BY lb.used_days DESC, total_approved_requests DESC
      LIMIT 10
    `);

    // 4. Overall Organization Metrics
    const [overallStats] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM employees WHERE role != 'admin') AS total_active_staff,
        (SELECT COUNT(*) FROM departments) AS total_departments,
        (SELECT COUNT(*) FROM leave_requests) AS total_requests_submitted,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'Pending') AS total_pending_requests,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'Approved') AS total_approved_requests,
        (SELECT COUNT(*) FROM leave_requests WHERE status = 'Rejected') AS total_rejected_requests,
        (SELECT COALESCE(SUM(days_requested), 0) FROM leave_requests WHERE status = 'Approved') AS total_days_taken,
        (SELECT COALESCE(ROUND(AVG(used_days), 2), 0) FROM leave_balances) AS org_avg_days_used
    `);

    return res.json({
      success: true,
      data: {
        deptAnalytics,
        statusCounts,
        topLeaveUsers,
        summary: overallStats[0]
      }
    });
  } catch (err) {
    console.error('Error generating reports:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate DBMS report metrics.' });
  }
}

module.exports = {
  getReports
};
