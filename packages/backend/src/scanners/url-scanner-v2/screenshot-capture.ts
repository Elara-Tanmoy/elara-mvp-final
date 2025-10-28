/**
 * Screenshot Capture Service using Puppeteer
 * Captures screenshots for V2 screenshot CNN analysis
 * Per Architecture: Evidence Collection
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import fs from 'fs';
import { logger } from '../../config/logger.js';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'elara-mvp-13082025-u1';
const BUCKET_NAME = `${PROJECT_ID}-screenshots`;
const SCREENSHOT_TIMEOUT = 30000; // 30 seconds for slow/protected sites

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
   * Find Chromium executable path with fallback logic
   */
  private findChromiumPath(): string {
    // Try environment variables first (REQUIRED for puppeteer-core)
    if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
      logger.info(`[ScreenshotCapture] Using Chromium from PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
      logger.info(`[ScreenshotCapture] Using Chromium from CHROMIUM_PATH: ${process.env.CHROMIUM_PATH}`);
      return process.env.CHROMIUM_PATH;
    }

    // Try common paths in order
    const commonPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    ];

    for (const path of commonPaths) {
      if (fs.existsSync(path)) {
        logger.info(`[ScreenshotCapture] Found Chromium at: ${path}`);
        return path;
      }
    }

    // CRITICAL: puppeteer-core REQUIRES executablePath - throw error instead of returning undefined
    const error = '[ScreenshotCapture] CRITICAL: No Chromium found. puppeteer-core requires explicit executablePath. Set PUPPETEER_EXECUTABLE_PATH environment variable.';
    logger.error(error);
    throw new Error(error);
  }

  /**
   * Initialize browser instance
   */
  async initBrowser(): Promise<void> {
    if (!this.browser) {
      try {
        const executablePath = this.findChromiumPath();

        this.browser = await puppeteer.launch({
          executablePath,
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
        logger.info(`[ScreenshotCapture] Browser launched successfully with: ${executablePath}`);
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
    let page: Page | null = null;

    try {
      logger.info(`[ScreenshotCapture] Starting capture for: ${url}`);
      await this.initBrowser();

      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      page = await this.browser.newPage();
      logger.info(`[ScreenshotCapture] New page created`);

      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });

      // Set user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to URL with error handling
      logger.info(`[ScreenshotCapture] Navigating to ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: SCREENSHOT_TIMEOUT
      });
      logger.info(`[ScreenshotCapture] Page loaded successfully`);

      // Wait a bit for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Capture screenshot
      logger.info(`[ScreenshotCapture] Capturing screenshot`);
      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: false
      });
      logger.info(`[ScreenshotCapture] Screenshot captured: ${screenshotBuffer.length} bytes`);

      await page.close();
      page = null;

      // Generate filename
      const hash = crypto.createHash('md5').update(url).digest('hex');
      const timestamp = Date.now();
      const filename = `screenshots/${timestamp}-${hash}.png`;

      // Upload to GCS (unless skipped)
      let gcsUrl: string | undefined;
      if (!options.skipUpload) {
        logger.info(`[ScreenshotCapture] Uploading to GCS: ${filename}`);
        gcsUrl = await this.uploadToGCS(filename, screenshotBuffer);
        logger.info(`[ScreenshotCapture] Upload complete: ${gcsUrl}`);
      } else {
        // If skipping upload, return base64 data URL
        const base64 = screenshotBuffer.toString('base64');
        gcsUrl = `data:image/png;base64,${base64}`;
        logger.info(`[ScreenshotCapture] Returning base64 data URL (${base64.length} chars)`);
      }

      logger.info(`[ScreenshotCapture] SUCCESS - Screenshot captured for ${url}`);
      return {
        url: gcsUrl,
        width: 1920,
        height: 1080,
        size: screenshotBuffer.length,
        capturedAt: new Date()
      };
    } catch (error: any) {
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          logger.error(`[ScreenshotCapture] Error closing page:`, closeError);
        }
      }

      logger.error(`[ScreenshotCapture] FAILED to capture ${url}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

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
