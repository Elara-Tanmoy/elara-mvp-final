/**
 * Socket.io Server Configuration
 * Provides real-time WebSocket communication for scan progress events
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from './logger.js';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.io server with Express HTTP server
 */
export const initializeSocketServer = (httpServer: HttpServer): SocketIOServer => {
  logger.info('Initializing Socket.io server...');

  // CORS origins for Socket.io (same as Express)
  const allowedOrigins = [
    'http://0.0.0.0:5173',
    'http://localhost:5173',
    'https://elara-platform.vercel.app',
    'https://elara-frontend.vercel.app',
    'https://elara-7c108p1d1-tanmoys-projects-1b158c68.vercel.app',
    'https://elara-mvp.vercel.app',
    process.env.CORS_ORIGIN
  ].filter(Boolean);

  const corsOrigins = process.env.CORS_ORIGIN
    ? [...new Set([...allowedOrigins, ...process.env.CORS_ORIGIN.split(',').filter(Boolean)])]
    : allowedOrigins;

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigins.length > 0 ? corsOrigins : '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Connection event handler
  io.on('connection', (socket) => {
    logger.info(`Socket.io client connected: ${socket.id}`);

    // Allow clients to join scan-specific rooms
    socket.on('join-scan-room', (scanId: string) => {
      socket.join(`scan-${scanId}`);
      logger.info(`Client ${socket.id} joined room: scan-${scanId}`);
    });

    // Allow clients to leave scan-specific rooms
    socket.on('leave-scan-room', (scanId: string) => {
      socket.leave(`scan-${scanId}`);
      logger.info(`Client ${socket.id} left room: scan-${scanId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket.io client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
      logger.error(`Socket.io error for client ${socket.id}:`, error);
    });
  });

  logger.info('Socket.io server initialized successfully');
  return io;
};

/**
 * Get the initialized Socket.io server instance
 */
export const getSocketServer = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.io server not initialized. Call initializeSocketServer first.');
  }
  return io;
};

/**
 * Emit event to specific scan room
 */
export const emitToScanRoom = (scanId: string, event: string, data: any): void => {
  if (io) {
    io.to(`scan-${scanId}`).emit(event, data);
  }
};

/**
 * Close Socket.io server
 */
export const closeSocketServer = async (): Promise<void> => {
  if (io) {
    logger.info('Closing Socket.io server...');
    await new Promise<void>((resolve) => {
      io?.close(() => {
        logger.info('Socket.io server closed');
        resolve();
      });
    });
    io = null;
  }
};
