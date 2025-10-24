import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
};

const prismaStagingClientSingleton = () => {
  if (!process.env.STAGING_DATABASE_URL) {
    return null;
  }
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.STAGING_DATABASE_URL
      }
    },
    log: [
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
  var prismaStagingGlobal: undefined | ReturnType<typeof prismaStagingClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();
export const prismaStaging = globalThis.prismaStagingGlobal ?? prismaStagingClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
  globalThis.prismaStagingGlobal = prismaStaging;
}

// Log database queries - ENABLED FOR DEBUGGING GCP MIGRATION
// Previously only enabled in development, now always enabled
prisma.$on('query' as never, (e: any) => {
  logger.debug(`[Prisma] Query: ${e.query}`);
  logger.debug(`[Prisma] Params: ${JSON.stringify(e.params)}`);
  logger.debug(`[Prisma] Duration: ${e.duration}ms`);
});

prisma.$on('error' as never, (e: any) => {
  logger.error('Database error:', e);
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn('Database warning:', e);
});

// Staging client error handling
if (prismaStaging) {
  prismaStaging.$on('error' as never, (e: any) => {
    logger.error('[Staging DB] Database error:', e);
  });

  prismaStaging.$on('warn' as never, (e: any) => {
    logger.warn('[Staging DB] Database warning:', e);
  });
}

export default prisma;
