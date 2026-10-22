import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LoginPage from './components/LoginPage';
import EmployeeDashboard from './components/EmployeeDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import { authApi, getToken, setToken } from './api';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await authApi.getMe();
        if (res.success && res.user) {
          setUser(res.user);
        } else {
          setToken(null);
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="login-wrapper">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div className="brand-icon" style={{ margin: '0 auto 1rem', width: '48px', height: '48px' }}>L</div>
          <div>Initializing LeaveFlow Management System...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div className="app-container">
      <Navbar user={user} onLogout={handleLogout} />
      <main className="main-content">
        {user.role === 'admin' && <AdminDashboard user={user} />}
        {user.role === 'manager' && <ManagerDashboard user={user} onProfileUpdate={setUser} />}
        {user.role === 'employee' && <EmployeeDashboard user={user} onProfileUpdate={setUser} />}
      </main>
    </div>
  );
}
