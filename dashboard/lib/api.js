const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getToken() {
  try {
    const res = await fetch('/api/auth/session');
    const session = await res.json();
    return session?.accessToken || null;
  } catch {
    return null;
  }
}

async function apiFetch(path, options = {}) {
  const token = typeof window !== 'undefined' ? await getToken() : null;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  auth: {
    me:            ()               => apiFetch('/api/auth/me'),
    profile:       (data)          => apiFetch('/api/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    resetPassword: ()               => apiFetch('/api/auth/reset-password', { method: 'POST', body: '{}' }),
    linkGoogle:    (googleId, email) => apiFetch('/api/auth/link-google', { method: 'POST', body: JSON.stringify({ google_id: googleId, email }) }),
    unlinkGoogle:        ()               => apiFetch('/api/auth/unlink-google', { method: 'POST', body: '{}' }),
    completeOnboarding:  ()               => apiFetch('/api/auth/complete-onboarding', { method: 'POST', body: '{}' }),
  },
  jobs: {
    list: () => apiFetch('/api/jobs'),
    get: (id) => apiFetch(`/api/jobs/${id}`),
    updateStatus: (id, status) => apiFetch(`/api/jobs/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    delete: (id) => apiFetch(`/api/jobs/${id}`, { method: 'DELETE' }),
    test: (data) => apiFetch('/api/jobs/test', { method: 'POST', body: JSON.stringify(data) }),
  },
  dashboard: {
    summary: () => apiFetch('/api/dashboard/summary'),
  },
  companies: {
    get: (name) => apiFetch(`/api/companies/${encodeURIComponent(name)}`),
  },
  admin: {
    stats:             ()         => apiFetch('/api/admin/stats'),
    users:             ()         => apiFetch('/api/admin/users'),
    jobs:              (params)   => apiFetch('/api/admin/jobs?' + new URLSearchParams(params || {}).toString()),
    deleteUser:        (id)       => apiFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),
    updateUserRole:    (id, role) => apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    updateTestUser:    (id, is_test_user) => apiFetch(`/api/admin/users/${id}/test-user`, { method: 'PATCH', body: JSON.stringify({ is_test_user }) }),
    signals:           ()         => apiFetch('/api/admin/signals'),
    perplexityUsage:   ()         => apiFetch('/api/admin/perplexity-usage'),
    reposts:           ()         => apiFetch('/api/admin/reposts'),
  },
};
