import { authService } from './auth';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = authService.getAccessToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (response.status === 401) {
    authService.logout();
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export const adminAPI = {
  async getDashboardStats() {
    return fetchWithAuth('/v2/admin/stats');
  },

  async getOrganizations() {
    return fetchWithAuth('/v2/admin/organizations');
  },

  async updateOrganizationTier(id: string, tier: string) {
    return fetchWithAuth(`/v2/admin/organizations/${id}/tier`, {
      method: 'PATCH',
      body: JSON.stringify({ tier })
    });
  },

  async getUsers() {
    return fetchWithAuth('/v2/admin/users');
  },

  async updateUserRole(id: string, role: string) {
    return fetchWithAuth(`/v2/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
  },

  async deactivateUser(id: string) {
    return fetchWithAuth(`/v2/admin/users/${id}`, {
      method: 'DELETE'
    });
  },

  async getAllScans(filters?: any) {
    const params = new URLSearchParams(filters);
    return fetchWithAuth(`/v2/admin/scans?${params}`);
  },

  async getAuditLogs(limit = 100, offset = 0) {
    return fetchWithAuth(`/v2/admin/audit-logs?limit=${limit}&offset=${offset}`);
  },

  async getSystemMetrics() {
    return fetchWithAuth('/v2/admin/metrics');
  }
};
