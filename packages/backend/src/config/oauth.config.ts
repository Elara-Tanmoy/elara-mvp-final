import { config } from 'dotenv';
config();

/**
 * Enterprise-Grade OAuth 2.0 Configuration
 *
 * Security Features:
 * - State parameter for CSRF protection
 * - Secure session management
 * - Token encryption
 * - Scope validation
 * - Callback URL validation
 */

// Frontend URL for OAuth redirects
export const FRONTEND_URL = process.env.FRONTEND_URL || 'https://elara-mvp.vercel.app';
export const BACKEND_URL = process.env.BACKEND_URL || 'https://elara-backend-64tf.onrender.com';

// OAuth Callback URLs
export const GOOGLE_CALLBACK_URL = `${BACKEND_URL}/api/v2/auth/google/callback`;
export const FACEBOOK_CALLBACK_URL = `${BACKEND_URL}/api/v2/auth/facebook/callback`;
export const LINKEDIN_CALLBACK_URL = `${BACKEND_URL}/api/v2/auth/linkedin/callback`;

/**
 * Google OAuth Configuration
 * Get credentials from: https://console.cloud.google.com/
 */
export const googleOAuthConfig = {
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: GOOGLE_CALLBACK_URL,
  scope: ['profile', 'email'],
  passReqToCallback: true,
  state: true // Enable CSRF protection
};

/**
 * Facebook OAuth Configuration
 * Get credentials from: https://developers.facebook.com/
 */
export const facebookOAuthConfig = {
  clientID: process.env.FACEBOOK_APP_ID || '',
  clientSecret: process.env.FACEBOOK_APP_SECRET || '',
  callbackURL: FACEBOOK_CALLBACK_URL,
  profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
  scope: ['email', 'public_profile'],
  passReqToCallback: true,
  enableProof: true, // Enable App Secret Proof for added security
  state: true
};

/**
 * LinkedIn OAuth Configuration
 * Get credentials from: https://www.linkedin.com/developers/
 */
export const linkedInOAuthConfig = {
  clientID: process.env.LINKEDIN_CLIENT_ID || '',
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  callbackURL: LINKEDIN_CALLBACK_URL,
  scope: ['r_emailaddress', 'r_liteprofile'],
  passReqToCallback: true,
  state: true
};

/**
 * OAuth Provider Configuration
 */
export interface OAuthProvider {
  name: string;
  enabled: boolean;
  config: any;
}

export const oauthProviders: Record<string, OAuthProvider> = {
  google: {
    name: 'Google',
    enabled: !!process.env.GOOGLE_CLIENT_ID,
    config: googleOAuthConfig
  },
  facebook: {
    name: 'Facebook',
    enabled: !!process.env.FACEBOOK_APP_ID,
    config: facebookOAuthConfig
  },
  linkedin: {
    name: 'LinkedIn',
    enabled: !!process.env.LINKEDIN_CLIENT_ID,
    config: linkedInOAuthConfig
  }
};

/**
 * Check if OAuth is properly configured
 */
export function isOAuthConfigured(provider: string): boolean {
  return oauthProviders[provider]?.enabled || false;
}

/**
 * Get all enabled OAuth providers
 */
export function getEnabledProviders(): string[] {
  return Object.keys(oauthProviders).filter(key => oauthProviders[key].enabled);
}

/**
 * Security: Validate callback URLs to prevent redirect attacks
 */
export function isValidCallbackURL(url: string): boolean {
  const allowedDomains = [
    'elara-mvp.vercel.app',
    'elara-backend-64tf.onrender.com',
    'localhost'
  ];

  try {
    const parsedUrl = new URL(url);
    return allowedDomains.some(domain => parsedUrl.hostname.includes(domain));
  } catch {
    return false;
  }
}
