/**
 * Category 6: Behavioral JavaScript Analysis (25 points)
 *
 * Checks:
 * - Auto-download/auto-execute scripts (10 pts)
 * - Popup/alert spam (7 pts)
 * - Clipboard access/manipulation (5 pts)
 * - Browser history manipulation (4 pts)
 * - Notification spam (3 pts)
 *
 * Runs in: FULL pipeline
 * NOTE: This is static analysis only. Full behavioral analysis would require browser automation.
 */

import {
  CategoryAnalyzer,
  CategoryResult,
  CategoryContext,
  Finding
} from '../categoryBase.js';
import { ReachabilityState } from '../types.js';
import { logger } from '../../../config/logger.js';

export class BehavioralJSCategory extends CategoryAnalyzer {
  // Auto-download patterns
  private static readonly AUTO_DOWNLOAD_PATTERNS = [
    /window\.open\s*\([^)]*\.exe[^)]*\)/i,
    /location\.href\s*=.*\.(exe|dll|bat|cmd|vbs)/i,
    /<a[^>]*download[^>]*href=[^>]*\.(exe|dll|bat)/i,
    /document\.createElement\s*\(\s*["']iframe["']\s*\)/i
  ];

  // Popup/alert spam patterns
  private static readonly POPUP_PATTERNS = [
    /alert\s*\(/gi,
    /confirm\s*\(/gi,
    /prompt\s*\(/gi,
    /window\.open\s*\(/gi
  ];

  // Clipboard manipulation
  private static readonly CLIPBOARD_PATTERNS = [
    /navigator\.clipboard/i,
    /document\.execCommand\s*\(\s*["']copy["']/i,
    /clipboardData/i
  ];

  // History manipulation
  private static readonly HISTORY_PATTERNS = [
    /history\.pushState/i,
    /history\.replaceState/i,
    /location\.replace/i
  ];

  // Notification spam
  private static readonly NOTIFICATION_PATTERNS = [
    /Notification\.requestPermission/i,
    /new\s+Notification/i,
    /showNotification/i
  ];

  // Suspicious event listeners
  private static readonly SUSPICIOUS_EVENTS = [
    /addEventListener\s*\(\s*["']beforeunload["']/i,
    /addEventListener\s*\(\s*["']contextmenu["']/i,
    /addEventListener\s*\(\s*["']copy["']/i,
    /addEventListener\s*\(\s*["']paste["']/i
  ];

  constructor() {
    super('behavioralJS', 'Behavioral JavaScript Analysis');
  }

  shouldRun(reachabilityState: ReachabilityState, pipelineType: string): boolean {
    return reachabilityState === ReachabilityState.ONLINE;
  }

  async analyze(context: CategoryContext): Promise<CategoryResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const config = context.config.behavioralJS;

    if (!context.httpResponse?.body) {
      return this.createSkippedResult('No HTTP response body', config.maxWeight);
    }

    const body = context.httpResponse.body;

    logger.debug(`[Behavioral JS] Analyzing JavaScript for: ${context.url}`);

    // Extract JavaScript code (inline and external references)
    const scriptContent = this.extractScriptContent(body);

    // Check 1: Auto-download/Auto-execute
    const downloadFindings = this.checkAutoDownload(scriptContent, config.checkWeights);
    findings.push(...downloadFindings);

    // Check 2: Popup/Alert Spam
    const popupFindings = this.checkPopupSpam(scriptContent, config.checkWeights);
    findings.push(...popupFindings);

    // Check 3: Clipboard Access
    const clipboardFindings = this.checkClipboardAccess(scriptContent, config.checkWeights);
    findings.push(...clipboardFindings);

    // Check 4: History Manipulation
    const historyFindings = this.checkHistoryManipulation(scriptContent, config.checkWeights);
    findings.push(...historyFindings);

    // Check 5: Notification Spam
    const notificationFindings = this.checkNotificationSpam(scriptContent, config.checkWeights);
    findings.push(...notificationFindings);

    // Check 6: Suspicious Event Listeners
    const eventFindings = this.checkSuspiciousEvents(scriptContent, config.checkWeights);
    findings.push(...eventFindings);

    const score = this.calculateScore(findings, config.maxWeight);
    const duration = Date.now() - startTime;

    logger.info(`[Behavioral JS] Complete: ${score}/${config.maxWeight} points, ${findings.length} findings (${duration}ms)`);

    return {
      categoryId: this.categoryId,
      categoryName: this.categoryName,
      score,
      maxWeight: config.maxWeight,
      findings,
      metadata: {
        checksRun: 6,
        checksSkipped: 0,
        duration,
        skipped: false
      }
    };
  }

  /**
   * Extract JavaScript content from HTML
   */
  private extractScriptContent(body: string): string {
    let scriptContent = '';

    // Extract inline scripts
    const scriptTags = body.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const tag of scriptTags) {
      const content = tag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      if (content && content[1]) {
        scriptContent += content[1] + '\n';
      }
    }

    // Also check inline event handlers
    const inlineHandlers = body.match(/on\w+\s*=\s*["'][^"']*["']/gi) || [];
    scriptContent += inlineHandlers.join('\n');

    return scriptContent;
  }

  /**
   * Check for auto-download/auto-execute patterns
   */
  private checkAutoDownload(scriptContent: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of BehavioralJSCategory.AUTO_DOWNLOAD_PATTERNS) {
      if (pattern.test(scriptContent)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length > 0) {
      findings.push(this.createFinding(
        'behavioral_auto_download',
        'Auto-Download Detected',
        'critical',
        weights.behavioral_auto_download || 12,
        `Attempts automatic file download/execution`,
        { patterns: matches }
      ));
    }

    return findings;
  }

  /**
   * Check for popup/alert spam
   */
  private checkPopupSpam(scriptContent: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    let totalPopups = 0;

    for (const pattern of BehavioralJSCategory.POPUP_PATTERNS) {
      const matches = scriptContent.match(pattern);
      if (matches) {
        totalPopups += matches.length;
      }
    }

    if (totalPopups >= 5) {
      findings.push(this.createFinding(
        'behavioral_popup_spam',
        'Excessive Popups/Alerts',
        'high',
        weights.behavioral_popup_spam || 8,
        `${totalPopups} popup/alert calls detected`,
        { count: totalPopups }
      ));
    }

    return findings;
  }

  /**
   * Check for clipboard access
   */
  private checkClipboardAccess(scriptContent: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of BehavioralJSCategory.CLIPBOARD_PATTERNS) {
      if (pattern.test(scriptContent)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length > 0) {
      findings.push(this.createFinding(
        'behavioral_clipboard_access',
        'Clipboard Access Detected',
        'medium',
        weights.behavioral_clipboard_access || 6,
        'Accesses or manipulates clipboard',
        { patterns: matches }
      ));
    }

    return findings;
  }

  /**
   * Check for history manipulation
   */
  private checkHistoryManipulation(scriptContent: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    let manipulationCount = 0;

    for (const pattern of BehavioralJSCategory.HISTORY_PATTERNS) {
      const matches = scriptContent.match(pattern);
      if (matches) {
        manipulationCount += matches.length;
      }
    }

    if (manipulationCount >= 2) {
      findings.push(this.createFinding(
        'behavioral_history_manipulation',
        'Browser History Manipulation',
        'medium',
        weights.behavioral_history_manipulation || 5,
        `${manipulationCount} history manipulation calls`,
        { count: manipulationCount }
      ));
    }

    return findings;
  }

  /**
   * Check for notification spam
   */
  private checkNotificationSpam(scriptContent: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of BehavioralJSCategory.NOTIFICATION_PATTERNS) {
      if (pattern.test(scriptContent)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length > 0) {
      findings.push(this.createFinding(
        'behavioral_notification_spam',
        'Notification Permission Request',
        'low',
        weights.behavioral_notification_spam || 3,
        'Requests notification permissions',
        {}
      ));
    }

    return findings;
  }

  /**
   * Check for suspicious event listeners
   */
  private checkSuspiciousEvents(scriptContent: string, weights: Record<string, number>): Finding[] {
    const findings: Finding[] = [];
    const matches: string[] = [];

    for (const pattern of BehavioralJSCategory.SUSPICIOUS_EVENTS) {
      if (pattern.test(scriptContent)) {
        matches.push(pattern.source);
      }
    }

    if (matches.length >= 2) {
      findings.push(this.createFinding(
        'behavioral_suspicious_events',
        'Suspicious Event Listeners',
        'medium',
        weights.behavioral_suspicious_events || 4,
        `${matches.length} suspicious event listeners`,
        { count: matches.length }
      ));
    }

    return findings;
  }
}
