// Check if we should skip Redis entirely
export const SKIP_REDIS = !process.env.REDIS_URL || process.env.SKIP_REDIS === 'true';

if (SKIP_REDIS) {
  console.log('[CONFIG] Redis disabled - production mode without Redis');
}
