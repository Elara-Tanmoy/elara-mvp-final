/**
 * ELARA DEEPFAKE & AI-GENERATED CONTENT DETECTOR
 *
 * Multi-modal detection system for AI-generated scam content
 *
 * Detects:
 * 1. AI-generated images (product photos, profile pics, deepfakes)
 * 2. GPT-generated text (reviews, descriptions, phishing emails)
 * 3. Synthetic voices in videos (future enhancement)
 *
 * FREE ENTERPRISE-GRADE SOLUTIONS:
 * - Hugging Face Inference API (free tier) for GPT text detection
 * - TinEye Reverse Image Search (free API) for stock image detection
 * - Statistical analysis for AI generation patterns
 * - Content fingerprinting for duplicate detection
 */

import axios from 'axios';
import { logger } from '../../config/logger.js';
import crypto from 'crypto';

export interface ImageAnalysis {
  isAIGenerated: boolean;
  confidence: number; // 0-1
  indicators: string[];
  reverseSearchResults: number; // Number of matches found online
  duplicateDetected: boolean;
}

export interface TextAnalysis {
  isAIGenerated: boolean;
  confidence: number; // 0-1
  gptProbability: number; // 0-1 (probability text was written by GPT)
  indicators: string[];
  patterns: {
    repetitiveStructure: boolean;
    genericLanguage: boolean;
    lackOfSpecifics: boolean;
    unnaturalFlow: boolean;
  };
}

export interface DeepfakeAnalysis {
  imageAnalysis?: ImageAnalysis;
  textAnalysis?: TextAnalysis;
  overallRisk: number; // 0-50 points
  verdict: 'genuine' | 'likely_ai' | 'definitely_ai';
  recommendations: string[];
}

export class DeepfakeDetector {
  private readonly HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
  private readonly TINEYE_API_KEY = process.env.TINEYE_API_KEY;

  /**
   * Analyze image for AI generation and authenticity
   */
  async analyzeImage(imageUrl: string): Promise<ImageAnalysis> {
    try {
      logger.info(`🖼️ Analyzing image for AI generation: ${imageUrl}`);

      const indicators: string[] = [];
      let confidence = 0.5; // Default neutral
      let isAIGenerated = false;
      let reverseSearchResults = 0;
      let duplicateDetected = false;

      // 1. Reverse image search to check if it's a stock image
      try {
        reverseSearchResults = await this.reverseImageSearch(imageUrl);

        if (reverseSearchResults === 0) {
          // Unique image, possible AI-generated
          indicators.push('Image not found in reverse search (possibly AI-generated or new)');
          confidence += 0.15;
        } else if (reverseSearchResults > 100) {
          // Widely used stock image
          indicators.push(`Image appears on ${reverseSearchResults}+ websites (stock image)`);
          duplicateDetected = true;
          confidence += 0.2;
        } else if (reverseSearchResults > 10) {
          indicators.push(`Image found on ${reverseSearchResults} websites`);
          duplicateDetected = true;
        }
      } catch (error) {
        logger.warn('Reverse image search failed:', error);
      }

      // 2. Download and analyze image metadata
      try {
        const imageData = await this.downloadImage(imageUrl);
        const metadata = await this.analyzeImageMetadata(imageData);

        // Check for AI generation indicators in metadata
        if (metadata.noExifData) {
          indicators.push('No EXIF metadata (common in AI-generated images)');
          confidence += 0.1;
        }

        if (metadata.suspiciousPatterns) {
          indicators.push('Suspicious pixel patterns detected');
          confidence += 0.15;
        }

        // Check file characteristics
        if (metadata.unusualAspectRatio) {
          indicators.push('Unusual aspect ratio (typical of AI generators)');
          confidence += 0.05;
        }
      } catch (error) {
        logger.warn('Image metadata analysis failed:', error);
      }

      // 3. Statistical analysis of image characteristics
      // (This would involve analyzing pixel distributions, but we'll use heuristics for MVP)

      // 4. Check for common AI image generation signatures
      const aiSignatures = this.checkAIGenerationSignatures(imageUrl);
      if (aiSignatures.length > 0) {
        indicators.push(...aiSignatures);
        confidence += 0.2;
      }

      // Final determination
      isAIGenerated = confidence > 0.7;

      return {
        isAIGenerated,
        confidence: Math.min(confidence, 1.0),
        indicators: indicators.length > 0 ? indicators : ['No clear AI generation indicators'],
        reverseSearchResults,
        duplicateDetected,
      };
    } catch (error) {
      logger.error('Image analysis failed:', error);
      return {
        isAIGenerated: false,
        confidence: 0.5,
        indicators: ['Analysis failed - unable to determine'],
        reverseSearchResults: 0,
        duplicateDetected: false,
      };
    }
  }

  /**
   * Analyze text for GPT generation
   */
  async analyzeText(text: string): Promise<TextAnalysis> {
    try {
      logger.info(`📝 Analyzing text for AI generation (${text.length} characters)`);

      const indicators: string[] = [];
      let gptProbability = 0.0;
      let isAIGenerated = false;

      // 1. Use Hugging Face GPT detector (if API key available)
      if (this.HUGGINGFACE_API_KEY) {
        try {
          gptProbability = await this.huggingfaceGPTDetection(text);

          if (gptProbability > 0.8) {
            indicators.push(`Very high GPT probability (${(gptProbability * 100).toFixed(1)}%)`);
          } else if (gptProbability > 0.6) {
            indicators.push(`High GPT probability (${(gptProbability * 100).toFixed(1)}%)`);
          } else if (gptProbability > 0.4) {
            indicators.push(`Moderate GPT probability (${(gptProbability * 100).toFixed(1)}%)`);
          }
        } catch (error) {
          logger.warn('Hugging Face GPT detection failed:', error);
        }
      }

      // 2. Statistical pattern analysis (free, no API needed)
      const patterns = this.analyzeTextPatterns(text);

      if (patterns.repetitiveStructure) {
        indicators.push('Repetitive sentence structures (typical of AI)');
        gptProbability += 0.15;
      }

      if (patterns.genericLanguage) {
        indicators.push('Generic/template language detected');
        gptProbability += 0.1;
      }

      if (patterns.lackOfSpecifics) {
        indicators.push('Lacks specific details (common in AI-generated content)');
        gptProbability += 0.1;
      }

      if (patterns.unnaturalFlow) {
        indicators.push('Unnatural text flow patterns');
        gptProbability += 0.05;
      }

      // 3. Check for common GPT phrases
      const gptPhrases = this.detectGPTPhrases(text);
      if (gptPhrases.length > 0) {
        indicators.push(`Contains ${gptPhrases.length} common GPT phrases`);
        gptProbability += Math.min(gptPhrases.length * 0.05, 0.2);
      }

      // Final determination
      gptProbability = Math.min(gptProbability, 1.0);
      isAIGenerated = gptProbability > 0.7;

      return {
        isAIGenerated,
        confidence: gptProbability,
        gptProbability,
        indicators: indicators.length > 0 ? indicators : ['No clear AI generation indicators'],
        patterns,
      };
    } catch (error) {
      logger.error('Text analysis failed:', error);
      return {
        isAIGenerated: false,
        confidence: 0.5,
        gptProbability: 0.5,
        indicators: ['Analysis failed - unable to determine'],
        patterns: {
          repetitiveStructure: false,
          genericLanguage: false,
          lackOfSpecifics: false,
          unnaturalFlow: false,
        },
      };
    }
  }

  /**
   * Perform comprehensive deepfake analysis
   */
  async analyzeContent(options: {
    imageUrls?: string[];
    textContent?: string;
  }): Promise<DeepfakeAnalysis> {
    try {
      let imageAnalysis: ImageAnalysis | undefined;
      let textAnalysis: TextAnalysis | undefined;
      let overallRisk = 0;

      // Analyze images
      if (options.imageUrls && options.imageUrls.length > 0) {
        // Analyze first image (can be extended to analyze multiple)
        imageAnalysis = await this.analyzeImage(options.imageUrls[0]);

        if (imageAnalysis.isAIGenerated) {
          overallRisk += 30; // High risk for AI-generated images
        } else if (imageAnalysis.confidence > 0.6) {
          overallRisk += 15; // Medium risk
        }
      }

      // Analyze text
      if (options.textContent) {
        textAnalysis = await this.analyzeText(options.textContent);

        if (textAnalysis.isAIGenerated) {
          overallRisk += 25; // High risk for AI-generated text
        } else if (textAnalysis.gptProbability > 0.6) {
          overallRisk += 15; // Medium risk
        }
      }

      // Determine verdict
      let verdict: DeepfakeAnalysis['verdict'] = 'genuine';
      if (overallRisk >= 40) {
        verdict = 'definitely_ai';
      } else if (overallRisk >= 20) {
        verdict = 'likely_ai';
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(verdict, imageAnalysis, textAnalysis);

      return {
        imageAnalysis,
        textAnalysis,
        overallRisk: Math.min(overallRisk, 50),
        verdict,
        recommendations,
      };
    } catch (error) {
      logger.error('Deepfake analysis failed:', error);
      throw error;
    }
  }

  /**
   * Reverse image search using TinEye or similar service
   */
  private async reverseImageSearch(imageUrl: string): Promise<number> {
    try {
      // Using TinEye API (free tier available)
      if (this.TINEYE_API_KEY) {
        const response = await axios.post(
          'https://api.tineye.com/rest/search/',
          {
            image_url: imageUrl,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.TINEYE_API_KEY}`,
            },
            timeout: 10000,
          }
        );

        return response.data.results?.matches?.length || 0;
      } else {
        // Fallback: Use public Google Image Search (limited)
        logger.warn('TinEye API key not configured, skipping reverse image search');
        return 0;
      }
    } catch (error) {
      logger.warn('Reverse image search error:', error);
      return 0;
    }
  }

  /**
   * Download image for analysis
   */
  private async downloadImage(imageUrl: string): Promise<Buffer> {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxContentLength: 10 * 1024 * 1024, // 10MB max
    });

    return Buffer.from(response.data);
  }

  /**
   * Analyze image metadata and characteristics
   */
  private async analyzeImageMetadata(imageData: Buffer): Promise<{
    noExifData: boolean;
    suspiciousPatterns: boolean;
    unusualAspectRatio: boolean;
  }> {
    // Simple heuristic-based analysis (can be enhanced with image processing libraries)
    // For MVP, we'll do basic checks

    return {
      noExifData: false, // Would check EXIF data if image library available
      suspiciousPatterns: false, // Would analyze pixel patterns
      unusualAspectRatio: false, // Would check dimensions
    };
  }

  /**
   * Check for AI generation signature patterns in image URL
   */
  private checkAIGenerationSignatures(imageUrl: string): string[] {
    const signatures: string[] = [];
    const urlLower = imageUrl.toLowerCase();

    // Common AI image generation service patterns
    const aiServices = [
      'midjourney',
      'dall-e',
      'stable-diffusion',
      'craiyon',
      'leonardo.ai',
      'artbreeder',
      'nightcafe',
      'deepai',
    ];

    for (const service of aiServices) {
      if (urlLower.includes(service)) {
        signatures.push(`Image URL contains AI service name: ${service}`);
      }
    }

    return signatures;
  }

  /**
   * Use Hugging Face API for GPT detection
   */
  private async huggingfaceGPTDetection(text: string): Promise<number> {
    try {
      if (!this.HUGGINGFACE_API_KEY) {
        return 0.5; // Neutral if no API key
      }

      const response = await axios.post(
        'https://api-inference.huggingface.co/models/roberta-base-openai-detector',
        { inputs: text.substring(0, 500) }, // First 500 chars
        {
          headers: {
            'Authorization': `Bearer ${this.HUGGINGFACE_API_KEY}`,
          },
          timeout: 15000,
        }
      );

      // Parse response (format varies by model)
      const results = response.data;
      if (Array.isArray(results) && results.length > 0) {
        const fakeScore = results[0].find((r: any) => r.label === 'FAKE' || r.label === 'Real')?.score || 0.5;
        return fakeScore;
      }

      return 0.5;
    } catch (error) {
      logger.warn('Hugging Face API error:', error);
      return 0.5; // Neutral on error
    }
  }

  /**
   * Analyze text patterns statistically (free, no API)
   */
  private analyzeTextPatterns(text: string): TextAnalysis['patterns'] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

    // Check for repetitive structure
    const sentenceStarts = sentences.map(s => s.trim().substring(0, 20).toLowerCase());
    const uniqueStarts = new Set(sentenceStarts);
    const repetitiveStructure = uniqueStarts.size < sentences.length * 0.7;

    // Check for generic language
    const genericPhrases = [
      'in conclusion',
      'it is important to note',
      'furthermore',
      'additionally',
      'moreover',
      'therefore',
      'as a result',
      'in summary',
    ];
    const genericCount = genericPhrases.filter(phrase =>
      text.toLowerCase().includes(phrase)
    ).length;
    const genericLanguage = genericCount >= 3;

    // Check for lack of specifics (too many general words)
    const generalWords = ['thing', 'something', 'anything', 'everything', 'various', 'several', 'many'];
    const generalWordCount = generalWords.filter(word =>
      new RegExp(`\\b${word}\\b`, 'i').test(text)
    ).length;
    const lackOfSpecifics = generalWordCount > sentences.length * 0.3;

    // Check for unnatural flow (sentences all similar length)
    const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
    const unnaturalFlow = variance < 20; // Low variance = similar lengths

    return {
      repetitiveStructure,
      genericLanguage,
      lackOfSpecifics,
      unnaturalFlow,
    };
  }

  /**
   * Detect common GPT phrases
   */
  private detectGPTPhrases(text: string): string[] {
    const textLower = text.toLowerCase();
    const commonGPTPhrases = [
      'as an ai language model',
      'i don\'t have personal experiences',
      'i cannot provide',
      'it\'s important to note',
      'regenerate response',
      'as of my last update',
      'i apologize, but',
      'delve into',
      'dive deep into',
      'it\'s worth noting',
      'in the ever-evolving',
      'navigate the landscape',
    ];

    return commonGPTPhrases.filter(phrase => textLower.includes(phrase));
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    verdict: DeepfakeAnalysis['verdict'],
    imageAnalysis?: ImageAnalysis,
    textAnalysis?: TextAnalysis
  ): string[] {
    const recommendations: string[] = [];

    if (verdict === 'definitely_ai') {
      recommendations.push('⚠️ CRITICAL: Content is very likely AI-generated');
      recommendations.push('Do NOT trust product claims or testimonials');
      recommendations.push('This is likely a scam using AI-generated content');
      recommendations.push('Report this website immediately');
    } else if (verdict === 'likely_ai') {
      recommendations.push('⚠️ WARNING: Content shows signs of AI generation');
      recommendations.push('Verify claims through independent sources');
      recommendations.push('Exercise extreme caution before purchasing');
      recommendations.push('Look for verified customer reviews elsewhere');
    } else {
      recommendations.push('✅ Content appears genuine');
      recommendations.push('Always verify important claims independently');
    }

    // Specific recommendations based on analysis
    if (imageAnalysis?.duplicateDetected) {
      recommendations.push('⚠️ Product images are stock photos (not actual products)');
    }

    if (textAnalysis?.isAIGenerated) {
      recommendations.push('⚠️ Reviews/descriptions appear to be AI-generated');
    }

    return recommendations;
  }

  /**
   * Generate content fingerprint for duplicate detection
   */
  generateFingerprint(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

// Export singleton instance
export const deepfakeDetector = new DeepfakeDetector();
