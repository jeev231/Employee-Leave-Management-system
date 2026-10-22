import React, { useState } from 'react';
import { authApi, setToken } from '../api';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await authApi.login(email, password);
      if (data.success && data.token) {
        setToken(data.token);
        onLoginSuccess(data.user);
      } else {
        setError(data.message || 'Login failed.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during login.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (fillEmail, fillPass) => {
    setEmail(fillEmail);
    setPassword(fillPass);
    setError('');
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="brand-icon" style={{ margin: '0 auto', width: '48px', height: '48px', fontSize: '1.4rem' }}>
            L
          </div>
          <h1>Leave Management System</h1>
          <p>Sign in to access your role-based dashboard</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="e.g. ceo@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="quick-accounts">
          <div className="quick-accounts-title">Quick Fill Demo Credentials</div>
          <div className="quick-accounts-grid">
            <div
              className="quick-chip"
              onClick={() => handleQuickFill('ceo@company.com', 'company@ceo123')}
            >
              <strong>Admin (CEO)</strong>
              <span>ceo@company.com</span>
            </div>

            <div
              className="quick-chip"
              onClick={() => handleQuickFill('alexmanager@company.com', 'PASSWORD')}
            >
              <strong>Manager (Eng)</strong>
              <span>alexmanager@company.com</span>
            </div>

            <div
              className="quick-chip"
              onClick={() => handleQuickFill('priyamanager@company.com', 'PASSWORD')}
            >
              <strong>Manager (HR)</strong>
              <span>priyamanager@company.com</span>
            </div>

            <div
              className="quick-chip"
              onClick={() => handleQuickFill('arjunkumar@company.com', 'PASSWORD')}
            >
              <strong>Employee (Eng)</strong>
              <span>arjunkumar@company.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
