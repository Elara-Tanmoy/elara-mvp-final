import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import axios from 'axios';

const prisma = new PrismaClient();

// Proxy service URL from environment
const PROXY_SERVICE_URL = process.env.PROXY_SERVICE_URL || 'http://localhost:8080';

/**
 * Proxy Controller
 * Manages secure web proxy sessions and requests
 */
export class ProxyController {
  /**
   * Health check for proxy feature
   * GET /api/v2/proxy/health
   */
  async healthCheck(req: AuthRequest, res: Response) {
    try {
      const proxyServiceUrl = PROXY_SERVICE_URL;
      let proxyServiceHealthy = false;
      let proxyServiceError = null;

      // Try to reach proxy service
      try {
        const healthResponse = await axios.get(`${proxyServiceUrl}/health`, { timeout: 5000 });
        proxyServiceHealthy = healthResponse.data.status === 'healthy';
      } catch (error: any) {
        proxyServiceError = error.message;
        logger.error('[Proxy] Health check failed:', error.message);
      }

      return res.json({
        success: true,
        data: {
          proxyServiceUrl,
          proxyServiceHealthy,
          proxyServiceError,
          configured: !!process.env.PROXY_SERVICE_URL
        }
      });
    } catch (error) {
      logger.error('[Proxy] Health check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to check proxy health'
      });
    }
  }

  /**
   * Cleanup expired sessions AGGRESSIVELY
   * Helper method to clean up old active sessions
   */
  private async cleanupExpiredSessions(userId: string) {
    // Expire sessions older than 5 minutes (very aggressive)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Also check lastActivityAt - if no activity for 2 minutes, expire it
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

    // Find and update expired sessions based on start time OR last activity
    const expiredCount = await prisma.proxySession.updateMany({
      where: {
        userId,
        status: 'active',
        OR: [
          {
            startedAt: {
              lt: fiveMinutesAgo
            }
          },
          {
            lastActivityAt: {
              lt: twoMinutesAgo
            }
          }
        ]
      },
      data: {
        status: 'expired',
        endedAt: new Date()
      }
    });

    if (expiredCount.count > 0) {
      logger.info(`[Proxy] Cleaned up ${expiredCount.count} expired sessions for user ${userId}`);
    }

    return expiredCount.count;
  }

  /**
   * Create a new proxy session
   * POST /api/v2/proxy/session
   */
  async createSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({
          success: false,
          error: 'URL is required'
        });
      }

      // Normalize and validate URL
      const cleanUrl = url.trim();
      let normalizedUrl = cleanUrl;

      // Try to validate with external proxy service if configured
      const useProxyService = process.env.PROXY_SERVICE_URL && process.env.PROXY_SERVICE_URL !== 'http://localhost:8080';

      if (useProxyService) {
        try {
          const validationResponse = await axios.post(
            `${PROXY_SERVICE_URL}/validate`,
            { url: cleanUrl },
            { timeout: 5000 }
          );

          if (!validationResponse.data.valid) {
            logger.warn(`[Proxy] URL blocked by proxy service: ${cleanUrl}`);
            return res.status(403).json({
              success: false,
              error: validationResponse.data.error || 'Invalid URL',
              blocked: true
            });
          }

          normalizedUrl = validationResponse.data.url || cleanUrl;
          logger.info(`[Proxy] URL normalized by proxy service: ${cleanUrl} -> ${normalizedUrl}`);
        } catch (error: any) {
          logger.warn(`[Proxy] Proxy service validation failed (${error.message}), falling back to local validation`);
          // Fall through to local validation
        }
      }

      // Fallback: Local URL validation (when proxy service not available)
      if (!useProxyService || normalizedUrl === cleanUrl) {
        try {
          // Add protocol if missing
          let urlToValidate = cleanUrl;
          if (!urlToValidate.match(/^https?:\/\//i)) {
            urlToValidate = 'https://' + urlToValidate;
          }

          // Validate URL format
          const urlObj = new URL(urlToValidate);

          // Basic security checks
          if (!urlObj.hostname || urlObj.hostname.length < 3) {
            logger.warn(`[Proxy] Invalid hostname: ${cleanUrl}`);
            return res.status(400).json({
              success: false,
              error: 'Invalid URL: hostname too short'
            });
          }

          // Block localhost/private IPs in production
          if (process.env.NODE_ENV === 'production') {
            const privateIPPatterns = [
              /^localhost$/i,
              /^127\./,
              /^10\./,
              /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
              /^192\.168\./,
              /^::1$/,
              /^fe80:/i
            ];

            if (privateIPPatterns.some(pattern => pattern.test(urlObj.hostname))) {
              logger.warn(`[Proxy] Blocked private/local URL: ${cleanUrl}`);
              return res.status(403).json({
                success: false,
                error: 'Access to local/private URLs is not allowed',
                blocked: true
              });
            }
          }

          normalizedUrl = urlToValidate;
          logger.info(`[Proxy] URL validated locally: ${cleanUrl} -> ${normalizedUrl}`);
        } catch (error: any) {
          logger.error(`[Proxy] Local URL validation failed for "${cleanUrl}":`, error.message);
          return res.status(400).json({
            success: false,
            error: 'Invalid URL format. Please enter a valid website address (e.g., google.com)'
          });
        }
      }

      // Cleanup expired sessions first
      await this.cleanupExpiredSessions(userId);

      // Check for active sessions for this user
      const activeSessions = await prisma.proxySession.count({
        where: {
          userId,
          status: 'active'
        }
      });

      // Limit to 10 concurrent sessions (for multi-tab support)
      if (activeSessions >= 10) {
        return res.status(429).json({
          success: false,
          error: 'Maximum concurrent sessions reached (10). Please disconnect an existing session first.'
        });
      }

      // Create new session with normalized URL
      const session = await prisma.proxySession.create({
        data: {
          userId,
          targetUrl: normalizedUrl,
          status: 'active'
        }
      });

      logger.info(`[Proxy] Created session ${session.sessionToken} for user ${userId} - URL: ${normalizedUrl}`);

      return res.status(201).json({
        success: true,
        data: {
          sessionToken: session.sessionToken,
          targetUrl: session.targetUrl,
          startedAt: session.startedAt,
          status: session.status
        }
      });
    } catch (error) {
      logger.error('[Proxy] Error creating session:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create proxy session'
      });
    }
  }

  /**
   * Get session details
   * GET /api/v2/proxy/session/:sessionToken
   */
  async getSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { sessionToken } = req.params;

      const session = await prisma.proxySession.findFirst({
        where: {
          sessionToken,
          userId
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      // Check if session should be expired (1 hour)
      const sessionAge = Date.now() - session.startedAt.getTime();
      const oneHour = 60 * 60 * 1000;

      if (sessionAge > oneHour && session.status === 'active') {
        await prisma.proxySession.update({
          where: { id: session.id },
          data: {
            status: 'expired',
            endedAt: new Date()
          }
        });
        session.status = 'expired';
        session.endedAt = new Date();
      }

      return res.json({
        success: true,
        data: {
          sessionToken: session.sessionToken,
          targetUrl: session.targetUrl,
          status: session.status,
          requestCount: session.requestCount,
          bytesTransferred: session.bytesTransferred.toString(),
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          lastActivityAt: session.lastActivityAt
        }
      });
    } catch (error) {
      logger.error('[Proxy] Error getting session:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get session details'
      });
    }
  }

  /**
   * Make a proxied request
   * POST /api/v2/proxy/request
   */
  async makeRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { sessionToken, url } = req.body;

      if (!sessionToken || !url) {
        return res.status(400).json({
          success: false,
          error: 'Session token and URL are required'
        });
      }

      // Verify session exists and belongs to user
      const session = await prisma.proxySession.findFirst({
        where: {
          sessionToken,
          userId,
          status: 'active'
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Active session not found'
        });
      }

      // Check session age
      const sessionAge = Date.now() - session.startedAt.getTime();
      const oneHour = 60 * 60 * 1000;

      if (sessionAge > oneHour) {
        await prisma.proxySession.update({
          where: { id: session.id },
          data: {
            status: 'expired',
            endedAt: new Date()
          }
        });

        return res.status(403).json({
          success: false,
          error: 'Session expired. Please create a new session.',
          expired: true
        });
      }

      // Make request through proxy service or locally
      const startTime = Date.now();
      let proxyResponse: any;
      const useProxyService = process.env.PROXY_SERVICE_URL && process.env.PROXY_SERVICE_URL !== 'http://localhost:8080';

      if (useProxyService) {
        // Use external proxy service
        try {
          proxyResponse = await axios.post(
            `${PROXY_SERVICE_URL}/proxy`,
            {
              url,
              sessionId: sessionToken
            },
            {
              timeout: 35000
            }
          );
        } catch (error: any) {
          logger.warn(`[Proxy] Proxy service failed (${error.message}), falling back to local fetch`);
          // Fall through to local fetch
        }
      }

      // Fallback: Local HTTP fetch (when proxy service not available)
      if (!useProxyService || !proxyResponse) {
        try {
          // Check for known blocked sites
          const hostname = new URL(url).hostname.toLowerCase();
          const blockedSites = ['google.com', 'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com'];
          const isLikelyBlocked = blockedSites.some(site => hostname.includes(site));

          if (isLikelyBlocked) {
            // Return helpful message for sites that block automated access
            logger.warn(`[Proxy] ${url} likely blocks automated access`);
            throw new Error(`${hostname} actively blocks automated browsers. This is a limitation of the secure browser without a dedicated proxy service. Try visiting less restrictive websites or enable a proxy service for full compatibility.`);
          }

          const fetchResponse = await axios.get(url, {
            timeout: 15000, // Reduced to 15 seconds
            maxRedirects: 5,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'DNT': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1'
            },
            validateStatus: (status) => status < 500 // Accept 4xx as valid responses
          });

          // Format response to match proxy service format
          proxyResponse = {
            data: {
              content: fetchResponse.data,
              statusCode: fetchResponse.status,
              finalUrl: fetchResponse.request?.responseURL || url,
              contentLength: fetchResponse.data?.length || 0,
              headers: fetchResponse.headers
            }
          };

          logger.info(`[Proxy] Local fetch successful: ${url} (${fetchResponse.status})`);
        } catch (error: any) {
          const responseTime = Date.now() - startTime;

          // Log failed request
          await prisma.proxyRequest.create({
            data: {
              sessionToken,
              requestUrl: url,
              success: false,
              errorMessage: error.message,
              responseTime
            }
          });

          logger.error(`[Proxy] Local fetch failed for ${url}:`, error.message);

          if (error.response) {
            return res.status(error.response.status).json({
              success: false,
              error: error.response.data?.error || `HTTP ${error.response.status}: ${error.response.statusText}`
            });
          }

          return res.status(502).json({
            success: false,
            error: `Failed to fetch URL: ${error.message}`
          });
        }
      }

      const responseTime = Date.now() - startTime;
      const bytesTransferred = proxyResponse.data.contentLength || 0;

      // Log successful request
      await prisma.proxyRequest.create({
        data: {
          sessionToken,
          requestUrl: url,
          statusCode: proxyResponse.data.statusCode,
          bytesTransferred,
          responseTime,
          success: true
        }
      });

      // Update session stats
      await prisma.proxySession.update({
        where: { id: session.id },
        data: {
          requestCount: { increment: 1 },
          bytesTransferred: { increment: bytesTransferred },
          lastActivityAt: new Date()
        }
      });

      // FIX: Inject base tag and optimize HTML for proper resource loading
      let content = proxyResponse.data.content;
      const finalUrl = proxyResponse.data.finalUrl || url;

      if (content && typeof content === 'string' && content.includes('<html')) {
        // Extract base URL from finalUrl
        try {
          const urlObj = new URL(finalUrl);
          const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

          // Inject base tag right after <head> tag
          content = content.replace(
            /(<head[^>]*>)/i,
            `$1\n<base href="${baseUrl}">\n<meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">`
          );

          // Add performance optimizations
          content = content.replace(
            /(<\/head>)/i,
            `<style>img{max-width:100%;height:auto;}body{overflow-x:hidden;}</style>\n$1`
          );

          proxyResponse.data.content = content;
          logger.info(`[Proxy] Injected base tag: ${baseUrl}`);
        } catch (error) {
          logger.error('[Proxy] Failed to inject base tag:', error);
        }
      }

      return res.json({
        success: true,
        data: proxyResponse.data
      });
    } catch (error) {
      logger.error('[Proxy] Error making request:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to make proxied request'
      });
    }
  }

  /**
   * Disconnect a session
   * POST /api/v2/proxy/session/:sessionToken/disconnect
   */
  async disconnectSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { sessionToken } = req.params;

      const session = await prisma.proxySession.findFirst({
        where: {
          sessionToken,
          userId
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      if (session.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Session is not active'
        });
      }

      // Update session to disconnected
      const updatedSession = await prisma.proxySession.update({
        where: { id: session.id },
        data: {
          status: 'disconnected',
          endedAt: new Date()
        }
      });

      const duration = updatedSession.endedAt!.getTime() - updatedSession.startedAt.getTime();

      logger.info(`[Proxy] Disconnected session ${sessionToken} - Requests: ${updatedSession.requestCount}, Bytes: ${updatedSession.bytesTransferred}`);

      return res.json({
        success: true,
        data: {
          sessionToken: updatedSession.sessionToken,
          status: updatedSession.status,
          requestCount: updatedSession.requestCount,
          bytesTransferred: updatedSession.bytesTransferred.toString(),
          duration: Math.floor(duration / 1000), // seconds
          startedAt: updatedSession.startedAt,
          endedAt: updatedSession.endedAt
        }
      });
    } catch (error) {
      logger.error('[Proxy] Error disconnecting session:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to disconnect session'
      });
    }
  }

  /**
   * Get user's session history
   * GET /api/v2/proxy/sessions
   */
  async getSessions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { page = '1', limit = '10', status } = req.query;

      const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
      const take = parseInt(limit as string);

      const where: any = { userId };
      if (status) {
        where.status = status;
      }

      const [sessions, total] = await Promise.all([
        prisma.proxySession.findMany({
          where,
          skip,
          take,
          orderBy: { startedAt: 'desc' }
        }),
        prisma.proxySession.count({ where })
      ]);

      return res.json({
        success: true,
        data: {
          sessions: sessions.map(s => ({
            sessionToken: s.sessionToken,
            targetUrl: s.targetUrl,
            status: s.status,
            requestCount: s.requestCount,
            bytesTransferred: s.bytesTransferred.toString(),
            startedAt: s.startedAt,
            endedAt: s.endedAt,
            lastActivityAt: s.lastActivityAt
          })),
          total,
          page: parseInt(page as string),
          pages: Math.ceil(total / take)
        }
      });
    } catch (error) {
      logger.error('[Proxy] Error getting sessions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get session history'
      });
    }
  }

  /**
   * Disconnect all active sessions
   * POST /api/v2/proxy/disconnect-all
   */
  async disconnectAllSessions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;

      // Update all active sessions to disconnected
      const result = await prisma.proxySession.updateMany({
        where: {
          userId,
          status: 'active'
        },
        data: {
          status: 'disconnected',
          endedAt: new Date()
        }
      });

      logger.info(`[Proxy] Disconnected ${result.count} active sessions for user ${userId}`);

      return res.json({
        success: true,
        data: {
          disconnected: result.count
        }
      });
    } catch (error) {
      logger.error('[Proxy] Error disconnecting all sessions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to disconnect sessions'
      });
    }
  }

  /**
   * Get statistics for a session
   * GET /api/v2/proxy/session/:sessionToken/stats
   */
  async getSessionStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { sessionToken } = req.params;

      const session = await prisma.proxySession.findFirst({
        where: {
          sessionToken,
          userId
        }
      });

      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found'
        });
      }

      // Get request breakdown
      const requests = await prisma.proxyRequest.findMany({
        where: { sessionToken },
        orderBy: { timestamp: 'asc' }
      });

      const successfulRequests = requests.filter(r => r.success).length;
      const failedRequests = requests.filter(r => !r.success).length;
      const avgResponseTime = requests.length > 0
        ? requests.reduce((sum, r) => sum + (r.responseTime || 0), 0) / requests.length
        : 0;

      const duration = session.endedAt
        ? session.endedAt.getTime() - session.startedAt.getTime()
        : Date.now() - session.startedAt.getTime();

      return res.json({
        success: true,
        data: {
          sessionToken: session.sessionToken,
          status: session.status,
          totalRequests: session.requestCount,
          successfulRequests,
          failedRequests,
          bytesTransferred: session.bytesTransferred.toString(),
          averageResponseTime: Math.round(avgResponseTime),
          duration: Math.floor(duration / 1000), // seconds
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          recentRequests: requests.slice(-10).map(r => ({
            url: r.requestUrl,
            statusCode: r.statusCode,
            success: r.success,
            timestamp: r.timestamp
          }))
        }
      });
    } catch (error) {
      logger.error('[Proxy] Error getting session stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get session statistics'
      });
    }
  }
}

export const proxyController = new ProxyController();
