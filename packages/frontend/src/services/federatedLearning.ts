/**
 * CLIENT-SIDE FEDERATED LEARNING - STUB
 * Privacy-preserving machine learning - data never leaves the browser
 *
 * NOTE: Temporarily disabled - requires @tensorflow/tfjs package installation
 * To enable: npm install @tensorflow/tfjs and restore the full implementation
 */

// Stub export to satisfy imports
export const getFederatedLearningClient = (_apiBaseUrl?: string): any => {
  throw new Error('Federated Learning is temporarily disabled. Install @tensorflow/tfjs to enable this feature.');
};

// Placeholder types for compatibility
export interface FederatedLearningClient {
  downloadGlobalModel(): Promise<void>;
  trainLocal(trainingData: any[]): Promise<{ loss: number; accuracy: number }>;
  submitGradients(metrics: any, sampleCount: number): Promise<boolean>;
  participateInFederatedLearning(localData: any[]): Promise<void>;
  predict(url: string): Promise<{ safe: number; scam: number }>;
  dispose(): void;
}
