// EMERGENCY REDIS BYPASS - DO NOT REMOVE
if (!process.env.REDIS_URL) {
  const mockRedis = {
    get: async () => null,
    set: async () => 'OK',
    connect: async () => {},
    on: () => {},
    quit: async () => {}
  };
  (global as any).redisClient = mockRedis;
  console.log('[PRODUCTION] Redis bypassed - using mock');
}

// FIX: BigInt serialization for JSON responses
// This prevents "Do not know how to serialize a BigInt" errors
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};

import 'dotenv/config';
console.log('[IMPORT TRACE] dotenv loaded');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
console.log('[IMPORT TRACE] express, cors, helmet, http loaded');

import { logger } from './config/logger.js';
console.log('[IMPORT TRACE] logger loaded');

import { initializeSocketServer, closeSocketServer } from './config/socket.js';
console.log('[IMPORT TRACE] socket.io config loaded');

import { prisma } from './config/database.js';
console.log('[IMPORT TRACE] prisma loaded');

import { redis } from './config/redis.js';
console.log('[IMPORT TRACE] redis loaded');

import { initChromaCollections } from './config/chromadb.js';
console.log('[IMPORT TRACE] chromadb loaded');

import { neo4jConnection } from './config/neo4j.js';
console.log('[IMPORT TRACE] neo4j loaded');

import { web3Service } from './services/blockchain/web3Service.js';
console.log('[IMPORT TRACE] web3 loaded');

import { federatedLearningService } from './services/ml/federatedLearning.service.js';
console.log('[IMPORT TRACE] federated learning loaded');

import { startWorker } from './services/queue/scan.queue.js';
console.log('[IMPORT TRACE] startWorker loaded');

import { globalRateLimiter } from './middleware/rateLimiter.middleware.js';
console.log('[IMPORT TRACE] rate limiter loaded');

import routes from './routes/index.js';
console.log('[IMPORT TRACE] routes loaded - THIS SHOULD APPEAR AFTER BigQuery warning');

import { startOAuthStateCleanup, stopOAuthStateCleanup } from './routes/oauth.routes.js';
console.log('[IMPORT TRACE] OAuth cleanup functions loaded');

import fs from 'fs';
import path from 'path';
console.log('[IMPORT TRACE] fs and path loaded');

console.log('[IMPORT TRACE] ========================================');
console.log('[IMPORT TRACE] ALL IMPORTS COMPLETED SUCCESSFULLY');
console.log('[IMPORT TRACE] ========================================');

const app: any = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Trust proxy for Render.com and other reverse proxies (CRITICAL FOR RATE LIMITING)
// This allows Express to trust X-Forwarded-For header from Render
app.set('trust proxy', true);

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Ensure logs directory exists
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs', { recursive: true });
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    }
  }
}));

// CORS configuration
const allowedOrigins = [
  'http://0.0.0.0:5173',
  'https://elara-platform.vercel.app',
  'https://elara-frontend.vercel.app',
  'https://elara-7c108p1d1-tanmoys-projects-1b158c68.vercel.app',
  'https://elara-mvp.vercel.app',
  process.env.CORS_ORIGIN
].filter((origin): origin is string => typeof origin === 'string');

const corsOrigins = process.env.CORS_ORIGIN
  ? [...new Set([...allowedOrigins, ...process.env.CORS_ORIGIN.split(',').filter(Boolean)])]
  : allowedOrigins;

app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting
app.use(globalRateLimiter);

// Request logging middleware
app.use((req: any, res: any, next: any) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint (for Render.com health checks at /health)
app.get('/health', async (req: any, res: any) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected'
    });
  }
});

// Routes
logger.info('Loading routes...');
try {
  if (!routes) {
    logger.error('Routes module is undefined!');
  } else {
    logger.info(`Routes type: ${typeof routes}`);
    app.use('/api', routes);
    logger.info('Routes loaded successfully at /api prefix');
  }
} catch (error) {
  logger.error('Failed to load routes:', error);
  throw error;
}

console.log('[TRACE] After routes section - about to register 404 handler');

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

console.log('[TRACE] After 404 handler registration');

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);

  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request entity too large' });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

console.log('[TRACE] After error handling middleware registration');

// Graceful shutdown handler
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  try {
    // Close Socket.io server
    await closeSocketServer();

    // Stop OAuth state cleanup
    stopOAuthStateCleanup();

    // Stop threat intelligence cron
    try {
      const { threatIntelCron } = await import('./services/threat-intel/threatIntelCron.js');
      threatIntelCron.stop();
      logger.info('Threat Intelligence cron stopped');
    } catch (error) {
      logger.warn('Threat Intel cron shutdown warning:', error);
    }

    await prisma.$disconnect();
    if (process.env.REDIS_URL) {
      await redis.quit();
    }
    // Close Neo4j connection
    try {
      await neo4jConnection.close();
      logger.info('Neo4j connection closed');
    } catch (error) {
      logger.warn('Neo4j shutdown warning:', error);
    }
    // Close Web3 connection
    try {
      await web3Service.close();
      logger.info('Web3 service closed');
    } catch (error) {
      logger.warn('Web3 shutdown warning:', error);
    }
    logger.info('Connections closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

console.log('[TRACE] After shutdown handler definition');

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('[TRACE] After process signal handlers registration');

// CRITICAL: Catch all unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('');
  logger.error('========================================');
  logger.error('UNHANDLED PROMISE REJECTION DETECTED!');
  logger.error('========================================');
  logger.error('Reason:', reason);
  logger.error('Promise:', promise);
  logger.error('========================================');
  logger.error('');
});

process.on('uncaughtException', (error) => {
  logger.error('');
  logger.error('========================================');
  logger.error('UNCAUGHT EXCEPTION DETECTED!');
  logger.error('========================================');
  logger.error('Error:', error);
  logger.error('Stack:', error.stack);
  logger.error('========================================');
  logger.error('');
  // Give logger time to write, then exit
  setTimeout(() => process.exit(1), 1000);
});

console.log('[TRACE] After unhandled error handlers registration');

// Start server
const startServer = async () => {
  logger.info('');
  logger.info('🚀 [CRITICAL] startServer() function CALLED - beginning execution');
  logger.info('');

  try {
    logger.info('');
    logger.info('');
    logger.info('           ELARA BACKEND SERVER STARTING v2.0              ');
    logger.info('');
    logger.info('');
    logger.info('🔍 [DEBUG] Starting server initialization...');

    // Test database connection
    await prisma.$connect();
    logger.info(' Database connected');

    // Initialize ChromaDB collections
    await initChromaCollections();
    logger.info(' ChromaDB initialized');

    // Initialize Neo4j graph database (Phase 1 Enhancement)
    logger.info('🔍 [DEBUG] Attempting Neo4j connection...');
    try {
      await neo4jConnection.connect();
      logger.info(' Neo4j Trust Graph database connected');
    } catch (error) {
      logger.warn(' Neo4j connection failed (optional service, continuing...)');
      logger.error('🔍 [DEBUG] Neo4j error:', error);
    }
    logger.info('🔍 [DEBUG] Neo4j step completed');

    // Initialize Web3 blockchain service (Phase 3 Enhancement)
    logger.info('🔍 [DEBUG] Attempting Web3 initialization...');
    try {
      await web3Service.initialize();
      logger.info(' Web3 blockchain service initialized');
    } catch (error) {
      logger.warn(' Web3 service initialization failed (optional service, continuing...)');
      logger.error('🔍 [DEBUG] Web3 error:', error);
    }
    logger.info('🔍 [DEBUG] Web3 step completed');

    // Initialize Federated Learning service (Phase 3 Enhancement)
    logger.info('🔍 [DEBUG] Attempting Federated Learning initialization...');
    try {
      await federatedLearningService.initialize();
      logger.info(' Federated Learning service initialized');
    } catch (error) {
      logger.warn(' Federated Learning initialization failed (optional service, continuing...)');
      logger.error('🔍 [DEBUG] Federated Learning error:', error);
    }
    logger.info('🔍 [DEBUG] Federated Learning step completed');

    // Initialize Threat Intelligence automated syncs
    logger.info('🔍 [DEBUG] Attempting Threat Intelligence cron initialization...');
    try {
      const { threatIntelCron } = await import('./services/threat-intel/threatIntelCron.js');
      await threatIntelCron.initialize();
      logger.info(' Threat Intelligence automated syncs started');
    } catch (error) {
      logger.warn(' Threat Intelligence cron initialization failed (continuing...)');
      logger.error('🔍 [DEBUG] Threat Intel error:', error);
    }
    logger.info('🔍 [DEBUG] Threat Intelligence step completed');

    // Start queue worker (only if Redis is available)
    logger.info('🔍 [DEBUG] Starting queue worker...');
    await startWorker();
    if (process.env.REDIS_URL) {
      logger.info(' Queue worker started');
    } else {
      logger.info(' Queue worker disabled (Redis not available)');
    }
    logger.info('🔍 [DEBUG] Queue worker step completed');

    // Initialize Socket.io server
    logger.info('🔍 [DEBUG] Initializing Socket.io server...');
    initializeSocketServer(httpServer);
    logger.info('✅ Socket.io server initialized');

    // Initialize Scan Logs WebSocket server
    logger.info('🔍 [DEBUG] Initializing Scan Logs WebSocket server...');
    const { ScanLogsWebSocketServer } = await import('./websocket/scanLogs.ws.js');
    new ScanLogsWebSocketServer(httpServer);
    logger.info('✅ Scan Logs WebSocket server initialized at /ws/scan-logs');

    // Start Express server
    logger.info('🔍 [DEBUG] About to start Express server on port', PORT);
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info('');
      logger.info('');
      logger.info('             SERVER SUCCESSFULLY STARTED                   ');
      logger.info('');
      logger.info(` Backend Server: http://0.0.0.0:${PORT}`);
      logger.info(` WebSocket Server: ws://0.0.0.0:${PORT}/socket.io`);
      logger.info(` Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(` CORS Origins: ${corsOrigins.join(', ') || 'All'}`);
      logger.info('');
      logger.info('Ready to process scans with real-time updates!');
      logger.info('');

      // Start background cleanup tasks AFTER server is listening
      startOAuthStateCleanup();
    });
  } catch (error) {
    logger.error('');
    logger.error('========================================');
    logger.error(' FATAL ERROR IN startServer()');
    logger.error('========================================');
    logger.error('Error details:', error);
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }
    logger.error('========================================');
    logger.error('');
    process.exit(1);
  }
};

console.log('[TRACE] After startServer() function definition');

console.log('[TRACE] ========================================');
console.log('[TRACE] MODULE LOADING COMPLETE - All code executed successfully');
console.log('[TRACE] About to call startServer()...');
console.log('[TRACE] ========================================');

logger.info('');
logger.info('================================================');
logger.info(' INDEX.TS MODULE LOADED SUCCESSFULLY');
logger.info(' About to call startServer()...');
logger.info('================================================');
logger.info('');

startServer().catch((error) => {
  logger.error('');
  logger.error('================================================');
  logger.error(' CRITICAL: startServer() PROMISE REJECTED');
  logger.error('================================================');
  logger.error('Error:', error);
  logger.error('================================================');
  logger.error('');
  process.exit(1);
});

export default app;









