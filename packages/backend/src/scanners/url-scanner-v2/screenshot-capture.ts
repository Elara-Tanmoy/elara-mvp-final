/**
 * Screenshot Capture Service using Puppeteer
 * Captures screenshots for V2 screenshot CNN analysis
 * Per Architecture: Evidence Collection
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import { logger } from '../../config/logger.js';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'elara-mvp-13082025-u1';
const BUCKET_NAME = `${PROJECT_ID}-screenshots`;
const SCREENSHOT_TIMEOUT = 15000; // 15 seconds

export interface ScreenshotResult {
  url?: string;
  error?: string;
  width?: number;
  height?: number;
  size?: number;
  capturedAt?: Date;
}

export class ScreenshotCaptureService {
  private browser: Browser | null = null;
  private storage: Storage;

  constructor() {
    this.storage = new Storage({ projectId: PROJECT_ID });
  }

  /**
   * Initialize browser instance
   */
  async initBrowser(): Promise<void> {
    if (!this.browser) {
      try {
        this.browser = await puppeteer.launch({
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',  // CRITICAL for Docker - prevents crashes
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-tools',
            '--no-first-run',
            '--no-zygote',
            '--single-process',  // Helps in containerized envs
            '--disable-extensions'
          ],
          headless: true,
          timeout: 30000
        });
        logger.info('[ScreenshotCapture] Browser launched successfully');
      } catch (error: any) {
        logger.error('[ScreenshotCapture] Failed to launch browser:', error.message);
        throw error;
      }
    }
  }

  /**
   * Capture screenshot of URL
   */
  async capture(url: string, options: { skipUpload?: boolean } = {}): Promise<ScreenshotResult> {
    try {
      await this.initBrowser();

      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      const page: Page = await this.browser.newPage();

      try {
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Set user agent
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // Navigate to URL
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: SCREENSHOT_TIMEOUT
        });

        // Wait a bit for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Capture screenshot
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: false
        });

        await page.close();

        // Generate filename
        const hash = crypto.createHash('md5').update(url).digest('hex');
        const timestamp = Date.now();
        const filename = `screenshots/${timestamp}-${hash}.png`;

        // Upload to GCS (unless skipped)
        let gcsUrl: string | undefined;
        if (!options.skipUpload) {
          gcsUrl = await this.uploadToGCS(filename, screenshotBuffer);
        }

        return {
          url: gcsUrl,
          width: 1920,
          height: 1080,
          size: screenshotBuffer.length,
          capturedAt: new Date()
        };
      } catch (error: any) {
        await page.close();
        throw error;
      }
    } catch (error: any) {
      logger.error(`[ScreenshotCapture] Failed to capture ${url}:`, error.message);
      return {
        error: error.message
      };
    }
  }

  /**
   * Upload screenshot to Google Cloud Storage
   */
  private async uploadToGCS(filename: string, buffer: Buffer): Promise<string> {
    try {
      const bucket = this.storage.bucket(BUCKET_NAME);
      const file = bucket.file(filename);

      await file.save(buffer, {
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=86400'
        }
      });

      // Make publicly readable (or use signed URLs for private access)
      await file.makePublic();

      return `gs://${BUCKET_NAME}/${filename}`;
    } catch (error: any) {
      logger.error('[ScreenshotCapture] Failed to upload to GCS:', error.message);
      throw error;
    }
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('[ScreenshotCapture] Browser closed');
    }
  }
}

// Singleton instance
let screenshotService: ScreenshotCaptureService | null = null;

export function getScreenshotService(): ScreenshotCaptureService {
  if (!screenshotService) {
    screenshotService = new ScreenshotCaptureService();
  }
  return screenshotService;
}

export async function closeScreenshotService(): Promise<void> {
  if (screenshotService) {
    await screenshotService.close();
    screenshotService = null;
  }
}
