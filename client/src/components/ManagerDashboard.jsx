import React, { useState, useEffect } from 'react';
import { leaveApi, authApi, formatDate } from '../api';
import EmployeeDashboard from './EmployeeDashboard';

export default function ManagerDashboard({ user, onProfileUpdate }) {
  const [activeTab, setActiveTab] = useState('manager'); // 'manager' or 'personal'
  const [department, setDepartment] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [processingId, setProcessingId] = useState(null);

  const loadManagerRequests = async () => {
    try {
      setLoading(true);
      const res = await leaveApi.getManagerRequests();
      if (res.success) {
        setDepartment(res.department);
        setRequests(res.requests);
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagerRequests();
  }, []);

  const handleApprove = async (id, applicantName, days) => {
    if (!window.confirm(`Approve ${days} days leave for ${applicantName}? This will deduct ${days} days from their balance.`)) {
      return;
    }

    try {
      setProcessingId(id);
      setMessage({ text: '', type: '' });
      const res = await leaveApi.approve(id);
      if (res.success) {
        setMessage({ text: res.message, type: 'success' });
        loadManagerRequests();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id, applicantName) => {
    if (!window.confirm(`Reject leave request for ${applicantName}?`)) {
      return;
    }

    try {
      setProcessingId(id);
      setMessage({ text: '', type: '' });
      const res = await leaveApi.reject(id);
      if (res.success) {
        setMessage({ text: res.message, type: 'success' });
        loadManagerRequests();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setProcessingId(null);
    }
  };

  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.start_date) - new Date(a.start_date) || b.request_id - a.request_id
  );
  const pendingRequests = sortedRequests.filter((r) => r.status === 'Pending');
  const reviewedRequests = sortedRequests.filter((r) => r.status !== 'Pending');

  return (
    <div>
      {/* Switch between Department Management and Personal Leaves */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'manager' ? 'active' : ''}`}
          onClick={() => setActiveTab('manager')}
        >
          Department Approvals ({department ? department.department_name : 'Loading...'})
        </button>
        <button
          className={`tab-btn ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          My Personal Leaves
        </button>
      </div>

      {activeTab === 'personal' ? (
        <EmployeeDashboard user={user} onProfileUpdate={onProfileUpdate} />
      ) : (
        <div>
          {message.text && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Department Statistics Summary */}
          <div className="stat-grid">
            <div className="stat-card stat-info">
              <div className="stat-label">Assigned Department</div>
              <div className="stat-value" style={{ fontSize: '1.6rem' }}>
                {department ? department.department_name : user.department_name || 'Assigned Dept'}
              </div>
              <div className="stat-desc">Manager: {user.full_name}</div>
            </div>

            <div className="stat-card stat-warning">
              <div className="stat-label">Pending Approval</div>
              <div className="stat-value">{pendingRequests.length}</div>
              <div className="stat-desc">Awaiting your approval decision</div>
            </div>

            <div className="stat-card stat-success">
              <div className="stat-label">Reviewed Requests</div>
              <div className="stat-value">{reviewedRequests.length}</div>
              <div className="stat-desc">Historical department decisions</div>
            </div>
          </div>

          {/* Pending Department Requests */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Pending Leave Requests</div>
                <div className="card-subtitle">
                  Employees in <strong>{department ? department.department_name : 'your department'}</strong> awaiting approval
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadManagerRequests}>
                Refresh
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Req #</th>
                    <th>Employee Name</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Current Balance</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                        Loading pending requests...
                      </td>
                    </tr>
                  ) : pendingRequests.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        All caught up! No pending leave requests in your department.
                      </td>
                    </tr>
                  ) : (
                    pendingRequests.map((req) => (
                      <tr key={req.request_id}>
                        <td><code>#{req.request_id}</code></td>
                        <td>
                          <strong>{req.employee_name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.employee_email}</div>
                        </td>
                        <td>
                          {formatDate(req.start_date)} to {formatDate(req.end_date)}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {parseFloat(req.days_requested).toFixed(1)}
                          </span> {parseFloat(req.days_requested) === 1.0 ? 'day' : 'days'}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>
                            Remaining: <strong style={{ color: 'var(--success-text)' }}>{parseFloat(req.remaining_days).toFixed(1)}</strong> / {parseFloat(req.allocated_days).toFixed(1)}
                          </div>
                        </td>
                        <td style={{ maxWidth: '240px' }}>{req.reason}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleApprove(req.request_id, req.employee_name, req.days_requested)}
                              disabled={processingId === req.request_id}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleReject(req.request_id, req.employee_name)}
                              disabled={processingId === req.request_id}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Department Decision History */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Past Department Decisions</div>
                <div className="card-subtitle">Approved, Rejected, or Cancelled requests</div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Req #</th>
                    <th>Employee</th>
                    <th>Dates</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Reviewed By</th>
                    <th>Reviewed Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewedRequests.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No past reviewed requests yet.
                      </td>
                    </tr>
                  ) : (
                    reviewedRequests.map((req) => (
                      <tr key={req.request_id}>
                        <td><code>#{req.request_id}</code></td>
                        <td>{req.employee_name}</td>
                        <td>{formatDate(req.start_date)} to {formatDate(req.end_date)}</td>
                        <td>{req.days_requested} days</td>
                        <td>
                          <span className={`badge badge-${req.status.toLowerCase()}`}>
                            {req.status}
                          </span>
                        </td>
                        <td>{req.reviewer_name || '—'}</td>
                        <td>{req.reviewed_at ? formatDate(req.reviewed_at) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
