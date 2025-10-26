/**
 * Stage-2 Models for URL Scanner V2
 *
 * Implements heavy models for deep analysis when Stage-1 is uncertain:
 * - textPersuasion: Gemma/Mixtral model for social engineering detection
 * - screenshotCnn: EfficientNet/ViT for fake login page detection
 *
 * Only invoked when Stage-1 confidence < threshold
 * Target latency: <1s (uses GPU endpoints)
 */

import axios from 'axios';
import type {
  ExtractedFeatures,
  Stage2Predictions,
  VertexAIEndpoints
} from './types';

/**
 * Stage-2 Model Runner
 */
export class Stage2ModelRunner {
  private endpoints: VertexAIEndpoints;
  private timeout: number;

  constructor(
    endpoints: VertexAIEndpoints,
    timeoutMs: number = 10000 // Higher timeout for GPU models
  ) {
    this.endpoints = endpoints;
    this.timeout = timeoutMs;
  }

  /**
   * Run Stage-2 models
   */
  async predict(
    features: ExtractedFeatures,
    options: {
      skipScreenshot?: boolean;
    } = {}
  ): Promise<Stage2Predictions> {
    const startTime = Date.now();

    try {
      // Run models in parallel if both are needed
      const promises: Promise<any>[] = [];

      // Text persuasion model (always run if Stage-2 is invoked)
      promises.push(this.predictTextPersuasion(features.text));

      // Screenshot CNN (only if screenshot available and not skipped)
      if (features.screenshot && !options.skipScreenshot) {
        promises.push(this.predictScreenshotCNN(features.screenshot.imageUrl));
      } else {
        promises.push(Promise.resolve(null));
      }

      const [textResult, screenshotResult] = await Promise.all(promises);

      // Combine predictions
      let combinedProb = textResult.probability;
      let combinedConf = textResult.confidence;

      if (screenshotResult) {
        // Weight: 60% text, 40% screenshot
        combinedProb = textResult.probability * 0.6 + screenshotResult.probability * 0.4;
        combinedConf = Math.min(textResult.confidence, screenshotResult.confidence);
      }

      const latency = Date.now() - startTime;

      return {
        textPersuasion: textResult,
        screenshotCnn: screenshotResult || this.getEmptyScreenshotPrediction(),
        combined: {
          probability: combinedProb,
          confidence: combinedConf
        },
        latency
      };

    } catch (error) {
      console.error('Stage-2 prediction error:', error);
      return this.getDefaultPrediction();
    }
  }

  /**
   * Text Persuasion Model (Gemma/Mixtral)
   */
  private async predictTextPersuasion(text: ExtractedFeatures['text']): Promise<{
    probability: number;
    confidence: number;
    persuasionTactics: string[];
  }> {
    try {
      // Check if endpoint is configured
      if (!this.endpoints.textPersuasion || this.endpoints.textPersuasion.trim() === '') {
        console.log('[Stage2] Text Persuasion: Vertex AI not configured, using fallback heuristic');
        return this.localTextFallback(text);
      }

      // Prepare input text
      const inputText = this.prepareTextInput(text);

      // Call Vertex AI endpoint
      const response = await axios.post(
        this.endpoints.textPersuasion,
        {
          instances: [{
            text: inputText,
            max_length: 512
          }]
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const prediction = response.data.predictions[0];
      const probability = prediction.probability || prediction.score || prediction[0];
      const confidence = prediction.confidence || Math.abs(probability - 0.5) * 2;
      const persuasionTactics = prediction.tactics || this.extractTactics(text);

      return { probability, confidence, persuasionTactics };

    } catch (error) {
      console.error('Text Persuasion error:', error);
      return this.localTextFallback(text);
    }
  }

  /**
   * Screenshot CNN Model (EfficientNet/ViT)
   */
  private async predictScreenshotCNN(imageUrl: string): Promise<{
    probability: number;
    confidence: number;
    detectedBrands: string[];
    isFakeLogin: boolean;
  }> {
    try {
      // Check if endpoint is configured
      if (!this.endpoints.screenshotCnn || this.endpoints.screenshotCnn.trim() === '') {
        console.log('[Stage2] Screenshot CNN: Vertex AI not configured, using fallback');
        return this.localScreenshotFallback();
      }

      // Call Vertex AI endpoint
      const response = await axios.post(
        this.endpoints.screenshotCnn,
        {
          instances: [{
            image_url: imageUrl,
            return_features: true
          }]
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const prediction = response.data.predictions[0];
      const probability = prediction.probability || prediction.score || prediction[0];
      const confidence = prediction.confidence || Math.abs(probability - 0.5) * 2;
      const detectedBrands = prediction.brands || [];
      const isFakeLogin = prediction.is_fake_login || probability > 0.7;

      return { probability, confidence, detectedBrands, isFakeLogin };

    } catch (error) {
      console.error('Screenshot CNN error:', error);
      return this.localScreenshotFallback();
    }
  }

  /**
   * Prepare text input for model
   */
  private prepareTextInput(text: ExtractedFeatures['text']): string {
    const parts: string[] = [];

    // Add aggregated text
    if (text.aggregatedText) {
      parts.push(text.aggregatedText);
    }

    // Add alt text
    if (text.altText.length > 0) {
      parts.push('ALT TEXT: ' + text.altText.join(' | '));
    }

    // Add script hints
    if (text.scriptHints.length > 0) {
      parts.push('SUSPICIOUS SCRIPTS: ' + text.scriptHints.join(', '));
    }

    return parts.join('\n\n').slice(0, 5000); // Limit to 5k chars
  }

  /**
   * Extract persuasion tactics from text
   */
  private extractTactics(text: ExtractedFeatures['text']): string[] {
    const tactics: string[] = [];
    const fullText = text.aggregatedText.toLowerCase();

    // Urgency
    if (/(urgent|act now|limited time|expire|hurry|immediate)/i.test(fullText)) {
      tactics.push('urgency');
    }

    // Authority
    if (/(verify|confirm|account|suspended|locked|security)/i.test(fullText)) {
      tactics.push('authority');
    }

    // Fear
    if (/(warning|alert|danger|risk|threat|compromised)/i.test(fullText)) {
      tactics.push('fear');
    }

    // Reward
    if (/(win|prize|reward|bonus|free|gift|claim)/i.test(fullText)) {
      tactics.push('reward');
    }

    // Trust exploitation
    if (/(official|legitimate|secure|trusted|certified)/i.test(fullText)) {
      tactics.push('trust_exploitation');
    }

    return tactics;
  }

  /**
   * Local text analysis fallback
   */
  private localTextFallback(text: ExtractedFeatures['text']): {
    probability: number;
    confidence: number;
    persuasionTactics: string[];
  } {
    const fullText = text.aggregatedText.toLowerCase();
    const persuasionTactics = this.extractTactics(text);

    // Score based on tactics count
    let score = persuasionTactics.length * 15;

    // Check for credential harvesting keywords
    const credentialKeywords = [
      'password', 'login', 'username', 'email', 'phone',
      'credit card', 'ssn', 'account number', 'pin'
    ];

    const credentialMatches = credentialKeywords.filter(kw =>
      fullText.includes(kw)
    ).length;

    score += credentialMatches * 10;

    // Check for excessive capitalization (SHOUTING)
    const capsRatio = (fullText.match(/[A-Z]/g) || []).length / fullText.length;
    if (capsRatio > 0.3) {
      score += 15;
    }

    // Normalize to [0, 1]
    const probability = Math.min(1, score / 100);
    const confidence = 0.4; // Low-medium confidence for fallback

    return { probability, confidence, persuasionTactics };
  }

  /**
   * Local screenshot analysis fallback
   */
  private localScreenshotFallback(): {
    probability: number;
    confidence: number;
    detectedBrands: string[];
    isFakeLogin: boolean;
  } {
    // Cannot analyze screenshot without model
    return {
      probability: 0.5,
      confidence: 0.0,
      detectedBrands: [],
      isFakeLogin: false
    };
  }

  /**
   * Get empty screenshot prediction
   */
  private getEmptyScreenshotPrediction(): {
    probability: number;
    confidence: number;
    detectedBrands: string[];
    isFakeLogin: boolean;
  } {
    return {
      probability: 0.5,
      confidence: 0.0,
      detectedBrands: [],
      isFakeLogin: false
    };
  }

  /**
   * Get default prediction on error
   */
  private getDefaultPrediction(): Stage2Predictions {
    return {
      textPersuasion: {
        probability: 0.5,
        confidence: 0.0,
        persuasionTactics: []
      },
      screenshotCnn: this.getEmptyScreenshotPrediction(),
      combined: {
        probability: 0.5,
        confidence: 0.0
      },
      latency: 0
    };
  }
}

/**
 * Factory function
 */
export function createStage2Runner(
  endpoints: VertexAIEndpoints,
  timeoutMs?: number
): Stage2ModelRunner {
  return new Stage2ModelRunner(endpoints, timeoutMs);
}

/**
 * Utility: Estimate if Stage-2 should be skipped based on features
 */
export function shouldSkipStage2(
  stage1Confidence: number,
  threshold: number,
  features: ExtractedFeatures
): boolean {
  // Skip if Stage-1 confidence is high
  if (stage1Confidence >= threshold) {
    return true;
  }

  // Skip if no text content available
  if (!features.text.aggregatedText || features.text.aggregatedText.length < 50) {
    return true;
  }

  // Don't skip - need Stage-2 analysis
  return false;
}
