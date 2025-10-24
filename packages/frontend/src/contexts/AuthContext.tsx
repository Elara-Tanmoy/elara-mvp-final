import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
  tier: string;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Check if OAuth callback with tokens in URL
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const oauthSuccess = urlParams.get('oauth_success');
      const oauthError = urlParams.get('oauth_error');

      if (oauthError) {
        // Handle OAuth error
        console.error('[OAuth] Authentication failed:', oauthError);
        alert(`OAuth login failed: ${oauthError.replace(/_/g, ' ')}`);

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsLoading(false);
        return;
      }

      if (oauthSuccess && accessToken && refreshToken) {
        try {
          // Store tokens
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);

          // Fetch user data with the new token
          const response = await api.get('/v2/auth/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
          });

          const { user, organization } = response.data;

          // Store user and organization
          localStorage.setItem('user', JSON.stringify(user));
          localStorage.setItem('organization', JSON.stringify(organization));

          setUser(user);
          setOrganization(organization);

          console.log('[OAuth] Login successful');

          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('[OAuth] Error fetching user data:', error);
          alert('OAuth login failed: Could not fetch user data');

          // Clean up
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        setIsLoading(false);
        return;
      }

      // Normal auth check - load from localStorage
      const storedUser = localStorage.getItem('user');
      const storedOrg = localStorage.getItem('organization');
      const token = localStorage.getItem('accessToken');

      if (storedUser && storedOrg && token) {
        setUser(JSON.parse(storedUser));
        setOrganization(JSON.parse(storedOrg));
      }

      setIsLoading(false);
    };

    handleOAuthCallback();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/v2/auth/login', { email, password });
    const { user, organization, accessToken, refreshToken } = response.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('organization', JSON.stringify(organization));

    setUser(user);
    setOrganization(organization);
  };

  const register = async (data: RegisterData) => {
    const response = await api.post('/v2/auth/register', data);
    const { user, organization, accessToken, refreshToken } = response.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('organization', JSON.stringify(organization));

    setUser(user);
    setOrganization(organization);
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      api.post('/v2/auth/logout', { refreshToken }).catch(() => {});
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');

    setUser(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        isLoading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
