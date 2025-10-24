import express from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { logger } from '../config/logger.js';
import { OAuthProfile } from '../services/auth/oauth.service.js';
import axios from 'axios';
import crypto from 'crypto';
import {
  googleOAuthConfig,
  facebookOAuthConfig,
  linkedInOAuthConfig,
  isOAuthConfigured,
  GOOGLE_CALLBACK_URL,
  FACEBOOK_CALLBACK_URL,
  LINKEDIN_CALLBACK_URL,
  FRONTEND_URL
} from '../config/oauth.config.js';

const router = express.Router();

// Debug logging to verify routes are loaded
logger.info('[OAuth] Loading OAuth routes module...');

// Test route to verify OAuth router is working
router.get('/test', (req, res) => {
  res.json({
    message: 'OAuth router is working!',
    timestamp: new Date().toISOString(),
    availableRoutes: ['/google', '/google/callback', '/facebook', '/facebook/callback', '/linkedin', '/linkedin/callback']
  });
});

/**
 * Enterprise-Grade Manual OAuth 2.0 Implementation
 *
 * This implementation doesn't require Passport.js and works directly with
 * OAuth 2.0 providers. It's more flexible and secure than using Passport.
 *
 * Security Features:
 * - State parameter for CSRF protection
 * - Code exchange (not implicit grant)
 * - Token validation
 * - Profile verification
 *
 * Routes: /v2/auth/google, /v2/auth/facebook, /v2/auth/linkedin
 */

// Store state parameters temporarily (in production, use Redis)
const oauthStates = new Map<string, { timestamp: number; provider: string }>();

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start OAuth state cleanup interval
 * MUST be called after server starts to avoid module-load side effects
 */
export function startOAuthStateCleanup() {
  if (cleanupInterval) return; // Already started

  // Clean up old states every 10 minutes
  cleanupInterval = setInterval(() => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [state, data] of oauthStates.entries()) {
      if (data.timestamp < tenMinutesAgo) {
        oauthStates.delete(state);
      }
    }
  }, 10 * 60 * 1000);

  logger.info('[OAuth] State cleanup interval started');
}

/**
 * Stop OAuth state cleanup (for graceful shutdown)
 */
export function stopOAuthStateCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('[OAuth] State cleanup interval stopped');
  }
}

/**
 * Generate secure state parameter for CSRF protection
 */
function generateState(provider: string): string {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, { timestamp: Date.now(), provider });
  return state;
}

/**
 * Validate state parameter
 */
function validateState(state: string, provider: string): boolean {
  const stateData = oauthStates.get(state);
  if (!stateData) return false;
  if (stateData.provider !== provider) return false;

  // State must be used within 10 minutes
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  if (stateData.timestamp < tenMinutesAgo) {
    oauthStates.delete(state);
    return false;
  }

  oauthStates.delete(state); // One-time use
  return true;
}

// ===========================================
// GOOGLE OAUTH
// ===========================================

/**
 * Initiate Google OAuth flow
 * GET /v2/auth/google
 */
router.get('/google', (req, res) => {
  try {
    if (!isOAuthConfigured('google')) {
      return res.status(503).json({
        error: 'Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.'
      });
    }

    const state = generateState('google');
    const scope = encodeURIComponent('profile email');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${googleOAuthConfig.clientID}&` +
      `redirect_uri=${encodeURIComponent(GOOGLE_CALLBACK_URL)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`;

    logger.info('[OAuth Google] Initiating OAuth flow');
    res.redirect(authUrl);
  } catch (error) {
    logger.error('[OAuth Google] Error initiating flow:', error);
    res.redirect(`${FRONTEND_URL}?oauth_error=google_init_failed`);
  }
});

/**
 * Google OAuth callback
 * GET /v2/auth/google/callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('[OAuth Google] Authorization error:', error);
      return res.redirect(`${FRONTEND_URL}?oauth_error=google_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}?oauth_error=missing_params`);
    }

    // Validate state for CSRF protection
    if (!validateState(state as string, 'google')) {
      logger.error('[OAuth Google] Invalid state parameter');
      return res.redirect(`${FRONTEND_URL}?oauth_error=invalid_state`);
    }

    // Exchange authorization code for tokens
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: googleOAuthConfig.clientID,
      client_secret: googleOAuthConfig.clientSecret,
      redirect_uri: GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;

    // Get user profile
    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const googleProfile = profileResponse.data;

    // Create OAuth profile
    const profile: OAuthProfile = {
      provider: 'google',
      id: googleProfile.id,
      email: googleProfile.email,
      firstName: googleProfile.given_name,
      lastName: googleProfile.family_name,
      profilePicture: googleProfile.picture,
      raw: googleProfile
    };

    // Handle OAuth callback
    await authController.handleOAuthCallback(req, res, profile);
  } catch (error: any) {
    logger.error('[OAuth Google] Callback error:', error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}?oauth_error=google_callback_failed`);
  }
});

// ===========================================
// FACEBOOK OAUTH
// ===========================================

/**
 * Initiate Facebook OAuth flow
 * GET /v2/auth/facebook
 */
router.get('/facebook', (req, res) => {
  try {
    if (!isOAuthConfigured('facebook')) {
      return res.status(503).json({
        error: 'Facebook OAuth is not configured. Please add FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to environment variables.'
      });
    }

    const state = generateState('facebook');
    const scope = encodeURIComponent('email,public_profile');

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${facebookOAuthConfig.clientID}&` +
      `redirect_uri=${encodeURIComponent(FACEBOOK_CALLBACK_URL)}&` +
      `scope=${scope}&` +
      `state=${state}`;

    logger.info('[OAuth Facebook] Initiating OAuth flow');
    res.redirect(authUrl);
  } catch (error) {
    logger.error('[OAuth Facebook] Error initiating flow:', error);
    res.redirect(`${FRONTEND_URL}?oauth_error=facebook_init_failed`);
  }
});

/**
 * Facebook OAuth callback
 * GET /v2/auth/facebook/callback
 */
router.get('/facebook/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('[OAuth Facebook] Authorization error:', error);
      return res.redirect(`${FRONTEND_URL}?oauth_error=facebook_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}?oauth_error=missing_params`);
    }

    // Validate state
    if (!validateState(state as string, 'facebook')) {
      logger.error('[OAuth Facebook] Invalid state parameter');
      return res.redirect(`${FRONTEND_URL}?oauth_error=invalid_state`);
    }

    // Exchange code for access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: facebookOAuthConfig.clientID,
        client_secret: facebookOAuthConfig.clientSecret,
        redirect_uri: FACEBOOK_CALLBACK_URL,
        code
      }
    });

    const { access_token } = tokenResponse.data;

    // Get user profile
    const profileResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        fields: 'id,email,first_name,last_name,picture.type(large)',
        access_token
      }
    });

    const fbProfile = profileResponse.data;

    // Create OAuth profile
    const profile: OAuthProfile = {
      provider: 'facebook',
      id: fbProfile.id,
      email: fbProfile.email,
      firstName: fbProfile.first_name,
      lastName: fbProfile.last_name,
      profilePicture: fbProfile.picture?.data?.url,
      raw: fbProfile
    };

    // Handle OAuth callback
    await authController.handleOAuthCallback(req, res, profile);
  } catch (error: any) {
    logger.error('[OAuth Facebook] Callback error:', error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}?oauth_error=facebook_callback_failed`);
  }
});

// ===========================================
// LINKEDIN OAUTH
// ===========================================

/**
 * Initiate LinkedIn OAuth flow
 * GET /v2/auth/linkedin
 */
router.get('/linkedin', (req, res) => {
  try {
    if (!isOAuthConfigured('linkedin')) {
      return res.status(503).json({
        error: 'LinkedIn OAuth is not configured. Please add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to environment variables.'
      });
    }

    const state = generateState('linkedin');
    const scope = encodeURIComponent('r_liteprofile r_emailaddress');

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
      `response_type=code&` +
      `client_id=${linkedInOAuthConfig.clientID}&` +
      `redirect_uri=${encodeURIComponent(LINKEDIN_CALLBACK_URL)}&` +
      `scope=${scope}&` +
      `state=${state}`;

    logger.info('[OAuth LinkedIn] Initiating OAuth flow');
    res.redirect(authUrl);
  } catch (error) {
    logger.error('[OAuth LinkedIn] Error initiating flow:', error);
    res.redirect(`${FRONTEND_URL}?oauth_error=linkedin_init_failed`);
  }
});

/**
 * LinkedIn OAuth callback
 * GET /v2/auth/linkedin/callback
 */
router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.error('[OAuth LinkedIn] Authorization error:', error);
      return res.redirect(`${FRONTEND_URL}?oauth_error=linkedin_denied`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}?oauth_error=missing_params`);
    }

    // Validate state
    if (!validateState(state as string, 'linkedin')) {
      logger.error('[OAuth LinkedIn] Invalid state parameter');
      return res.redirect(`${FRONTEND_URL}?oauth_error=invalid_state`);
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINKEDIN_CALLBACK_URL,
        client_id: linkedInOAuthConfig.clientID,
        client_secret: linkedInOAuthConfig.clientSecret
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token } = tokenResponse.data;

    // Get user profile
    const [profileResponse, emailResponse] = await Promise.all([
      axios.get('https://api.linkedin.com/v2/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      }),
      axios.get('https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))', {
        headers: { Authorization: `Bearer ${access_token}` }
      })
    ]);

    const linkedinProfile = profileResponse.data;
    const emailData = emailResponse.data;

    const email = emailData.elements[0]?.['handle~']?.emailAddress;
    const firstName = linkedinProfile.localizedFirstName;
    const lastName = linkedinProfile.localizedLastName;

    // Create OAuth profile
    const profile: OAuthProfile = {
      provider: 'linkedin',
      id: linkedinProfile.id,
      email,
      firstName,
      lastName,
      raw: linkedinProfile
    };

    // Handle OAuth callback
    await authController.handleOAuthCallback(req, res, profile);
  } catch (error: any) {
    logger.error('[OAuth LinkedIn] Callback error:', error.response?.data || error.message);
    res.redirect(`${FRONTEND_URL}?oauth_error=linkedin_callback_failed`);
  }
});

// ===========================================
// ACCOUNT MANAGEMENT
// ===========================================

/**
 * Get linked OAuth accounts
 * GET /v2/auth/oauth/linked
 */
router.get('/oauth/linked', authenticate, authController.getLinkedAccounts.bind(authController));

/**
 * Unlink OAuth account
 * DELETE /v2/auth/oauth/:provider
 */
router.delete('/oauth/:provider', authenticate, authController.unlinkOAuthAccount.bind(authController));

logger.info('[OAuth] OAuth routes registered successfully: /google, /facebook, /linkedin, /oauth/linked');

export default router;
