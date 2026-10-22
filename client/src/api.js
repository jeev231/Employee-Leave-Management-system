// Centralized API Client with JWT authorization handling

const API_BASE = '/api';

export function getToken() {
  return localStorage.getItem('elms_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('elms_token', token);
  } else {
    localStorage.removeItem('elms_token');
  }
}

// Format any date to strict DD/MM/YYYY format
export function formatDate(dateVal) {
  if (!dateVal) return '—';
  if (typeof dateVal === 'string') {
    const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateTime(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Invalid response format from server.'
  }));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

// Authentication
export const authApi = {
  login: (email, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  getMe: () => apiRequest('/auth/me')
};

// Leaves
export const leaveApi = {
  apply: (data) => apiRequest('/leaves/apply', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getMyLeaves: (status) => apiRequest(`/leaves/my-leaves${status ? `?status=${status}` : ''}`),
  cancel: (id) => apiRequest(`/leaves/cancel/${id}`, { method: 'POST' }),

  // Manager
  getManagerRequests: () => apiRequest('/leaves/manager/requests'),
  approve: (id) => apiRequest(`/leaves/manager/approve/${id}`, { method: 'POST' }),
  reject: (id) => apiRequest(`/leaves/manager/reject/${id}`, { method: 'POST' }),

  // Admin
  getAllRequests: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/leaves/admin/all${qs ? `?${qs}` : ''}`);
  },
  adminApproveManager: (id) => apiRequest(`/leaves/admin/approve/${id}`, { method: 'POST' }),
  adminRejectManager: (id) => apiRequest(`/leaves/admin/reject/${id}`, { method: 'POST' })
};

// Employees (Admin)
export const employeeApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/employees${qs ? `?${qs}` : ''}`);
  },
  create: (data) => apiRequest('/employees', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id, data) => apiRequest(`/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deactivate: (id) => apiRequest(`/employees/${id}`, {
    method: 'DELETE'
  }),
  updateBalance: (id, usedDays) => apiRequest(`/employees/${id}/balance`, {
    method: 'PUT',
    body: JSON.stringify({ used_days: usedDays })
  })
};

// Departments (Admin)
export const departmentApi = {
  getAll: () => apiRequest('/departments'),
  create: (data) => apiRequest('/departments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id, data) => apiRequest(`/departments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
};

// Reports
export const reportApi = {
  getReports: () => apiRequest('/reports')
};
