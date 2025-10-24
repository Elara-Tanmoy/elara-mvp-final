import Redis from 'ioredis';

// Create Redis client if REDIS_URL is available
let redisClient: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      // BullMQ requirement: null allows infinite retries for blocking operations (BLPOP, BRPOP)
      maxRetriesPerRequest: null,

      // Connection pool settings
      enableReadyCheck: true,
      enableOfflineQueue: true,
      lazyConnect: false, // Connect immediately

      // Reconnection strategy with exponential backoff
      retryStrategy(times) {
        if (times > 10) {
          // Stop retrying after 10 attempts
          console.error('[Redis] Max retry attempts reached, stopping reconnection');
          return null;
        }
        const delay = Math.min(times * 100, 3000);
        console.log(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`);
        return delay;
      },

      // Connection timeout and keepalive settings
      connectTimeout: 10000, // 10 seconds to establish connection
      keepAlive: 30000, // Send keepalive every 30 seconds

      // Socket options to prevent connection drops
      family: 4, // Use IPv4

      // Reconnect on error
      reconnectOnError(err) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
        if (targetErrors.some(targetError => err.message.includes(targetError))) {
          console.log(`[Redis] Reconnecting due to: ${err.message}`);
          return true; // Reconnect
        }
        return false;
      },

      // Retry on specific errors
      autoResubscribe: true,
      autoResendUnfulfilledCommands: true,
    });

    // Track connection state
    let isConnected = false;
    let reconnectCount = 0;

    redisClient.on('connect', () => {
      console.log('[Redis] Connecting to Redis server...');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      reconnectCount = 0;
      console.log('[Redis] ✓ Redis client ready and accepting commands');
    });

    redisClient.on('error', (err) => {
      // Only log errors if we're connected (avoid spam during reconnection)
      if (isConnected || reconnectCount === 0) {
        console.error('[Redis] Error:', err.message);
      }
    });

    redisClient.on('close', () => {
      isConnected = false;
      console.log('[Redis] Connection closed');
    });

    redisClient.on('reconnecting', (delay) => {
      reconnectCount++;
      if (reconnectCount <= 3) {
        console.log(`[Redis] Reconnecting... (attempt ${reconnectCount}, delay: ${delay}ms)`);
      }
    });

    redisClient.on('end', () => {
      isConnected = false;
      console.log('[Redis] Connection ended');
    });

    console.log('[Redis] Initializing connection to:', process.env.REDIS_URL.replace(/\/\/.*@/, '//*****@'));
  } catch (error) {
    console.error('[Redis] Failed to create Redis client:', error);
    redisClient = null;
  }
}

if (!redisClient) {
  console.log('[Redis] Redis not configured - using in-memory cache');
}

// Export for BullMQ and other services
export const redis = redisClient;
export { redisClient };
