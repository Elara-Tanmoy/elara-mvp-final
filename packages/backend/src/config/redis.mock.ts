// Mock Redis for development without Docker
import { logger } from './logger.js';

class MockRedis {
  private store: Map<string, any> = new Map();
  private ttls: Map<string, number> = new Map();

  async incr(key: string): Promise<number> {
    const current = this.store.get(key) || 0;
    const newVal = current + 1;
    this.store.set(key, newVal);
    return newVal;
  }

  async decr(key: string): Promise<number> {
    const current = this.store.get(key) || 0;
    const newVal = Math.max(0, current - 1);
    this.store.set(key, newVal);
    return newVal;
  }

  async expire(key: string, seconds: number): Promise<number> {
    this.ttls.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const expiry = this.ttls.get(key);
    if (!expiry) return -1;
    const remaining = Math.floor((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }

  async quit(): Promise<string> {
    logger.info('Mock Redis: quit called');
    return 'OK';
  }

  on(event: string, callback: Function) {
    if (event === 'connect') {
      setTimeout(() => callback(), 100);
    }
    return this;
  }
}

export const redis = new MockRedis() as any;
export const redisCache = new MockRedis() as any;
export default redis;

logger.info('Using Mock Redis (Docker not available)');
