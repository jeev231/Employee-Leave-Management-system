import React, { useState, useEffect } from 'react';
import { employeeApi, departmentApi, leaveApi, formatDate } from '../api';
import ReportsView from './ReportsView';

export default function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('employees'); // 'employees', 'departments', 'requests', 'balances', 'reports'
  const [message, setMessage] = useState({ text: '', type: '' });

  // Employees State
  const [employees, setEmployees] = useState([]);
  const [empSearch, setEmpSearch] = useState('');
  const [empRoleFilter, setEmpRoleFilter] = useState('all');
  const [empDeptFilter, setEmpDeptFilter] = useState('all');
  const [loadingEmps, setLoadingEmps] = useState(false);

  // Departments State
  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  // Requests State
  const [allRequests, setAllRequests] = useState([]);
  const [reqStatusFilter, setReqStatusFilter] = useState('all');
  const [reqDeptFilter, setReqDeptFilter] = useState('all');
  const [reqSearch, setReqSearch] = useState('');
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Modals State
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showEditEmpModal, setShowEditEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);

  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [showEditDeptModal, setShowEditDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);

  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balanceEmp, setBalanceEmp] = useState(null);
  const [newUsedDays, setNewUsedDays] = useState('0.0');

  // Employee Form State
  const [empForm, setEmpForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'employee',
    department_id: '',
    password: ''
  });

  // Department Form State
  const [deptForm, setDeptForm] = useState({
    department_name: '',
    manager_id: ''
  });

  // Load functions
  const loadEmployees = async () => {
    try {
      setLoadingEmps(true);
      const res = await employeeApi.getAll({
        search: empSearch,
        role: empRoleFilter,
        department_id: empDeptFilter
      });
      if (res.success) setEmployees(res.employees);
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setLoadingEmps(false);
    }
  };

  const loadDepartments = async () => {
    try {
      setLoadingDepts(true);
      const res = await departmentApi.getAll();
      if (res.success) setDepartments(res.departments);
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setLoadingDepts(false);
    }
  };

  const loadAllRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await leaveApi.getAllRequests({
        status: reqStatusFilter,
        department_id: reqDeptFilter,
        search: reqSearch
      });
      if (res.success) setAllRequests(res.requests);
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadDepartments();
    loadAllRequests();
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [empSearch, empRoleFilter, empDeptFilter]);

  useEffect(() => {
    if (activeTab === 'requests' || activeTab === 'manager-approvals') {
      loadAllRequests();
    }
  }, [activeTab, reqStatusFilter, reqDeptFilter, reqSearch]);

  // Handlers for Employees
  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      setMessage({ text: '', type: '' });
      const res = await employeeApi.create(empForm);
      if (res.success) {
        setMessage({ text: 'Employee created successfully.', type: 'success' });
        setShowAddEmpModal(false);
        setEmpForm({ full_name: '', email: '', phone: '', role: 'employee', department_id: '', password: '' });
        loadEmployees();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    try {
      setMessage({ text: '', type: '' });
      const res = await employeeApi.update(editingEmp.employee_id, {
        full_name: editingEmp.full_name,
        phone: editingEmp.phone,
        role: editingEmp.role,
        department_id: editingEmp.department_id || null,
        password: editingEmp.newPassword || undefined
      });
      if (res.success) {
        setMessage({ text: 'Employee details updated.', type: 'success' });
        setShowEditEmpModal(false);
        setEditingEmp(null);
        loadEmployees();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  const handleDeactivateEmployee = async (emp) => {
    if (!window.confirm(`Are you sure you want to deactivate/delete ${emp.full_name}?`)) {
      return;
    }
    try {
      setMessage({ text: '', type: '' });
      const res = await employeeApi.deactivate(emp.employee_id);
      if (res.success) {
        setMessage({ text: res.message, type: 'success' });
        loadEmployees();
        loadDepartments();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  // Handlers for Departments
  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    try {
      setMessage({ text: '', type: '' });
      const res = await departmentApi.create(deptForm);
      if (res.success) {
        setMessage({ text: 'Department created and manager assigned.', type: 'success' });
        setShowAddDeptModal(false);
        setDeptForm({ department_name: '', manager_id: '' });
        loadDepartments();
        loadEmployees();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  const handleUpdateDepartment = async (e) => {
    e.preventDefault();
    try {
      setMessage({ text: '', type: '' });
      const res = await departmentApi.update(editingDept.department_id, {
        department_name: editingDept.department_name,
        manager_id: editingDept.manager_id
      });
      if (res.success) {
        setMessage({ text: 'Department updated.', type: 'success' });
        setShowEditDeptModal(false);
        setEditingDept(null);
        loadDepartments();
        loadEmployees();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  // Handler for Balance Adjustment
  const handleUpdateBalance = async (e) => {
    e.preventDefault();
    try {
      setMessage({ text: '', type: '' });
      const res = await employeeApi.updateBalance(balanceEmp.employee_id, newUsedDays);
      if (res.success) {
        setMessage({ text: res.message, type: 'success' });
        setShowBalanceModal(false);
        setBalanceEmp(null);
        loadEmployees();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  // Handlers for Manager Leave Approvals by Admin CEO
  const handleAdminApproveManager = async (reqId, managerName, days) => {
    if (!window.confirm(`As CEO, approve ${days} day(s) leave request for Manager ${managerName}?`)) {
      return;
    }
    try {
      setMessage({ text: '', type: '' });
      const res = await leaveApi.adminApproveManager(reqId);
      if (res.success) {
        setMessage({ text: res.message, type: 'success' });
        loadAllRequests();
        loadEmployees();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  const handleAdminRejectManager = async (reqId, managerName) => {
    if (!window.confirm(`As CEO, reject leave request for Manager ${managerName}?`)) {
      return;
    }
    try {
      setMessage({ text: '', type: '' });
      const res = await leaveApi.adminRejectManager(reqId);
      if (res.success) {
        setMessage({ text: res.message, type: 'success' });
        loadAllRequests();
        loadEmployees();
      }
    } catch (err) {
      setMessage({ text: err.message, type: 'danger' });
    }
  };

  const sortedAllRequests = [...allRequests].sort(
    (a, b) => new Date(b.start_date) - new Date(a.start_date) || b.request_id - a.request_id
  );

  const pendingManagerRequests = sortedAllRequests.filter(
    (r) => r.employee_role === 'manager' && r.status === 'Pending'
  );

  return (
    <div>
      {/* Navigation Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Staff & Employees ({employees.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'departments' ? 'active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          Departments & Managers ({departments.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'manager-approvals' ? 'active' : ''}`}
          onClick={() => setActiveTab('manager-approvals')}
        >
          Manager Leave Approvals
          {pendingManagerRequests.length > 0 && (
            <span
              className="badge badge-pending"
              style={{ marginLeft: '0.45rem', padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}
            >
              {pendingManagerRequests.length}
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Company Leave Requests
        </button>
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports & Analytics
        </button>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* ---------------- EMPLOYEES TAB ---------------- */}
      {activeTab === 'employees' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Employee Directory & Leave Allocations</div>
              <div className="card-subtitle">Manage accounts, department affiliations, and 5-day leave balances</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddEmpModal(true)}>
              + Add New Employee
            </button>
          </div>

          <div className="toolbar">
            <div className="toolbar-group">
              <input
                type="text"
                className="form-control"
                style={{ width: '220px' }}
                placeholder="Search name, email, phone..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
              />

              <select
                className="form-control"
                style={{ width: '140px' }}
                value={empRoleFilter}
                onChange={(e) => setEmpRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="employee">Employee</option>
              </select>

              <select
                className="form-control"
                style={{ width: '180px' }}
                value={empDeptFilter}
                onChange={(e) => setEmpDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Allocated</th>
                  <th>Used</th>
                  <th>Remaining</th>
                  <th style={{ minWidth: '225px', width: '225px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingEmps ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading employee directory...
                    </td>
                  </tr>
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No employees match your search criteria.
                    </td>
                  </tr>
                ) : (
                  employees.map((emp) => (
                    <tr key={emp.employee_id}>
                      <td><code>#{emp.employee_id}</code></td>
                      <td>
                        <strong>{emp.full_name}</strong>
                        {emp.phone && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.phone}</div>
                        )}
                      </td>
                      <td>{emp.email}</td>
                      <td>
                        <span className={`badge badge-role-${emp.role}`}>
                          {emp.role}
                        </span>
                      </td>
                      <td>
                        {emp.department_name ? (
                          <span>
                            {emp.department_name}
                            {emp.dept_manager_id === emp.employee_id && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600, marginLeft: '0.3rem' }}>
                                (Manager)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>{parseFloat(emp.allocated_days || 5.0).toFixed(1)}d</td>
                      <td>
                        <strong>{parseFloat(emp.used_days || 0.0).toFixed(1)}d</strong>
                      </td>
                      <td>
                        <strong style={{ color: emp.remaining_days < 2 ? 'var(--danger)' : 'var(--success-text)' }}>
                          {parseFloat(emp.remaining_days || 5.0).toFixed(1)}d
                        </strong>
                      </td>
                      <td style={{ minWidth: '225px', width: '225px' }}>
                        <div className="table-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Edit details"
                            onClick={() => {
                              setEditingEmp({ ...emp });
                              setShowEditEmpModal(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Manage Leave Balance"
                            onClick={() => {
                              setBalanceEmp(emp);
                              setNewUsedDays(emp.used_days.toString());
                              setShowBalanceModal(true);
                            }}
                          >
                            Balance
                          </button>
                          {emp.role !== 'admin' && (
                            <button
                              className="btn btn-outline-danger btn-sm"
                              title="Safe deactivation"
                              onClick={() => handleDeactivateEmployee(emp)}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- DEPARTMENTS TAB ---------------- */}
      {activeTab === 'departments' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Departments & Designated Managers</div>
              <div className="card-subtitle">
                System Policy: Exactly one manager per department, exactly one department per manager
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddDeptModal(true)}>
              + Create Department
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dept ID</th>
                  <th>Department Name</th>
                  <th>Assigned Manager</th>
                  <th>Manager Email</th>
                  <th>Total Members</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingDepts ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading departments...
                    </td>
                  </tr>
                ) : departments.map((d) => (
                  <tr key={d.department_id}>
                    <td><code>#{d.department_id}</code></td>
                    <td><strong>{d.department_name}</strong></td>
                    <td>
                      <span className="badge badge-role-manager" style={{ marginRight: '0.4rem' }}>
                        Manager
                      </span>
                      {d.manager_name}
                    </td>
                    <td>{d.manager_email}</td>
                    <td>
                      <strong>{d.total_members}</strong> staff members
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingDept({ ...d });
                          setShowEditDeptModal(true);
                        }}
                      >
                        Reassign / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- MANAGER LEAVE APPROVALS TAB ---------------- */}
      {activeTab === 'manager-approvals' && (
        <div>
          {/* Summary Stat Cards */}
          <div className="stat-grid">
            <div className="stat-card stat-warning">
              <div className="stat-label">Pending CEO Decision</div>
              <div className="stat-value">{pendingManagerRequests.length}</div>
              <div className="stat-desc">Managers awaiting your approval</div>
            </div>

            <div className="stat-card stat-success">
              <div className="stat-label">Approved by CEO</div>
              <div className="stat-value">
                {sortedAllRequests.filter((r) => r.employee_role === 'manager' && r.status === 'Approved').length}
              </div>
              <div className="stat-desc">Manager leaves approved</div>
            </div>

            <div className="stat-card stat-info">
              <div className="stat-label">Total Manager Applications</div>
              <div className="stat-value">
                {sortedAllRequests.filter((r) => r.employee_role === 'manager').length}
              </div>
              <div className="stat-desc">Across all departments</div>
            </div>
          </div>

          {/* Pending Manager Leave Requests Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Pending Manager Leave Applications</div>
                <div className="card-subtitle">
                  Under company rules, Department Managers must receive leave approval directly from Admin (CEO).
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadAllRequests}>
                Refresh
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Req #</th>
                    <th>Manager Name</th>
                    <th>Department</th>
                    <th>Leave Dates</th>
                    <th>Duration</th>
                    <th>Remaining Balance</th>
                    <th>Reason</th>
                    <th style={{ minWidth: '200px' }}>CEO Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRequests ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                        Loading manager requests...
                      </td>
                    </tr>
                  ) : pendingManagerRequests.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                          No Pending Manager Leave Requests
                        </div>
                        <div>All manager leave applications have been reviewed.</div>
                      </td>
                    </tr>
                  ) : (
                    pendingManagerRequests.map((r) => (
                      <tr key={r.request_id}>
                        <td><code>#{r.request_id}</code></td>
                        <td>
                          <strong>{r.employee_name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.employee_email}</div>
                        </td>
                        <td>
                          <span className="badge badge-role-manager" style={{ marginRight: '0.35rem' }}>
                            Manager
                          </span>
                          {r.department_name}
                        </td>
                        <td>
                          <strong>{formatDate(r.start_date)}</strong> to <strong>{formatDate(r.end_date)}</strong>
                        </td>
                        <td>
                          <strong>{parseFloat(r.days_requested).toFixed(1)}</strong> {parseFloat(r.days_requested) === 1.0 ? 'day' : 'days'}
                        </td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>
                            Remaining: <strong style={{ color: 'var(--success-text)' }}>{parseFloat(r.remaining_days).toFixed(1)}</strong> / {parseFloat(r.allocated_days).toFixed(1)}
                          </div>
                        </td>
                        <td style={{ maxWidth: '240px' }}>{r.reason}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleAdminApproveManager(r.request_id, r.employee_name, r.days_requested)}
                            >
                              Approve as CEO
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleAdminRejectManager(r.request_id, r.employee_name)}
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

          {/* Past Decisions on Manager Requests */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Past Manager Leave Decisions</div>
                <div className="card-subtitle">Historical records of manager leaves reviewed by the CEO</div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Req #</th>
                    <th>Manager Name</th>
                    <th>Department</th>
                    <th>Leave Dates</th>
                    <th>Duration</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Decision Date</th>
                    <th>Reviewed By</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAllRequests.filter((r) => r.employee_role === 'manager' && r.status !== 'Pending').length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                        No past manager decisions yet.
                      </td>
                    </tr>
                  ) : (
                    sortedAllRequests
                      .filter((r) => r.employee_role === 'manager' && r.status !== 'Pending')
                      .map((r) => (
                        <tr key={r.request_id}>
                          <td><code>#{r.request_id}</code></td>
                          <td>
                            <strong>{r.employee_name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.employee_email}</div>
                          </td>
                          <td>{r.department_name}</td>
                          <td>{formatDate(r.start_date)} to {formatDate(r.end_date)}</td>
                          <td>{parseFloat(r.days_requested).toFixed(1)} days</td>
                          <td style={{ maxWidth: '200px' }}>{r.reason}</td>
                          <td>
                            <span className={`badge badge-${r.status.toLowerCase()}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>{r.reviewed_at ? formatDate(r.reviewed_at) : '—'}</td>
                          <td>{r.reviewer_name || 'Admin CEO'}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- REQUESTS TAB ---------------- */}
      {activeTab === 'requests' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Company Leave Request History</div>
              <div className="card-subtitle">
                System-wide audit view. Department Managers review employee requests; <strong>Admin (CEO) approves Manager leave applications</strong>.
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadAllRequests}>Refresh</button>
          </div>

          {pendingManagerRequests.length > 0 && (
            <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
              <strong>CEO Action Required:</strong> There are <strong>{pendingManagerRequests.length}</strong> pending leave request(s) submitted by Department Managers awaiting your approval.
            </div>
          )}

          <div className="toolbar">
            <div className="toolbar-group">
              <input
                type="text"
                className="form-control"
                style={{ width: '220px' }}
                placeholder="Search applicant or reason..."
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
              />

              <select
                className="form-control"
                style={{ width: '150px' }}
                value={reqStatusFilter}
                onChange={(e) => setReqStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>

              <select
                className="form-control"
                style={{ width: '180px' }}
                value={reqDeptFilter}
                onChange={(e) => setReqDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>
                    {d.department_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Req #</th>
                  <th>Applicant</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Leave Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Decision Maker</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingRequests ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                      Loading leave requests...
                    </td>
                  </tr>
                ) : sortedAllRequests.length === 0 ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No leave requests found matching filters.
                    </td>
                  </tr>
                ) : (
                  sortedAllRequests.map((r) => (
                    <tr key={r.request_id}>
                      <td><code>#{r.request_id}</code></td>
                      <td>
                        <strong>{r.employee_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.employee_email}</div>
                      </td>
                      <td>
                        <span className={`badge badge-role-${r.employee_role || 'employee'}`}>
                          {r.employee_role || 'employee'}
                        </span>
                      </td>
                      <td>{r.department_name || '—'}</td>
                      <td>
                        {formatDate(r.start_date)} to {formatDate(r.end_date)}
                      </td>
                      <td>
                        <strong>{parseFloat(r.days_requested).toFixed(1)}</strong> {parseFloat(r.days_requested) === 1.0 ? 'day' : 'days'}
                      </td>
                      <td style={{ maxWidth: '220px' }}>{r.reason}</td>
                      <td>
                        <span className={`badge badge-${r.status.toLowerCase()}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {r.reviewer_name ? (
                          <div>
                            <span>{r.reviewer_name}</span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {formatDate(r.reviewed_at)}
                            </div>
                          </div>
                        ) : r.employee_role === 'manager' ? (
                          <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem' }}>
                            Awaiting CEO Approval
                          </span>
                        ) : (
                          <span style={{ color: 'var(--warning-text)', fontSize: '0.8rem' }}>
                            Awaiting Dept Manager
                          </span>
                        )}
                      </td>
                      <td>
                        {r.employee_role === 'manager' && r.status === 'Pending' ? (
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleAdminApproveManager(r.request_id, r.employee_name, r.days_requested)}
                            >
                              Approve (CEO)
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleAdminRejectManager(r.request_id, r.employee_name)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {r.status === 'Pending' ? 'Dept Manager decides' : 'Decided'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- REPORTS TAB ---------------- */}
      {activeTab === 'reports' && (
        <ReportsView />
      )}

      {/* MODAL: ADD EMPLOYEE */}
      {showAddEmpModal && (
        <div className="modal-overlay" onClick={() => setShowAddEmpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Employee</h2>
              <button className="modal-close" onClick={() => setShowAddEmpModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateEmployee}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Ramesh Patel"
                    value={empForm.full_name}
                    onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. rameshpatel@company.com"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 9811000000"
                      value={empForm.phone}
                      onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-control"
                      value={empForm.role}
                      onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
                      required
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-control"
                    value={empForm.department_id}
                    onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}
                  >
                    <option value="">None (Unassigned)</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Password</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Default: PASSWORD"
                    value={empForm.password}
                    onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Leave blank to default to 'PASSWORD'</small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddEmpModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EMPLOYEE */}
      {showEditEmpModal && editingEmp && (
        <div className="modal-overlay" onClick={() => setShowEditEmpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Employee #{editingEmp.employee_id}</h2>
              <button className="modal-close" onClick={() => setShowEditEmpModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateEmployee}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingEmp.full_name}
                    onChange={(e) => setEditingEmp({ ...editingEmp, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingEmp.phone || ''}
                      onChange={(e) => setEditingEmp({ ...editingEmp, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      className="form-control"
                      value={editingEmp.role}
                      onChange={(e) => setEditingEmp({ ...editingEmp, role: e.target.value })}
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-control"
                    value={editingEmp.department_id || ''}
                    onChange={(e) => setEditingEmp({ ...editingEmp, department_id: e.target.value })}
                  >
                    <option value="">None (Unassigned)</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>
                        {d.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reset Password (Optional)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter new password to change"
                    value={editingEmp.newPassword || ''}
                    onChange={(e) => setEditingEmp({ ...editingEmp, newPassword: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditEmpModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE LEAVE BALANCE */}
      {showBalanceModal && balanceEmp && (
        <div className="modal-overlay" onClick={() => setShowBalanceModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Manage Leave Balance</h2>
              <button className="modal-close" onClick={() => setShowBalanceModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateBalance}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-main)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
                  <strong>{balanceEmp.full_name}</strong> ({balanceEmp.email})
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Fixed Allocation: <strong>5.0 Days</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Used Days (0.0 to 5.0) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="5.0"
                    className="form-control"
                    value={newUsedDays}
                    onChange={(e) => setNewUsedDays(e.target.value)}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)' }}>
                    Calculated remaining days: <strong>{(5.0 - parseFloat(newUsedDays || 0)).toFixed(1)} days</strong>
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBalanceModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Balance</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD DEPARTMENT */}
      {showAddDeptModal && (
        <div className="modal-overlay" onClick={() => setShowAddDeptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create New Department</h2>
              <button className="modal-close" onClick={() => setShowAddDeptModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateDepartment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Department Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Operations, Legal, Finance..."
                    value={deptForm.department_name}
                    onChange={(e) => setDeptForm({ ...deptForm, department_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Department Manager *</label>
                  <select
                    className="form-control"
                    value={deptForm.manager_id}
                    onChange={(e) => setDeptForm({ ...deptForm, manager_id: e.target.value })}
                    required
                  >
                    <option value="">Select an employee as manager...</option>
                    {employees.map((emp) => (
                      <option key={emp.employee_id} value={emp.employee_id}>
                        {emp.full_name} ({emp.email}) - {emp.role}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)' }}>
                    Assigned employee will be promoted to Manager role and linked to this department.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddDeptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Department</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / REASSIGN DEPARTMENT */}
      {showEditDeptModal && editingDept && (
        <div className="modal-overlay" onClick={() => setShowEditDeptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Department #{editingDept.department_id}</h2>
              <button className="modal-close" onClick={() => setShowEditDeptModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateDepartment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Department Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingDept.department_name}
                    onChange={(e) => setEditingDept({ ...editingDept, department_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Department Manager *</label>
                  <select
                    className="form-control"
                    value={editingDept.manager_id}
                    onChange={(e) => setEditingDept({ ...editingDept, manager_id: e.target.value })}
                    required
                  >
                    {employees.map((emp) => (
                      <option key={emp.employee_id} value={emp.employee_id}>
                        {emp.full_name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditDeptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
