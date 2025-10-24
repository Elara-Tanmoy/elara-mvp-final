// Mock ChromaDB for development without Docker
import { logger } from './logger.js';

class MockCollection {
  private documents: Map<string, any> = new Map();

  async add(data: { ids: string[]; documents: string[]; metadatas: any[] }) {
    for (let i = 0; i < data.ids.length; i++) {
      this.documents.set(data.ids[i], {
        document: data.documents[i],
        metadata: data.metadatas[i]
      });
    }
    logger.debug(`Mock ChromaDB: Added ${data.ids.length} documents`);
  }

  async query(params: { queryTexts: string[]; nResults: number }) {
    const docs = Array.from(this.documents.values());
    const results = docs.slice(0, params.nResults);

    return {
      documents: [results.map(r => r.document)],
      distances: [results.map(() => Math.random())],
      metadatas: [results.map(r => r.metadata)]
    };
  }
}

class MockChromaClient {
  private collections: Map<string, MockCollection> = new Map();

  async getOrCreateCollection(params: { name: string; metadata?: any }) {
    if (!this.collections.has(params.name)) {
      this.collections.set(params.name, new MockCollection());
      logger.info(`Mock ChromaDB: Created collection ${params.name}`);
    }
    return this.collections.get(params.name)!;
  }
}

export const chromaClient = new MockChromaClient();

export const initChromaCollections = async () => {
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

  logger.info('Mock ChromaDB collections initialized');
  return collections;
};

export default chromaClient;

logger.info('Using Mock ChromaDB (Docker not available)');
