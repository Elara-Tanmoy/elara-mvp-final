const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api';

export interface HealthStatus {
  status: string;
  timestamp: string;
  database: 'connected' | 'disconnected';
  services: {
    redis: string;
    chromadb: string;
  };
}

export const api = {
  async getHealth(): Promise<HealthStatus> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error('Failed to fetch health status');
    }
    return response.json();
  }
};
