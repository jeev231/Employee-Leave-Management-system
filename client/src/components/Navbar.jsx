import React from 'react';

export default function Navbar({ user, onLogout }) {
  const roleBadgeClass = {
    admin: 'badge-role-admin',
    manager: 'badge-role-manager',
    employee: 'badge-role-employee'
  }[user.role] || 'badge-role-employee';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <div className="brand-icon">L</div>
          <div>
            <span>LeaveFlow</span>
          </div>
        </div>

        <div className="user-profile">
          <div className="user-details">
            <div className="user-name">{user.full_name}</div>
            <div className="user-meta">
              <span className={`badge ${roleBadgeClass}`} style={{ marginRight: '0.35rem' }}>
                {user.role}
              </span>
              {user.department_name && (
                <span>&bull; {user.department_name}</span>
              )}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
