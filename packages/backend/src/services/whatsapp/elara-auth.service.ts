import axios, { AxiosInstance } from 'axios';
import { logger } from '../../config/logger.js';

/**
 * Elara Authentication Service
 *
 * Manages authentication with Elara APIs for WhatsApp integration.
 * Uses email/password login to obtain Bearer tokens and handles automatic refresh.
 *
 * Singleton pattern - one login per application instance.
 */
class ElaraAuthService {
  private static instance: ElaraAuthService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private isAuthenticating: boolean = false;
  private authPromise: Promise<string> | null = null;

  private readonly apiBaseUrl: string;
  private readonly userEmail: string;
  private readonly userPassword: string;
  private readonly axiosInstance: AxiosInstance;

  private constructor() {
    this.apiBaseUrl = process.env.ELARA_API_BASE_URL || 'https://elara-backend-64tf.onrender.com/api';
    this.userEmail = process.env.ELARA_BOT_EMAIL || '';
    this.userPassword = process.env.ELARA_BOT_PASSWORD || '';

    if (!this.userEmail || !this.userPassword) {
      logger.error('[ElaraAuth] Missing ELARA_BOT_EMAIL or ELARA_BOT_PASSWORD in environment');
      throw new Error('Elara bot credentials not configured');
    }

    // Create axios instance without default auth header
    this.axiosInstance = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    logger.info('[ElaraAuth] Service initialized');
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ElaraAuthService {
    if (!ElaraAuthService.instance) {
      ElaraAuthService.instance = new ElaraAuthService();
    }
    return ElaraAuthService.instance;
  }

  /**
   * Get valid Bearer token (auto-login if needed)
   */
  public async getToken(): Promise<string> {
    // If already authenticating, wait for that promise
    if (this.isAuthenticating && this.authPromise) {
      return this.authPromise;
    }

    // Check if current token is still valid
    if (this.accessToken && this.isTokenValid()) {
      return this.accessToken;
    }

    // Try to refresh token if we have one
    if (this.refreshToken) {
      try {
        return await this.refreshAccessToken();
      } catch (error) {
        logger.warn('[ElaraAuth] Token refresh failed, will re-login', { error });
        // Fall through to login
      }
    }

    // Need to login
    return this.login();
  }

  /**
   * Login to Elara and obtain tokens
   */
  private async login(): Promise<string> {
    // Prevent multiple concurrent logins
    if (this.isAuthenticating && this.authPromise) {
      return this.authPromise;
    }

    this.isAuthenticating = true;
    this.authPromise = this._performLogin();

    try {
      const token = await this.authPromise;
      return token;
    } finally {
      this.isAuthenticating = false;
      this.authPromise = null;
    }
  }

  /**
   * Perform actual login API call
   */
  private async _performLogin(): Promise<string> {
    try {
      logger.info('[ElaraAuth] Logging in to Elara...', { email: this.userEmail });

      const response = await this.axiosInstance.post('/v2/auth/login', {
        email: this.userEmail,
        password: this.userPassword
      });

      const { accessToken, refreshToken } = response.data;

      if (!accessToken) {
        throw new Error('No access token received from Elara');
      }

      this.accessToken = accessToken;
      this.refreshToken = refreshToken || null;

      // JWT tokens typically expire in 30 minutes, set expiry slightly before
      this.tokenExpiry = new Date(Date.now() + 25 * 60 * 1000); // 25 minutes

      logger.info('[ElaraAuth] Successfully logged in to Elara', {
        hasRefreshToken: !!this.refreshToken,
        expiresAt: this.tokenExpiry.toISOString()
      });

      return this.accessToken;
    } catch (error: any) {
      logger.error('[ElaraAuth] Login failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Elara login failed: ${error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      logger.info('[ElaraAuth] Refreshing access token...');

      const response = await this.axiosInstance.post('/v2/auth/refresh', {
        refreshToken: this.refreshToken
      });

      const { accessToken } = response.data;

      if (!accessToken) {
        throw new Error('No access token received from refresh');
      }

      this.accessToken = accessToken;
      this.tokenExpiry = new Date(Date.now() + 25 * 60 * 1000);

      logger.info('[ElaraAuth] Access token refreshed successfully');

      return this.accessToken;
    } catch (error: any) {
      logger.error('[ElaraAuth] Token refresh failed', {
        error: error.message,
        status: error.response?.status
      });
      // Clear refresh token on failure
      this.refreshToken = null;
      throw error;
    }
  }

  /**
   * Check if current access token is still valid
   */
  private isTokenValid(): boolean {
    if (!this.tokenExpiry) {
      return false;
    }

    // Add 1-minute buffer
    const bufferTime = 60 * 1000;
    return Date.now() < (this.tokenExpiry.getTime() - bufferTime);
  }

  /**
   * Get authenticated axios instance (with Bearer token)
   */
  public async getAuthenticatedAxios(): Promise<AxiosInstance> {
    const token = await this.getToken();

    return axios.create({
      baseURL: this.apiBaseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  }

  /**
   * Logout and clear tokens
   */
  public async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        const axios = await this.getAuthenticatedAxios();
        await axios.post('/v2/auth/logout');
      }
    } catch (error) {
      logger.warn('[ElaraAuth] Logout API call failed', { error });
    } finally {
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiry = null;
      logger.info('[ElaraAuth] Logged out and tokens cleared');
    }
  }

  /**
   * Force re-authentication (useful for testing or error recovery)
   */
  public async forceReauth(): Promise<string> {
    logger.info('[ElaraAuth] Forcing re-authentication...');
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    return this.login();
  }
}

// Export singleton instance
export const elaraAuthService = ElaraAuthService.getInstance();
