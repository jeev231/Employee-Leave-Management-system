import React, { useState, useEffect } from 'react';
import { leaveApi, authApi, formatDate } from '../api';

export default function EmployeeDashboard({ user, onProfileUpdate }) {
  const [balance, setBalance] = useState(user.leaveSummary || { allocated_days: 5.0, used_days: 0.0, remaining_days: 5.0 });
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal / Form state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysRequested, setDaysRequested] = useState('1.0');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Calculate calendar span in days (inclusive)
  const calculateSpan = (start, end) => {
    if (!start || !end) return 0;
    const startMs = new Date(start + 'T00:00:00').getTime();
    const endMs = new Date(end + 'T00:00:00').getTime();
    if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) return 0;
    return Math.round((endMs - startMs) / 86400000) + 1;
  };

  const currentSpan = calculateSpan(startDate, endDate);

  const handleStartDateChange = (val) => {
    setStartDate(val);
    const newEnd = !endDate || endDate < val ? val : endDate;
    setEndDate(newEnd);
    const span = calculateSpan(val, newEnd);
    if (span >= 1) {
      if (span <= balance.remaining_days) {
        setDaysRequested(span.toFixed(1));
      } else if (span - 0.5 <= balance.remaining_days) {
        setDaysRequested((span - 0.5).toFixed(1));
      } else {
        setDaysRequested(span.toFixed(1));
      }
    }
  };

  const handleEndDateChange = (val) => {
    setEndDate(val);
    const span = calculateSpan(startDate, val);
    if (span >= 1) {
      if (span <= balance.remaining_days) {
        setDaysRequested(span.toFixed(1));
      } else if (span - 0.5 <= balance.remaining_days) {
        setDaysRequested((span - 0.5).toFixed(1));
      } else {
        setDaysRequested(span.toFixed(1));
      }
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [leavesRes, profileRes] = await Promise.all([
        leaveApi.getMyLeaves(statusFilter),
        authApi.getMe()
      ]);

      if (leavesRes.success) {
        setRequests(leavesRes.requests);
      }
      if (profileRes.success && profileRes.user.leaveSummary) {
        setBalance(profileRes.user.leaveSummary);
        if (onProfileUpdate) onProfileUpdate(profileRes.user);
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    const daysNum = parseFloat(daysRequested);

    if (daysNum > balance.remaining_days) {
      setMessage({
        text: `Cannot request ${daysNum} days. You have only ${balance.remaining_days} day(s) remaining.`,
        type: 'danger'
      });
      return;
    }

    try {
      setSubmitting(true);
      setMessage({ text: '', type: '' });

      const res = await leaveApi.apply({
        start_date: startDate,
        end_date: endDate,
        days_requested: daysNum,
        reason
      });

      if (res.success) {
        setMessage({ text: 'Leave application submitted successfully!', type: 'success' });
        setShowApplyModal(false);
        setStartDate('');
        setEndDate('');
        setDaysRequested('1.0');
        setReason('');
        loadData();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this pending leave request?')) {
      return;
    }

    try {
      const res = await leaveApi.cancel(requestId);
      if (res.success) {
        setMessage({ text: 'Leave request cancelled.', type: 'success' });
        loadData();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  return (
    <div>
      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Balance Statistics Card */}
      <div className="stat-grid">
        <div className="stat-card stat-info">
          <div className="stat-label">Total Allocated</div>
          <div className="stat-value">{parseFloat(balance.allocated_days || 5.0).toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500 }}>Days</span></div>
          <div className="stat-desc">Standard allocation (5.0 days)</div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-label">Used Leave</div>
          <div className="stat-value">{parseFloat(balance.used_days || 0.0).toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500 }}>Days</span></div>
          <div className="stat-desc">Approved leaves deducted</div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-label">Remaining Balance</div>
          <div className="stat-value">{parseFloat(balance.remaining_days || 5.0).toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 500 }}>Days</span></div>
          <div className="stat-desc">Available to request in multiples of 0.5</div>
        </div>
      </div>

      {/* Requests History Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">My Leave Applications</div>
            <div className="card-subtitle">Track status and review your leave history</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowApplyModal(true)}
            disabled={balance.remaining_days <= 0}
          >
            + Apply for Leave
          </button>
        </div>

        <div className="toolbar">
          <div className="toolbar-group">
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status Filter:</span>
            {['all', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'all' ? 'All Requests' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Dates</th>
                <th>Duration</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>
                    Loading leave requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No leave requests found for this filter.
                  </td>
                </tr>
              ) : (
                [...requests]
                  .sort((a, b) => new Date(b.start_date) - new Date(a.start_date) || b.request_id - a.request_id)
                  .map((req) => (
                  <tr key={req.request_id}>
                    <td><code>#{req.request_id}</code></td>
                    <td>
                      <strong>{formatDate(req.start_date)}</strong> to{' '}
                      <strong>{formatDate(req.end_date)}</strong>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                        {parseFloat(req.days_requested).toFixed(1)}
                      </span> {parseFloat(req.days_requested) === 1.0 ? 'day' : 'days'}
                    </td>
                    <td style={{ maxWidth: '280px' }}>{req.reason}</td>
                    <td>
                      <span className={`badge badge-${req.status.toLowerCase()}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {req.reviewer_name ? (
                        <span>{req.reviewer_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {user.role === 'manager' ? 'Pending CEO Review' : 'Pending Manager Review'}
                        </span>
                      )}
                    </td>
                    <td>
                      {req.status === 'Pending' ? (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => handleCancel(req.request_id)}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Apply for Leave</h2>
              <button className="modal-close" onClick={() => setShowApplyModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleApplySubmit}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  Available Balance: <strong>{parseFloat(balance.remaining_days).toFixed(1)} days</strong> out of {parseFloat(balance.allocated_days).toFixed(1)} days.
                  {user.role === 'manager' && (
                    <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: '0.25rem' }}>
                      Notice: As a Manager, your leave requests are reviewed and approved directly by Admin CEO.
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {currentSpan > 0 && (
                  <div style={{ marginBottom: '1rem', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    Calendar Span: <strong>{currentSpan} day(s)</strong> (Inclusive). You can request full duration or half-day adjusted.
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Duration (Days Requested) *</label>
                  {currentSpan === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      Please select start date and end date first.
                    </div>
                  ) : (
                    <select
                      className="form-control"
                      value={daysRequested}
                      onChange={(e) => setDaysRequested(e.target.value)}
                      required
                    >
                      {/* Option 1: Full Duration */}
                      <option
                        value={currentSpan.toFixed(1)}
                        disabled={currentSpan > balance.remaining_days}
                      >
                        {currentSpan.toFixed(1)} {currentSpan === 1 ? 'day (Full Day)' : 'days (Full Duration)'} {currentSpan > balance.remaining_days ? '(Exceeds balance)' : ''}
                      </option>

                      {/* Option 2: Half-Day Adjusted */}
                      <option
                        value={(currentSpan - 0.5).toFixed(1)}
                        disabled={(currentSpan - 0.5) > balance.remaining_days}
                      >
                        {(currentSpan - 0.5).toFixed(1)} {currentSpan === 1 ? 'day (Half Day Leave)' : 'days (Half-Day Adjusted)'} {(currentSpan - 0.5) > balance.remaining_days ? '(Exceeds balance)' : ''}
                      </option>
                    </select>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Reason for Leave *</label>
                  <textarea
                    className="form-control"
                    placeholder="Briefly describe the reason for your leave request..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowApplyModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || currentSpan === 0 || parseFloat(daysRequested) > balance.remaining_days}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
