import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { redis } from '../config/redis.js';
import { AuthRequest } from './auth.middleware.js';
import { logger } from '../config/logger.js';

const RATE_LIMITS = {
  free: parseInt(process.env.RATE_LIMIT_FREE || '100'),
  pro: parseInt(process.env.RATE_LIMIT_PRO || '1000'),
  enterprise: parseInt(process.env.RATE_LIMIT_ENTERPRISE || '10000')
};

interface RateLimitStore {
  increment: (key: string) => Promise<{ totalHits: number; resetTime: Date }>;
  decrement: (key: string) => Promise<void>;
  resetKey: (key: string) => Promise<void>;
}

const createRedisStore = (): RateLimitStore => {
  return {
    increment: async (key: string) => {
      const hits = await redis.incr(key);

      if (hits === 1) {
        await redis.expire(key, 3600); // 1 hour window
      }

      const ttl = await redis.ttl(key);
      const resetTime = new Date(Date.now() + ttl * 1000);

      return { totalHits: hits, resetTime };
    },
    decrement: async (key: string) => {
      await redis.decr(key);
    },
    resetKey: async (key: string) => {
      await redis.del(key);
    }
  };
};

export const createTierBasedRateLimiter = () => {
  const store = createRedisStore();

  return async (req: AuthRequest, res: Response, next: Function) => {
    try {
      const organization = req.organization;

      if (!organization) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const tier = organization.tier as keyof typeof RATE_LIMITS;
      const limit = RATE_LIMITS[tier] || RATE_LIMITS.free;

      const key = `ratelimit:${organization.id}:${Math.floor(Date.now() / 3600000)}`;
      const { totalHits, resetTime } = await store.increment(key);

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - totalHits).toString());
      res.setHeader('X-RateLimit-Reset', resetTime.toISOString());

      if (totalHits > limit) {
        logger.warn(`Rate limit exceeded for organization ${organization.id}`);
        res.status(429).json({
          error: 'Rate limit exceeded',
          limit,
          resetTime: resetTime.toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      next();
    }
  };
};

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Required when behind a proxy (GKE load balancer)
  trustProxy: 2,  // GKE Ingress + GCP Load Balancer
  skip: (req: Request) => {
    return req.path.startsWith('/health') || req.path.startsWith('/metrics');
  }
});

export default createTierBasedRateLimiter;
