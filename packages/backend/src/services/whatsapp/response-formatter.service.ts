import { logger } from '../../config/logger.js';

/**
 * Response Formatter Service
 *
 * Formats scan results into WhatsApp-friendly messages.
 * - Max 1600 characters
 * - Mobile-friendly formatting
 * - Emoji-rich for better readability
 * - Clear risk indicators
 */
class ResponseFormatterService {
  private readonly MAX_LENGTH = 1600;

  // Risk level emoji mapping
  private readonly riskEmojis: Record<string, string> = {
    safe: '✅',
    low: '🟡',
    medium: '⚠️',
    high: '🚨',
    critical: '🔴'
  };

  /**
   * Format scan results for WhatsApp - ENHANCED USER-FRIENDLY FORMAT
   * Priority: Action → Risk → Why → Details
   */
  public formatScanResults(
    overallRisk: string,
    overallScore: number,
    textAnalysis: any,
    urlAnalyses: any[],
    mediaAnalyses?: any[],
    profileAnalyses?: any[],
    factCheckResult?: any
  ): string {
    try {
      let message = '';

      // 1. RECOMMENDATION FIRST (Most Important - What Should User Do?)
      message += '🛡️ *SECURITY SCAN COMPLETE*\n\n';
      message += this.formatRecommendation(overallRisk, textAnalysis, urlAnalyses, mediaAnalyses);

      // 2. RISK ASSESSMENT (Clear visual indicator)
      message += '\n\n━━━━━━━━━━━━━━━━━━━━━━';
      message += '\n' + this.formatHeader(overallRisk, overallScore);

      // 3. WHY THIS RISK (Key findings summary)
      const keyFindings = this.formatKeyFindings(overallRisk, textAnalysis, urlAnalyses, mediaAnalyses, profileAnalyses, factCheckResult);
      if (keyFindings) {
        message += '\n\n' + keyFindings;
      }

      // 4. AI VERDICT & DETAILED ANALYSIS (if available)
      const verdict = this.extractAIVerdict(mediaAnalyses);
      if (verdict) {
        message += '\n\n━━━━━━━━━━━━━━━━━━━━━━';
        message += '\n💡 *AI ANALYSIS*\n' + verdict;
      }

      // 5. OCR TEXT (if found in media)
      const ocrText = this.extractOCRText(mediaAnalyses);
      if (ocrText) {
        message += '\n\n📝 *Text Found:*\n"' + ocrText + '"';
      }

      // 6. CONVERSATION ANALYSIS (if detected)
      const convAnalysis = this.extractConversationAnalysis(mediaAnalyses);
      if (convAnalysis) {
        message += '\n\n' + convAnalysis;
      }

      // 7. FACT CHECK (if performed)
      if (factCheckResult && factCheckResult.success) {
        message += '\n\n━━━━━━━━━━━━━━━━━━━━━━';
        message += '\n' + this.formatFactCheck(factCheckResult);
      }

      // Footer
      message += '\n\n_🔒 Powered by Elara Security_';

      // Ensure message fits within limit
      if (message.length > this.MAX_LENGTH) {
        logger.warn('[ResponseFormatter] Message exceeds max length, truncating', {
          originalLength: message.length,
          maxLength: this.MAX_LENGTH
        });
        message = this.truncateMessage(message);
      }

      logger.debug('[ResponseFormatter] ENHANCED message formatted', {
        length: message.length,
        overallRisk,
        hasMedia: !!(mediaAnalyses && mediaAnalyses.length > 0),
        hasProfiles: !!(profileAnalyses && profileAnalyses.length > 0),
        hasFactCheck: !!factCheckResult
      });

      return message;
    } catch (error) {
      logger.error('[ResponseFormatter] Error formatting response', { error });
      return this.formatErrorMessage();
    }
  }

  /**
   * Format header with risk level
   */
  private formatHeader(risk: string, score: number): string {
    const emoji = this.riskEmojis[risk] || '⚪';
    const riskText = risk.toUpperCase();

    return `${emoji} *ELARA SECURITY SCAN*\nRisk Level: *${riskText}*`;
  }

  /**
   * Format text analysis section
   */
  private formatTextAnalysis(textAnalysis: any): string {
    const result = textAnalysis.result;

    if (!result) {
      return '📄 *Message:* Unable to analyze';
    }

    const riskLevel = result.riskLevel || 'unknown';
    const emoji = this.riskEmojis[riskLevel] || '⚪';

    let section = `📄 *Message Analysis*\n${emoji} Risk: ${riskLevel.toUpperCase()}`;

    // Add key findings if available
    if (result.findings && Array.isArray(result.findings) && result.findings.length > 0) {
      const topFindings = result.findings.slice(0, 2); // Limit to top 2 findings
      topFindings.forEach((finding: any) => {
        if (finding.description) {
          section += `\n• ${finding.description}`;
        }
      });
    } else if (riskLevel === 'safe') {
      section += '\n• No threats detected';
    }

    return section;
  }

  /**
   * Format URL analyses section
   */
  private formatURLAnalyses(urlAnalyses: any[]): string {
    const count = urlAnalyses.length;
    let section = `🔗 *URLs Detected (${count})*`;

    urlAnalyses.forEach((urlAnalysis, index) => {
      if (!urlAnalysis || !urlAnalysis.result) return;

      const result = urlAnalysis.result;
      const riskLevel = result.riskLevel || 'unknown';
      const emoji = this.riskEmojis[riskLevel] || '⚪';
      const domain = urlAnalysis.domain || 'unknown';

      // Show number, domain, and risk
      section += `\n${index + 1}. ${domain}`;
      section += `\n   ${emoji} Risk: *${riskLevel.toUpperCase()}*`;

      // Add key finding if critical or high
      if (['critical', 'high'].includes(riskLevel) && result.findings && result.findings[0]) {
        const finding = result.findings[0];
        if (finding.description) {
          section += `\n   ⚠️ ${finding.description}`;
        }
      }

      // Add shortener warning
      if (urlAnalysis.isShortener) {
        section += '\n   🔗 URL Shortener detected';
      }
    });

    return section;
  }

  /**
   * Format media analyses section (NEW)
   */
  private formatMediaAnalyses(mediaAnalyses: any[]): string {
    const count = mediaAnalyses.length;
    let section = `📎 *Media Files Scanned (${count})*`;

    mediaAnalyses.forEach((mediaAnalysis, index) => {
      if (!mediaAnalysis || !mediaAnalysis.result) return;

      const result = mediaAnalysis.result;
      const riskLevel = result.riskLevel || 'unknown';
      const emoji = this.riskEmojis[riskLevel] || '⚪';
      const mediaType = mediaAnalysis.mediaType || 'unknown';

      // Show number, type, and risk
      section += `\n${index + 1}. ${this.getMediaTypeLabel(mediaType)}`;
      section += `\n   ${emoji} Risk: *${riskLevel.toUpperCase()}*`;

      // ENHANCED: Show AI verdict if available (from file scanner)
      if (result.verdict && result.verdict.simple) {
        const simpleVerdict = result.verdict.simple.substring(0, 150);
        section += `\n   💡 ${simpleVerdict}${result.verdict.simple.length > 150 ? '...' : ''}`;
      }

      // Add OCR text if available
      if (result.ocrText && result.ocrText.trim().length > 0) {
        const preview = result.ocrText.substring(0, 50);
        section += `\n   📝 Text found: "${preview}${result.ocrText.length > 50 ? '...' : ''}"`;
      }

      // ENHANCED: Show conversation analysis if detected
      if (result.conversationAnalysis && result.conversationAnalysis.detected) {
        const conv = result.conversationAnalysis;
        section += `\n   💬 Conversation: ${conv.totalMessages} messages`;
        if (conv.progression && conv.progression.isTypicalScamProgression) {
          section += `\n   🚨 ${conv.progression.progressionType} pattern detected`;
        }
      }

      // Add threats/findings if found
      if (result.threats && result.threats.length > 0) {
        const threat = result.threats[0];
        if (threat.description || threat.message) {
          section += `\n   ⚠️ ${threat.description || threat.message}`;
        }
      } else if (result.findings && result.findings.length > 0) {
        const finding = result.findings[0];
        if (finding.description || finding.message) {
          section += `\n   ⚠️ ${finding.description || finding.message}`;
        }
      }
    });

    return section;
  }

  /**
   * Format profile analyses section (NEW)
   */
  private formatProfileAnalyses(profileAnalyses: any[]): string {
    const count = profileAnalyses.length;
    let section = `👤 *Social Profiles Checked (${count})*`;

    profileAnalyses.forEach((profileAnalysis, index) => {
      if (!profileAnalysis || !profileAnalysis.success) return;

      const riskLevel = profileAnalysis.riskLevel || 'unknown';
      const emoji = this.riskEmojis[riskLevel] || '⚪';
      const platform = profileAnalysis.platform || 'unknown';
      const verdict = profileAnalysis.verdict || 'Unknown';

      // Show number, platform, and verdict
      section += `\n${index + 1}. ${this.getPlatformEmoji(platform)} ${platform.toUpperCase()}`;
      section += `\n   ${emoji} *${verdict}*`;

      // Add risk score
      if (profileAnalysis.riskScore !== undefined) {
        section += ` (${profileAnalysis.riskScore}/100)`;
      }

      // Add simple view summary if available
      if (profileAnalysis.simpleView && profileAnalysis.simpleView.summary) {
        const summary = profileAnalysis.simpleView.summary.substring(0, 80);
        section += `\n   📊 ${summary}${profileAnalysis.simpleView.summary.length > 80 ? '...' : ''}`;
      }
    });

    return section;
  }

  /**
   * Format fact check section (NEW)
   */
  private formatFactCheck(factCheckResult: any): string {
    const veracity = factCheckResult.veracity || 'UNVERIFIED';
    const confidence = Math.round((factCheckResult.confidence || 0) * 100);

    let emoji = '❓';
    if (veracity === 'TRUE') emoji = '✅';
    else if (veracity === 'MOSTLY_TRUE') emoji = '🟢';
    else if (veracity === 'MIXED') emoji = '🟡';
    else if (veracity === 'MOSTLY_FALSE') emoji = '🟠';
    else if (veracity === 'FALSE') emoji = '🔴';

    let section = `${emoji} *FACT CHECK RESULT*`;
    section += `\n*Verdict:* ${veracity} (${confidence}% confidence)`;

    // Add claim if available
    if (factCheckResult.claim && factCheckResult.claim.length < 100) {
      section += `\n*Claim:* "${factCheckResult.claim}"`;
    }

    // Add explanation
    if (factCheckResult.explanation) {
      const explanation = factCheckResult.explanation.substring(0, 150);
      section += `\n\n${explanation}${factCheckResult.explanation.length > 150 ? '...' : ''}`;
    }

    // Add sources count
    if (factCheckResult.sourcesCount && factCheckResult.sourcesCount > 0) {
      section += `\n\n📰 Verified by ${factCheckResult.sourcesCount} source${factCheckResult.sourcesCount !== 1 ? 's' : ''}`;
    }

    // Add harm level warning
    if (factCheckResult.harmLevel && ['MEDIUM', 'SEVERE'].includes(factCheckResult.harmLevel)) {
      section += `\n\n⚠️ *HARM LEVEL: ${factCheckResult.harmLevel}*`;
      if (factCheckResult.harmDescription) {
        section += `\n${factCheckResult.harmDescription.substring(0, 100)}`;
      }
    }

    return section;
  }

  /**
   * Helper: Get media type label
   */
  private getMediaTypeLabel(mediaType: string): string {
    if (mediaType.startsWith('image/')) return 'Image';
    if (mediaType === 'application/pdf') return 'PDF';
    if (mediaType.includes('document')) return 'Document';
    if (mediaType.includes('text')) return 'Text File';
    return 'File';
  }

  /**
   * Helper: Get platform emoji
   */
  private getPlatformEmoji(platform: string): string {
    const emojiMap: Record<string, string> = {
      facebook: '📘',
      instagram: '📷',
      twitter: '🐦',
      linkedin: '💼',
      telegram: '✈️',
      tiktok: '🎵'
    };
    return emojiMap[platform.toLowerCase()] || '🌐';
  }

  /**
   * NEW: Format key findings - WHY this risk level was assigned
   */
  private formatKeyFindings(
    overallRisk: string,
    textAnalysis: any,
    urlAnalyses: any[],
    mediaAnalyses?: any[],
    profileAnalyses?: any[],
    factCheckResult?: any
  ): string | null {
    const findings: string[] = [];

    // Extract text analysis threats
    if (textAnalysis?.result?.findings && Array.isArray(textAnalysis.result.findings)) {
      textAnalysis.result.findings.slice(0, 2).forEach((finding: any) => {
        if (finding.description) {
          findings.push(finding.description);
        }
      });
    }

    // Extract URL threats
    if (urlAnalyses && urlAnalyses.length > 0) {
      urlAnalyses.forEach((urlAnalysis) => {
        if (urlAnalysis?.result?.riskLevel && ['critical', 'high'].includes(urlAnalysis.result.riskLevel)) {
          if (urlAnalysis.result.findings && urlAnalysis.result.findings[0]) {
            const finding = urlAnalysis.result.findings[0];
            if (finding.description) {
              findings.push(`URL: ${finding.description}`);
            }
          }
        }
      });
    }

    // Extract media threats
    if (mediaAnalyses && mediaAnalyses.length > 0) {
      mediaAnalyses.forEach((mediaAnalysis) => {
        const result = mediaAnalysis?.result;
        if (result) {
          // Check for threats
          if (result.threats && result.threats.length > 0) {
            const threat = result.threats[0];
            if (threat.description || threat.message) {
              findings.push(`Media: ${threat.description || threat.message}`);
            }
          }
          // Check for scam progression
          if (result.conversationAnalysis?.progression?.isTypicalScamProgression) {
            const progType = result.conversationAnalysis.progression.progressionType || 'scam';
            findings.push(`Conversation shows ${progType} pattern`);
          }
        }
      });
    }

    // Extract profile warnings
    if (profileAnalyses && profileAnalyses.length > 0) {
      profileAnalyses.forEach((profileAnalysis) => {
        if (profileAnalysis?.riskLevel && ['critical', 'high'].includes(profileAnalysis.riskLevel)) {
          findings.push(`Profile: ${profileAnalysis.verdict || 'Suspicious activity detected'}`);
        }
      });
    }

    // Extract fact check warnings
    if (factCheckResult?.veracity && ['FALSE', 'MOSTLY_FALSE'].includes(factCheckResult.veracity)) {
      findings.push(`Fact Check: ${factCheckResult.veracity} - ${factCheckResult.claim?.substring(0, 50) || 'False information detected'}`);
    }

    // If no specific findings, provide risk-based summary
    if (findings.length === 0) {
      switch (overallRisk) {
        case 'critical':
        case 'high':
          return '🔍 *Why This Risk:*\nMultiple threat indicators detected in the content';
        case 'medium':
          return '🔍 *Why This Risk:*\nSome suspicious patterns found that require verification';
        case 'low':
          return '🔍 *Why This Risk:*\nMinor concerns detected, but mostly safe';
        case 'safe':
        default:
          return null; // Don't show section for safe content
      }
    }

    // Build findings section
    let section = '🔍 *Why This Risk:*';
    findings.slice(0, 3).forEach((finding) => {
      section += `\n• ${finding}`;
    });

    if (findings.length > 3) {
      section += `\n• ...and ${findings.length - 3} more issue${findings.length - 3 !== 1 ? 's' : ''}`;
    }

    return section;
  }

  /**
   * NEW: Extract AI verdict from media analyses
   */
  private extractAIVerdict(mediaAnalyses?: any[]): string | null {
    if (!mediaAnalyses || mediaAnalyses.length === 0) {
      return null;
    }

    const mediaResult = mediaAnalyses[0]?.result;
    if (!mediaResult?.verdict?.simple) {
      return null;
    }

    // Return simple verdict (already user-friendly)
    return mediaResult.verdict.simple;
  }

  /**
   * NEW: Extract OCR text from media analyses
   */
  private extractOCRText(mediaAnalyses?: any[]): string | null {
    if (!mediaAnalyses || mediaAnalyses.length === 0) {
      return null;
    }

    const mediaResult = mediaAnalyses[0]?.result;
    const ocrText = mediaResult?.ocrText || mediaResult?.extractedText;

    if (!ocrText || ocrText.trim().length === 0) {
      return null;
    }

    // Return preview (first 150 chars)
    const preview = ocrText.trim().substring(0, 150);
    return preview + (ocrText.length > 150 ? '...' : '');
  }

  /**
   * NEW: Extract conversation analysis from media analyses
   */
  private extractConversationAnalysis(mediaAnalyses?: any[]): string | null {
    if (!mediaAnalyses || mediaAnalyses.length === 0) {
      return null;
    }

    const mediaResult = mediaAnalyses[0]?.result;
    const convAnalysis = mediaResult?.conversationAnalysis;

    if (!convAnalysis || !convAnalysis.detected) {
      return null;
    }

    let section = '💬 *Conversation Analysis*';

    // Show message count
    if (convAnalysis.totalMessages) {
      section += `\n• ${convAnalysis.totalMessages} messages detected`;
    }

    // Show participants
    if (convAnalysis.participants && convAnalysis.participants.length > 0) {
      section += `\n• ${convAnalysis.participants.length} participant${convAnalysis.participants.length !== 1 ? 's' : ''}`;
    }

    // Show scam progression warning
    if (convAnalysis.progression?.isTypicalScamProgression) {
      const emoji = '🚨';
      const progType = convAnalysis.progression.progressionType || 'scam';
      section += `\n${emoji} *${progType.toUpperCase()} PATTERN DETECTED*`;

      if (convAnalysis.progression.stage) {
        section += `\n• Stage: ${convAnalysis.progression.stage}`;
      }
    }

    // Show urgency manipulation
    if (convAnalysis.manipulationTactics?.urgencyManipulation) {
      section += '\n⚠️ Urgency manipulation detected';
    }

    // Show trust building
    if (convAnalysis.manipulationTactics?.trustBuilding) {
      section += '\n⚠️ Trust building tactics used';
    }

    return section;
  }

  /**
   * Format recommendation based on risk level - ENHANCED with verdict
   */
  private formatRecommendation(
    overallRisk: string,
    textAnalysis: any,
    urlAnalyses: any[],
    mediaAnalyses?: any[]
  ): string {
    let section = '💡 *Recommendation:*\n';

    // ENHANCED: Use AI verdict recommendation if available from media scan
    if (mediaAnalyses && mediaAnalyses.length > 0) {
      const mediaResult = mediaAnalyses[0]?.result;
      if (mediaResult?.verdict && mediaResult.verdict.recommendation) {
        section += mediaResult.verdict.recommendation;

        // Add safety advice if available
        if (mediaResult.verdict.safetyAdvice && mediaResult.verdict.safetyAdvice.length > 0) {
          section += '\n\n*Safety Tips:*';
          mediaResult.verdict.safetyAdvice.slice(0, 3).forEach((tip: string) => {
            section += `\n${tip}`;
          });
        }
        return section;
      }
    }

    // Fallback to default recommendations
    switch (overallRisk) {
      case 'critical':
        section += '⛔ *DO NOT INTERACT!* This is a confirmed threat. Delete immediately and report if you received payment requests or personal information requests.';
        break;

      case 'high':
        section += '🚫 *HIGHLY SUSPICIOUS!* Do not click links, download files, or share personal information. This appears to be a scam or phishing attempt.';
        break;

      case 'medium':
        section += '⚠️ *BE CAUTIOUS.* Verify the sender\'s identity before taking any action. Do not share sensitive information or make payments.';
        break;

      case 'low':
        section += '🟡 *PROCEED WITH CAUTION.* Some minor concerns detected. Verify the source before clicking links or downloading files.';
        break;

      case 'safe':
      default:
        section += '✅ *APPEARS SAFE.* No significant threats detected. However, always verify the sender and be cautious with personal information.';
        break;
    }

    return section;
  }

  /**
   * Format welcome message for new users
   */
  public formatWelcomeMessage(displayName?: string): string {
    const greeting = displayName ? `Hi ${displayName}!` : 'Welcome!';

    return `👋 *${greeting}*\n\n✅ *Your Elara account is activated!*\n\nForward me any suspicious messages, links, or content and I'll scan them for:\n• Phishing attempts\n• Scam messages\n• Malicious links\n• Fraud attempts\n\n*📊 Your Plan:*\n• 5 free scans per day\n• Resets every 24 hours\n• Upgrade for more scans\n\n*How to use:*\nJust send me the suspicious message or link!\n\n_Powered by Elara Security_`;
  }

  /**
   * Format rate limit exceeded message
   */
  public formatRateLimitMessage(resetTimeHours: number): string {
    const hours = Math.floor(resetTimeHours);
    const minutes = Math.floor((resetTimeHours - hours) * 60);

    let timeString = '';
    if (hours > 0) {
      timeString = `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) {
        timeString += ` and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
    } else {
      timeString = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    return `⏳ *DAILY LIMIT REACHED*\n\nYou've used all 5 scans for today.\nYour limit will reset in *${timeString}*.\n\n💡 *Want more scans?*\nUpgrade to Premium for:\n• 50 scans per day\n• Priority processing\n• Advanced threat detection\n\n_Powered by Elara Security_`;
  }

  /**
   * Format processing error message
   */
  public formatErrorMessage(errorType?: string): string {
    switch (errorType) {
      case 'timeout':
        return '⏱️ *ANALYSIS TIMEOUT*\n\nThe scan took too long to complete. Please try again in a moment.\n\nIf the problem persists, the service may be experiencing high load.\n\n_Powered by Elara Security_';

      case 'service_unavailable':
        return '🔧 *SERVICE UNAVAILABLE*\n\nThe security scanning service is temporarily unavailable. Please try again in a few minutes.\n\n_Powered by Elara Security_';

      default:
        return '❌ *ANALYSIS ERROR*\n\nWe couldn\'t complete the security scan due to a technical issue. Please try again later.\n\nIf the problem continues, contact support.\n\n_Powered by Elara Security_';
    }
  }

  /**
   * Truncate message to fit within character limit
   */
  private truncateMessage(message: string): string {
    const footer = '\n\n...(truncated)\n\n_Powered by Elara Security_';
    const maxContentLength = this.MAX_LENGTH - footer.length;

    const truncated = message.substring(0, maxContentLength);
    return truncated + footer;
  }

  /**
   * Format low balance warning
   */
  public formatLowBalanceWarning(remaining: number): string {
    return `\n\n⚠️ You have *${remaining} scan${remaining !== 1 ? 's' : ''}* remaining today.`;
  }
}

// Export singleton instance
export const responseFormatter = new ResponseFormatterService();
