// Redis bypass for production without Redis
export const redisClient = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 1,
  exists: async () => 0,
  expire: async () => 1,
  ttl: async () => -1,
  connect: async () => { console.log('[INFO] Redis disabled in production'); },
  disconnect: async () => {},
  quit: async () => {},
  on: () => {},
  isOpen: false,
  isReady: false
};

export const createRedisClient = () => redisClient;
