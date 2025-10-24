/**
 * WEBSOCKET SERVER FOR REAL-TIME SCAN LOGS
 *
 * Streams debug-level logs to admin clients in real-time
 * Allows monitoring of URL scan flow for debugging and fine-tuning
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { scanLogger, ScanLogEntry } from '../services/logging/scanLogger.service.js';
import { logger } from '../config/logger.js';
import jwt from 'jsonwebtoken';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAdmin?: boolean;
  subscribedScans?: Set<string>;
}

export class ScanLogsWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/scan-logs'
    });

    logger.info('[WebSocket] Scan logs WebSocket server initialized at /ws/scan-logs');

    this.wss.on('connection', this.handleConnection.bind(this));

    // Listen to scan logger events
    scanLogger.on('log', this.broadcastLog.bind(this));
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(ws: AuthenticatedWebSocket, req: IncomingMessage) {
    const clientId = this.generateClientId();
    ws.subscribedScans = new Set();

    logger.info(`[WebSocket] New client connected: ${clientId}`);

    // Authenticate
    const token = this.extractToken(req);
    if (!token) {
      logger.warn(`[WebSocket] Client ${clientId} rejected - no token`);
      ws.close(1008, 'Authentication required');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      ws.userId = decoded.userId;
      ws.isAdmin = decoded.role === 'admin';

      if (!ws.isAdmin) {
        logger.warn(`[WebSocket] Client ${clientId} rejected - not admin`);
        ws.close(1008, 'Admin access required');
        return;
      }

      this.clients.set(clientId, ws);
      logger.info(`[WebSocket] Client ${clientId} authenticated as admin (user: ${ws.userId})`);

      // Send welcome message
      this.send(ws, {
        type: 'connected',
        message: 'Connected to scan logs stream',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`[WebSocket] Authentication failed for client ${clientId}:`, error);
      ws.close(1008, 'Invalid token');
      return;
    }

    // Handle messages from client
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, clientId, message);
      } catch (error) {
        logger.error(`[WebSocket] Invalid message from client ${clientId}:`, error);
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      logger.info(`[WebSocket] Client ${clientId} disconnected`);
      this.clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`[WebSocket] Error for client ${clientId}:`, error);
    });
  }

  /**
   * Handle message from client
   */
  private handleMessage(ws: AuthenticatedWebSocket, clientId: string, message: any) {
    switch (message.type) {
      case 'subscribe':
        // Subscribe to specific scan
        if (message.scanId) {
          ws.subscribedScans!.add(message.scanId);
          logger.debug(`[WebSocket] Client ${clientId} subscribed to scan ${message.scanId}`);

          // Send historical logs for this scan
          const historicalLogs = scanLogger.getScanLogs(message.scanId);
          if (historicalLogs.length > 0) {
            this.send(ws, {
              type: 'historical-logs',
              scanId: message.scanId,
              logs: historicalLogs
            });
          }
        }
        break;

      case 'unsubscribe':
        // Unsubscribe from scan
        if (message.scanId) {
          ws.subscribedScans!.delete(message.scanId);
          logger.debug(`[WebSocket] Client ${clientId} unsubscribed from scan ${message.scanId}`);
        }
        break;

      case 'ping':
        // Respond to ping
        this.send(ws, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      default:
        logger.warn(`[WebSocket] Unknown message type from client ${clientId}: ${message.type}`);
    }
  }

  /**
   * Broadcast log entry to subscribed clients
   */
  private broadcastLog(logEntry: ScanLogEntry) {
    let sentCount = 0;

    this.clients.forEach((ws, clientId) => {
      // Only send to clients subscribed to this scan
      if (ws.subscribedScans!.has(logEntry.scanId)) {
        this.send(ws, {
          type: 'log',
          log: logEntry
        });
        sentCount++;
      }
    });

    if (sentCount > 0) {
      logger.debug(`[WebSocket] Broadcast log for scan ${logEntry.scanId} to ${sentCount} clients`);
    }
  }

  /**
   * Send message to client
   */
  private send(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Extract JWT token from request
   */
  private extractToken(req: IncomingMessage): string | null {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connected clients count
   */
  public getConnectedClientsCount(): number {
    return this.clients.size;
  }
}
