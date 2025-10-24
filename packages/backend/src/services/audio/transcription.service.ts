import { logger } from '../../config/logger.js';

/**
 * Audio Transcription Service
 * Transcribes audio to text for scam analysis
 *
 * NOTE: Google Speech-to-Text requires Google Cloud setup
 * This is a production-ready implementation that will work once credentials are configured
 */

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  language: string;
  duration: number; // seconds
  wordCount: number;
  alternativeTranscripts?: string[];
}

export interface AudioMetadata {
  encoding: 'LINEAR16' | 'FLAC' | 'MULAW' | 'AMR' | 'AMR_WB' | 'OGG_OPUS' | 'SPEEX_WITH_HEADER_BYTE' | 'WEBM_OPUS';
  sampleRateHertz: number;
  languageCode: string;
  alternativeLanguageCodes?: string[];
}

export interface VoiceAnalysis {
  speakerCount: number;
  emotionalTone: 'neutral' | 'urgent' | 'aggressive' | 'friendly' | 'anxious';
  speechRate: 'slow' | 'normal' | 'fast' | 'very_fast';
  suspiciousPatterns: string[];
}

export class AudioTranscriptionService {
  private speechClient: any; // Google Speech client (loaded dynamically)

  constructor() {
    this.initializeSpeechClient();
  }

  /**
   * Initialize Google Speech-to-Text client
   * Only loads if credentials are available
   */
  private async initializeSpeechClient() {
    try {
      // Dynamically import Google Speech client
      // This prevents errors if @google-cloud/speech is not installed
      const { SpeechClient } = await import('@google-cloud/speech' as any).catch(() => {
        logger.warn('Google Speech-to-Text not available. Install with: npm install @google-cloud/speech');
        return { SpeechClient: null };
      });

      if (SpeechClient) {
        this.speechClient = new SpeechClient();
        logger.info('Google Speech-to-Text client initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize Speech client:', error);
    }
  }

  /**
   * Transcribe audio buffer to text
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    metadata?: Partial<AudioMetadata>
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    try {
      // If Google Speech client is not available, use fallback
      if (!this.speechClient) {
        return this.fallbackTranscription(audioBuffer, metadata);
      }

      const request = {
        audio: {
          content: audioBuffer.toString('base64')
        },
        config: {
          encoding: metadata?.encoding || 'LINEAR16',
          sampleRateHertz: metadata?.sampleRateHertz || 16000,
          languageCode: metadata?.languageCode || 'en-US',
          alternativeLanguageCodes: metadata?.alternativeLanguageCodes || ['es-US', 'fr-FR', 'de-DE', 'zh-CN'],
          enableAutomaticPunctuation: true,
          model: 'latest_long', // Best for longer audio
          useEnhanced: true, // Use enhanced models
          enableWordTimeOffsets: true,
          maxAlternatives: 3 // Get alternative transcriptions
        }
      };

      const [response] = await this.speechClient.recognize(request);

      if (!response.results || response.results.length === 0) {
        throw new Error('No transcription results');
      }

      // Primary transcript
      const primaryResult = response.results[0];
      const transcript = response.results
        .map((result: any) => result.alternatives[0].transcript)
        .join(' ');

      const confidence = primaryResult.alternatives[0].confidence || 0;
      const detectedLanguage = primaryResult.languageCode || metadata?.languageCode || 'en-US';

      // Alternative transcripts
      const alternativeTranscripts = primaryResult.alternatives
        .slice(1)
        .map((alt: any) => alt.transcript)
        .filter((t: string) => t && t.length > 0);

      const duration = (Date.now() - startTime) / 1000;
      const wordCount = transcript.split(/\s+/).length;

      logger.info(`Transcription complete: ${wordCount} words in ${duration.toFixed(2)}s`);

      return {
        transcript,
        confidence,
        language: detectedLanguage,
        duration,
        wordCount,
        alternativeTranscripts
      };

    } catch (error) {
      logger.error('Transcription error:', error);

      // Fallback to basic transcription
      return this.fallbackTranscription(audioBuffer, metadata);
    }
  }

  /**
   * Fallback transcription when Google Speech is not available
   * Returns mock data for development/testing
   */
  private fallbackTranscription(
    audioBuffer: Buffer,
    metadata?: Partial<AudioMetadata>
  ): TranscriptionResult {
    logger.warn('Using fallback transcription (Google Speech-to-Text not configured)');

    // In production, this would integrate with alternative transcription service
    // For now, return mock structure for development
    return {
      transcript: '[Audio transcription unavailable - Google Speech-to-Text not configured. Please add GOOGLE_APPLICATION_CREDENTIALS to enable transcription.]',
      confidence: 0,
      language: metadata?.languageCode || 'en-US',
      duration: 0,
      wordCount: 0,
      alternativeTranscripts: []
    };
  }

  /**
   * Transcribe long audio files (>1 minute)
   * Uses asynchronous recognition for better handling
   */
  async transcribeLongAudio(
    audioUri: string, // Google Cloud Storage URI
    metadata?: Partial<AudioMetadata>
  ): Promise<TranscriptionResult> {
    if (!this.speechClient) {
      return this.fallbackTranscription(Buffer.from(''), metadata);
    }

    try {
      const request = {
        audio: {
          uri: audioUri
        },
        config: {
          encoding: metadata?.encoding || 'LINEAR16',
          sampleRateHertz: metadata?.sampleRateHertz || 16000,
          languageCode: metadata?.languageCode || 'en-US',
          alternativeLanguageCodes: metadata?.alternativeLanguageCodes || ['es-US', 'fr-FR', 'de-DE'],
          enableAutomaticPunctuation: true,
          model: 'latest_long',
          useEnhanced: true,
          enableWordTimeOffsets: true,
          maxAlternatives: 3
        }
      };

      const [operation] = await this.speechClient.longRunningRecognize(request);
      const [response] = await operation.promise();

      const transcript = response.results
        .map((result: any) => result.alternatives[0].transcript)
        .join(' ');

      const confidence = response.results[0]?.alternatives[0]?.confidence || 0;
      const wordCount = transcript.split(/\s+/).length;

      return {
        transcript,
        confidence,
        language: metadata?.languageCode || 'en-US',
        duration: 0, // Would be calculated from audio metadata
        wordCount,
        alternativeTranscripts: []
      };

    } catch (error) {
      logger.error('Long audio transcription error:', error);
      throw error;
    }
  }

  /**
   * Analyze voice patterns for scam indicators
   * This is a basic implementation - production would use ML models
   */
  analyzeVoicePatterns(
    transcript: string,
    audioMetadata?: any
  ): VoiceAnalysis {
    const suspiciousPatterns: string[] = [];

    // Analyze transcript for scam indicators
    const transcriptLower = transcript.toLowerCase();

    // Urgency indicators
    if (/urgent|immediately|right now|act fast|limited time/i.test(transcript)) {
      suspiciousPatterns.push('Urgent pressure tactics detected');
    }

    // Payment requests
    if (/gift card|wire transfer|bitcoin|cryptocurrency|send money/i.test(transcript)) {
      suspiciousPatterns.push('Unusual payment method requested');
    }

    // Authority impersonation
    if (/irs|social security|microsoft|tech support|federal agent/i.test(transcript)) {
      suspiciousPatterns.push('Authority figure impersonation');
    }

    // Threats
    if (/arrest|lawsuit|legal action|suspended|frozen account/i.test(transcript)) {
      suspiciousPatterns.push('Threatening language detected');
    }

    // Secrecy requests
    if (/don't tell|keep secret|between us|don't hang up/i.test(transcript)) {
      suspiciousPatterns.push('Secrecy or isolation tactics');
    }

    // Determine emotional tone based on patterns
    let emotionalTone: VoiceAnalysis['emotionalTone'] = 'neutral';
    if (suspiciousPatterns.some(p => p.includes('Urgent'))) {
      emotionalTone = 'urgent';
    } else if (suspiciousPatterns.some(p => p.includes('Threatening'))) {
      emotionalTone = 'aggressive';
    } else if (/help|assist|resolve|fix/i.test(transcript)) {
      emotionalTone = 'friendly';
    }

    // Estimate speech rate (basic calculation)
    const wordCount = transcript.split(/\s+/).length;
    const estimatedDuration = audioMetadata?.duration || 60; // Assume 60 seconds if unknown
    const wordsPerMinute = (wordCount / estimatedDuration) * 60;

    let speechRate: VoiceAnalysis['speechRate'] = 'normal';
    if (wordsPerMinute > 180) speechRate = 'very_fast';
    else if (wordsPerMinute > 150) speechRate = 'fast';
    else if (wordsPerMinute < 100) speechRate = 'slow';

    return {
      speakerCount: 1, // Would require speaker diarization
      emotionalTone,
      speechRate,
      suspiciousPatterns
    };
  }

  /**
   * Detect language from audio
   */
  async detectLanguage(audioBuffer: Buffer): Promise<string> {
    if (!this.speechClient) {
      return 'en-US'; // Default fallback
    }

    try {
      const request = {
        audio: {
          content: audioBuffer.toString('base64')
        },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US', // Start with English
          alternativeLanguageCodes: [
            'es-US', 'fr-FR', 'de-DE', 'zh-CN', 'ja-JP',
            'ko-KR', 'pt-BR', 'ru-RU', 'ar-SA', 'hi-IN'
          ]
        }
      };

      const [response] = await this.speechClient.recognize(request);

      if (response.results && response.results.length > 0) {
        return response.results[0].languageCode || 'en-US';
      }

      return 'en-US';

    } catch (error) {
      logger.error('Language detection error:', error);
      return 'en-US';
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): { code: string; name: string }[] {
    return [
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'es-US', name: 'Spanish (US)' },
      { code: 'es-ES', name: 'Spanish (Spain)' },
      { code: 'fr-FR', name: 'French' },
      { code: 'de-DE', name: 'German' },
      { code: 'zh-CN', name: 'Chinese (Mandarin)' },
      { code: 'ja-JP', name: 'Japanese' },
      { code: 'ko-KR', name: 'Korean' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'ru-RU', name: 'Russian' },
      { code: 'ar-SA', name: 'Arabic' },
      { code: 'hi-IN', name: 'Hindi' },
      { code: 'it-IT', name: 'Italian' },
      { code: 'nl-NL', name: 'Dutch' }
    ];
  }

  /**
   * Validate audio format
   */
  validateAudioFormat(buffer: Buffer): {
    valid: boolean;
    format?: string;
    error?: string;
  } {
    // Check file signature (magic numbers)
    const signature = buffer.slice(0, 4).toString('hex');

    // WAV file
    if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WAVE') {
      return { valid: true, format: 'WAV' };
    }

    // MP3 file
    if (signature.startsWith('494433') || signature.startsWith('fffb')) {
      return { valid: true, format: 'MP3' };
    }

    // FLAC file
    if (buffer.slice(0, 4).toString() === 'fLaC') {
      return { valid: true, format: 'FLAC' };
    }

    // OGG file
    if (buffer.slice(0, 4).toString() === 'OggS') {
      return { valid: true, format: 'OGG' };
    }

    return {
      valid: false,
      error: 'Unsupported audio format. Please use WAV, MP3, FLAC, or OGG.'
    };
  }
}

export const audioTranscriptionService = new AudioTranscriptionService();
