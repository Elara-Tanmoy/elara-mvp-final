const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export interface User {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

class AuthService {
  private accessToken: string | null = null;
  private user: User | null = null;

  constructor() {
    // Load from localStorage on init
    const saved = localStorage.getItem('elara_admin_auth');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        this.accessToken = data.accessToken;
        this.user = data.user;
      } catch (e) {
        localStorage.removeItem('elara_admin_auth');
      }
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/v2/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error || 'Login failed' };
      }

      const data: AuthTokens = await response.json();

      // Check if user is admin
      if (data.user.role !== 'admin' && data.user.role !== 'owner') {
        return { success: false, error: 'Access denied. Admin privileges required.' };
      }

      this.accessToken = data.accessToken;
      this.user = data.user;

      localStorage.setItem('elara_admin_auth', JSON.stringify({
        accessToken: data.accessToken,
        user: data.user
      }));

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  }

  logout() {
    this.accessToken = null;
    this.user = null;
    localStorage.removeItem('elara_admin_auth');
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null && this.user !== null;
  }

  isAdmin(): boolean {
    return this.user?.role === 'admin' || this.user?.role === 'owner';
  }
}

export const authService = new AuthService();
