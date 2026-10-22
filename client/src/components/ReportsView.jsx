import React, { useState, useEffect } from 'react';
import { reportApi } from '../api';

export default function ReportsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await reportApi.getReports();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load report analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Loading reports and statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">{error}</div>
    );
  }

  const { summary, deptAnalytics, statusCounts, topLeaveUsers } = data;

  return (
    <div>
      {/* High-Level Organization Metrics */}
      <div className="stat-grid">
        <div className="stat-card stat-info">
          <div className="stat-label">Total Staff</div>
          <div className="stat-value">{summary.total_active_staff}</div>
          <div className="stat-desc">Excluding system administrator</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Leave Requests</div>
          <div className="stat-value">{summary.total_requests_submitted}</div>
          <div className="stat-desc">{summary.total_pending_requests} pending approval</div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-label">Total Days Approved</div>
          <div className="stat-value">{summary.total_days_taken}</div>
          <div className="stat-desc">Deducted from 5-day allocations</div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-label">Avg Used Days / Staff</div>
          <div className="stat-value">{summary.org_avg_days_used}</div>
          <div className="stat-desc">Average across staff members</div>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Department Leave Analytics</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadReports}>Refresh</button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Assigned Manager</th>
                <th>Staff Count</th>
                <th>Total Requests</th>
                <th>Total Approved Days</th>
                <th>Avg Days Used</th>
                <th>Avg Days Remaining</th>
              </tr>
            </thead>
            <tbody>
              {deptAnalytics.map((dept) => (
                <tr key={dept.department_id}>
                  <td><strong>{dept.department_name}</strong></td>
                  <td>{dept.manager_name}</td>
                  <td>{dept.total_employees}</td>
                  <td>{dept.total_requests}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {dept.total_approved_days}
                    </span> days
                  </td>
                  <td>{dept.avg_used_days} days</td>
                  <td>
                    <strong style={{ color: 'var(--success-text)' }}>
                      {dept.avg_remaining_days}
                    </strong> days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Status Distribution */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Leave Request Status Distribution</div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Request Count</th>
                  <th>Total Duration</th>
                  <th>Avg Days / Request</th>
                </tr>
              </thead>
              <tbody>
                {statusCounts.map((st) => (
                  <tr key={st.status}>
                    <td>
                      <span className={`badge badge-${st.status.toLowerCase()}`}>
                        {st.status}
                      </span>
                    </td>
                    <td><strong>{st.count}</strong></td>
                    <td>{st.total_days} days</td>
                    <td>{st.avg_days} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Leave Utilizers */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Top Leave Utilizers</div>
              <div className="card-subtitle">Employees ranked by approved leave consumption</div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Used Days</th>
                  <th>Remaining</th>
                  <th>Approved Req</th>
                </tr>
              </thead>
              <tbody>
                {topLeaveUsers.map((emp) => (
                  <tr key={emp.employee_id}>
                    <td>
                      <strong>{emp.full_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.email}</div>
                    </td>
                    <td>{emp.department_name || '—'}</td>
                    <td>
                      <strong>{emp.used_days}</strong> / 5.0
                    </td>
                    <td>
                      <span style={{ color: emp.remaining_days < 2 ? 'var(--danger)' : 'var(--success-text)', fontWeight: 600 }}>
                        {emp.remaining_days}
                      </span>
                    </td>
                    <td>{emp.total_approved_requests}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
