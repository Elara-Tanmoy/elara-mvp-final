import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/auth.js';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    organizationId: string;
  };
  organization?: {
    id: string;
    tier: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    let token: string;

    if (authHeader.startsWith('Bearer ')) {
      // JWT token
      token = authHeader.substring(7);
      const payload = verifyAccessToken(token);

      if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        include: { organization: true }
      });

      if (!user || !user.isActive) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }

      req.user = {
        userId: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      };

      req.organization = {
        id: user.organization.id,
        tier: user.organization.tier
      };
    } else if (authHeader.startsWith('ApiKey ')) {
      // API Key authentication
      const apiKey = authHeader.substring(7);

      const organization = await prisma.organization.findUnique({
        where: { apiKey },
        include: { users: { where: { role: 'owner' }, take: 1 } }
      });

      if (!organization || !organization.isActive) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      const ownerUser = organization.users[0];

      req.user = {
        userId: ownerUser.id,
        email: ownerUser.email,
        role: ownerUser.role,
        organizationId: organization.id
      };

      req.organization = {
        id: organization.id,
        tier: organization.tier
      };
    } else {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole(['admin', 'owner']);
export const requireOwner = requireRole(['owner']);
