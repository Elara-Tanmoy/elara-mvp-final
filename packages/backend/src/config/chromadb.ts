import { logger } from './logger.js';

// Try to use real ChromaDB, fallback to mock if not available
let chromaClient: any;
let initChromaCollections: any;

try {
  if (process.env.CHROMADB_URL) {
    const { ChromaClient } = await import('chromadb');

    chromaClient = new ChromaClient({
      path: process.env.CHROMADB_URL
    });

    initChromaCollections = async () => {
      try {
        const collections = {
          datasets: await chromaClient.getOrCreateCollection({
            name: 'elara_datasets',
            metadata: { description: 'Vectorized threat intelligence datasets' }
          }),
          threats: await chromaClient.getOrCreateCollection({
            name: 'elara_threats',
            metadata: { description: 'Known threats and patterns' }
          }),
          urls: await chromaClient.getOrCreateCollection({
            name: 'elara_urls',
            metadata: { description: 'Analyzed URLs and their characteristics' }
          })
        };

        logger.info('ChromaDB collections initialized successfully');
        return collections;
      } catch (error) {
        logger.error('Failed to initialize ChromaDB collections:', error);
        throw error;
      }
    };

    // Test connection
    await chromaClient.heartbeat().catch(() => {
      throw new Error('ChromaDB heartbeat failed');
    });

    logger.info('ChromaDB connection verified');
  } else {
    throw new Error('ChromaDB not configured, using mock');
  }
} catch (error) {
  logger.warn('ChromaDB not available, using mock implementation');
  const mockChroma = await import('./chromadb.mock.js');
  chromaClient = mockChroma.chromaClient;
  initChromaCollections = mockChroma.initChromaCollections;
}

export { chromaClient, initChromaCollections };
export default chromaClient;
