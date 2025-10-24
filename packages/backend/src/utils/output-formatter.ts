interface Finding {
  check: string;
  result: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  points: number;
  maxPoints: number;
  explanation: string;
  evidence?: any;
}

interface CategoryResult {
  category: string;
  score: number;
  maxScore: number;
  findings: Finding[];
  status: 'PASS' | 'WARNING' | 'FAIL';
}

interface AIModelResponse {
  model: string;
  response: string;
  confidence: number;
  verdict: string;
}

interface ThreatIntelSource {
  source: string;
  result: string;
  details: any;
}

export class OutputFormatter {
  /**
   * Professional ASCII-art formatted output for threat detection results
   */

  static formatScanResult(data: {
    url: string;
    totalScore: number;
    maxScore: number;
    riskLevel: string;
    confidence: number;
    categories: CategoryResult[];
    aiModels?: AIModelResponse[];
    threatIntel?: ThreatIntelSource[];
    finalVerdict: string;
    recommendations: string[];
    scanDuration: number;
  }): string {
    const lines: string[] = [];

    // Header
    lines.push(this.createDoubleBox('🔍 ELARA THREAT DETECTION REPORT'));
    lines.push('');
    lines.push(`URL: ${data.url}`);
    lines.push(`Scan Date: ${new Date().toISOString()}`);
    lines.push(`Analysis Duration: ${data.scanDuration.toFixed(1)} seconds`);
    lines.push(`Sources Consulted: ${(data.aiModels?.length || 0) + (data.threatIntel?.length || 0)}`);
    lines.push('');

    // Overall Risk Score
    const percentage = Math.round((data.totalScore / data.maxScore) * 100);
    lines.push(this.createSingleBox([
      `OVERALL RISK SCORE: ${data.totalScore}/${data.maxScore} points (${percentage}%)`,
      this.createProgressBar(percentage, 50),
      '',
      `RISK LEVEL: ${this.formatRiskLevel(data.riskLevel)}`,
      `CONFIDENCE: ${data.confidence}% (${this.getConfidenceLabel(data.confidence)})`,
      `CONSENSUS: ${this.getConsensusStatus(data.aiModels, data.threatIntel)}`
    ]));
    lines.push('');

    // Category Breakdown
    lines.push(this.createDivider());
    lines.push('CATEGORY BREAKDOWN');
    lines.push(this.createDivider());
    lines.push('');
    lines.push(this.createCategoryTable(data.categories));
    lines.push('');

    // Findings by Severity
    const allFindings = data.categories.flatMap(cat => cat.findings);
    const criticalFindings = allFindings.filter(f => f.severity === 'CRITICAL');
    const highFindings = allFindings.filter(f => f.severity === 'HIGH');
    const mediumFindings = allFindings.filter(f => f.severity === 'MEDIUM');
    const lowFindings = allFindings.filter(f => f.severity === 'LOW');

    if (criticalFindings.length > 0) {
      lines.push(`🔴 CRITICAL FINDINGS (${criticalFindings.length} total):`);
      criticalFindings.forEach((finding, idx) => {
        lines.push(`   ${idx + 1}. ${finding.check}: ${finding.result} (+${finding.points} pts)`);
        lines.push(`      ${finding.explanation}`);
      });
      lines.push('');
    }

    if (highFindings.length > 0) {
      lines.push(`🟠 HIGH SEVERITY FINDINGS (${highFindings.length} total):`);
      highFindings.forEach((finding, idx) => {
        lines.push(`   ${idx + 1}. ${finding.check}: ${finding.result} (+${finding.points} pts)`);
        lines.push(`      ${finding.explanation}`);
      });
      lines.push('');
    }

    if (mediumFindings.length > 0) {
      lines.push(`🟡 MEDIUM SEVERITY FINDINGS (${mediumFindings.length} total):`);
      mediumFindings.forEach((finding, idx) => {
        lines.push(`   ${idx + 1}. ${finding.check}: ${finding.result} (+${finding.points} pts)`);
        lines.push(`      ${finding.explanation}`);
      });
      lines.push('');
    }

    // AI Model Analyses
    if (data.aiModels && data.aiModels.length > 0) {
      lines.push(this.createDivider());
      lines.push('AI CONSENSUS ANALYSIS');
      lines.push(this.createDivider());
      lines.push('');

      data.aiModels.forEach(model => {
        lines.push(this.createDoubleBox(`🤖 ${model.model.toUpperCase()} - ${model.confidence}% Confidence ${model.verdict}`));
        lines.push(model.response);
        lines.push('');
      });

      const consensus = this.calculateAIConsensus(data.aiModels);
      lines.push(`CONSENSUS: ${consensus.agreement}/${data.aiModels.length} MODELS AGREE - ${consensus.verdict}`);
      lines.push('');
    }

    // Threat Intelligence Sources
    if (data.threatIntel && data.threatIntel.length > 0) {
      lines.push(this.createDivider());
      lines.push('THREAT INTELLIGENCE SOURCES');
      lines.push(this.createDivider());
      lines.push('');

      data.threatIntel.forEach(source => {
        lines.push(`📡 ${source.source.toUpperCase()}: ${source.result}`);
        if (source.details) {
          lines.push(`   ${JSON.stringify(source.details)}`);
        }
        lines.push('');
      });
    }

    // Final Verdict
    lines.push(this.createDivider());
    lines.push('FINAL VERDICT');
    lines.push(this.createDivider());
    lines.push('');
    lines.push(this.formatFinalVerdict(data.riskLevel, data.finalVerdict));
    lines.push('');

    // Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      const criticalRecommendations = this.getCriticalRecommendations(data.riskLevel);

      lines.push('❌ DO NOT:');
      criticalRecommendations.doNot.forEach(item => {
        lines.push(`   • ${item}`);
      });
      lines.push('');

      lines.push('✅ DO:');
      criticalRecommendations.do.forEach(item => {
        lines.push(`   • ${item}`);
      });
      lines.push('');
    }

    // Technical Evidence Section
    lines.push(this.createDivider());
    lines.push('TECHNICAL EVIDENCE');
    lines.push(this.createDivider());
    lines.push('');

    data.categories.forEach(category => {
      if (category.findings.length > 0) {
        lines.push(`\n${category.category}:`);
        category.findings.forEach(finding => {
          if (finding.evidence) {
            lines.push(`  • ${finding.check}: ${JSON.stringify(finding.evidence, null, 2)}`);
          }
        });
      }
    });

    lines.push('');
    lines.push(this.createDivider());
    lines.push('🤖 Generated with Elara Threat Detection Platform');
    lines.push(this.createDivider());

    return lines.join('\n');
  }

  static formatMessageScanResult(data: {
    message: string;
    emotionalManipulation: {
      urgency: number;
      fear: number;
      greed: number;
      trust: number;
      excitement: number;
      anxiety: number;
    };
    phishingPatterns: string[];
    aiModels: AIModelResponse[];
    finalVerdict: string;
    recommendations: string[];
  }): string {
    const lines: string[] = [];

    lines.push(this.createDoubleBox('📨 MESSAGE THREAT ANALYSIS'));
    lines.push('');
    lines.push('MESSAGE CONTENT:');
    lines.push(this.createSingleBox([data.message]));
    lines.push('');

    // Emotional Manipulation Analysis
    lines.push(this.createDivider());
    lines.push('EMOTIONAL MANIPULATION ANALYSIS');
    lines.push(this.createDivider());
    lines.push('');

    Object.entries(data.emotionalManipulation).forEach(([emotion, score]) => {
      const percentage = Math.round(score * 100);
      lines.push(`${this.capitalizeFirst(emotion)}: ${this.createProgressBar(percentage, 30)} ${percentage}%`);
    });
    lines.push('');

    // Phishing Patterns
    if (data.phishingPatterns.length > 0) {
      lines.push('🚨 DETECTED PHISHING PATTERNS:');
      data.phishingPatterns.forEach((pattern, idx) => {
        lines.push(`   ${idx + 1}. ${pattern}`);
      });
      lines.push('');
    }

    // AI Model Analyses
    lines.push(this.createDivider());
    lines.push('AI MODEL ANALYSES');
    lines.push(this.createDivider());
    lines.push('');

    data.aiModels.forEach(model => {
      lines.push(this.createDoubleBox(`🤖 ${model.model.toUpperCase()}`));
      lines.push(model.response);
      lines.push('');
    });

    // Final Verdict
    lines.push(this.createDivider());
    lines.push('FINAL VERDICT');
    lines.push(this.createDivider());
    lines.push('');
    lines.push(data.finalVerdict);
    lines.push('');

    // Recommendations
    if (data.recommendations.length > 0) {
      lines.push('RECOMMENDATIONS:');
      data.recommendations.forEach((rec, idx) => {
        lines.push(`   ${idx + 1}. ${rec}`);
      });
    }

    return lines.join('\n');
  }

  static formatFileScreenshotResult(data: {
    ocrQuality: number;
    conversationChain: Array<{
      sender: string;
      message: string;
      timestamp?: string;
    }>;
    scamProgression: string[];
    behavioralRedFlags: string[];
    aiModels: AIModelResponse[];
    predictedNextSteps: string[];
    finalVerdict: string;
    recommendations: string[];
  }): string {
    const lines: string[] = [];

    lines.push(this.createDoubleBox('📸 SCREENSHOT CONVERSATION ANALYSIS'));
    lines.push('');
    lines.push(`OCR Quality: ${data.ocrQuality}%`);
    lines.push('');

    // Conversation Chain
    lines.push(this.createDivider());
    lines.push('CONVERSATION TIMELINE');
    lines.push(this.createDivider());
    lines.push('');

    data.conversationChain.forEach((msg, idx) => {
      const timestamp = msg.timestamp ? ` [${msg.timestamp}]` : '';
      lines.push(`${idx + 1}. ${msg.sender}${timestamp}:`);
      lines.push(`   "${msg.message}"`);
      lines.push('');
    });

    // Scam Progression
    if (data.scamProgression.length > 0) {
      lines.push(this.createDivider());
      lines.push('SCAM PROGRESSION ANALYSIS');
      lines.push(this.createDivider());
      lines.push('');

      data.scamProgression.forEach((stage, idx) => {
        lines.push(`   ${idx + 1}. ${stage}`);
      });
      lines.push('');
    }

    // Behavioral Red Flags
    if (data.behavioralRedFlags.length > 0) {
      lines.push('🚩 BEHAVIORAL RED FLAGS:');
      data.behavioralRedFlags.forEach((flag, idx) => {
        lines.push(`   ${idx + 1}. ${flag}`);
      });
      lines.push('');
    }

    // AI Model Analyses
    lines.push(this.createDivider());
    lines.push('AI CONVERSATION CONTEXT ANALYSIS');
    lines.push(this.createDivider());
    lines.push('');

    data.aiModels.forEach(model => {
      lines.push(this.createDoubleBox(`🤖 ${model.model.toUpperCase()}`));
      lines.push(model.response);
      lines.push('');
    });

    // Predicted Next Steps
    if (data.predictedNextSteps.length > 0) {
      lines.push(this.createDivider());
      lines.push('PREDICTED SCAMMER NEXT STEPS');
      lines.push(this.createDivider());
      lines.push('');

      data.predictedNextSteps.forEach((step, idx) => {
        lines.push(`   ${idx + 1}. ${step}`);
      });
      lines.push('');
    }

    // Final Verdict
    lines.push(this.createDivider());
    lines.push('FINAL VERDICT');
    lines.push(this.createDivider());
    lines.push('');
    lines.push(data.finalVerdict);
    lines.push('');

    // Recommendations
    if (data.recommendations.length > 0) {
      lines.push('ACTIONABLE ADVICE:');
      data.recommendations.forEach((rec, idx) => {
        lines.push(`   ${idx + 1}. ${rec}`);
      });
    }

    return lines.join('\n');
  }

  // Helper methods for formatting

  private static createDoubleBox(title: string): string {
    const width = Math.max(title.length + 4, 60);
    const padding = Math.floor((width - title.length - 2) / 2);
    const top = '╔' + '═'.repeat(width - 2) + '╗';
    const middle = '║' + ' '.repeat(padding) + title + ' '.repeat(width - padding - title.length - 2) + '║';
    const bottom = '╚' + '═'.repeat(width - 2) + '╝';
    return [top, middle, bottom].join('\n');
  }

  private static createSingleBox(lines: string[]): string {
    const maxWidth = Math.max(...lines.map(l => l.length), 60);
    const top = '┌' + '─'.repeat(maxWidth + 2) + '┐';
    const content = lines.map(line => '│ ' + line.padEnd(maxWidth) + ' │').join('\n');
    const bottom = '└' + '─'.repeat(maxWidth + 2) + '┘';
    return [top, content, bottom].join('\n');
  }

  private static createDivider(): string {
    return '═'.repeat(63);
  }

  private static createProgressBar(percentage: number, width: number = 50): string {
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private static createCategoryTable(categories: CategoryResult[]): string {
    const lines: string[] = [];

    lines.push('┌────────────────────────────┬───────┬─────────┬─────────────┐');
    lines.push('│ Category                   │ Score │ Max     │ Status      │');
    lines.push('├────────────────────────────┼───────┼─────────┼─────────────┤');

    categories.forEach((cat, idx) => {
      const categoryName = cat.category.padEnd(26);
      const score = cat.score.toString().padStart(5);
      const maxScore = cat.maxScore.toString().padStart(7);
      const status = this.formatCategoryStatus(cat.status, cat.score, cat.maxScore);

      lines.push(`│ ${idx + 1}. ${categoryName} │ ${score} │ ${maxScore} │ ${status.padEnd(11)} │`);
    });

    lines.push('└────────────────────────────┴───────┴─────────┴─────────────┘');

    return lines.join('\n');
  }

  private static formatRiskLevel(level: string): string {
    const levels: Record<string, string> = {
      'CRITICAL': '🔴 CRITICAL',
      'HIGH': '🟠 HIGH',
      'MEDIUM': '🟡 MEDIUM',
      'LOW': '🟢 LOW',
      'SAFE': '✅ SAFE'
    };
    return levels[level.toUpperCase()] || level;
  }

  private static formatCategoryStatus(status: string, score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;

    if (percentage >= 75) return '🔴 CRITICAL';
    if (percentage >= 50) return '🟠 HIGH';
    if (percentage >= 25) return '🟡 MEDIUM';
    return '🟢 PASS';
  }

  private static getConfidenceLabel(confidence: number): string {
    if (confidence >= 95) return 'Near certain';
    if (confidence >= 85) return 'Very high';
    if (confidence >= 70) return 'High';
    if (confidence >= 50) return 'Moderate';
    return 'Low';
  }

  private static getConsensusStatus(aiModels?: AIModelResponse[], threatIntel?: ThreatIntelSource[]): string {
    const total = (aiModels?.length || 0) + (threatIntel?.length || 0);
    // Simplified consensus - in real implementation, analyze actual verdicts
    return `${total}/${total} sources analyzed`;
  }

  private static calculateAIConsensus(models: AIModelResponse[]): { agreement: number; verdict: string } {
    const verdicts = models.map(m => m.verdict.toLowerCase());
    const maliciousCount = verdicts.filter(v => v.includes('malicious') || v.includes('phishing') || v.includes('scam')).length;

    return {
      agreement: maliciousCount,
      verdict: maliciousCount > models.length / 2 ? 'MALICIOUS' : 'SAFE'
    };
  }

  private static formatFinalVerdict(riskLevel: string, verdict: string): string {
    const icon = riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? '⛔' :
                 riskLevel === 'MEDIUM' ? '⚠️' : '✅';

    return `${icon} ${verdict}`;
  }

  private static getCriticalRecommendations(riskLevel: string): { doNot: string[]; do: string[] } {
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      return {
        doNot: [
          'Visit this URL',
          'Enter any credentials',
          'Download any files',
          'Click any links from this source',
          'Provide personal information'
        ],
        do: [
          'Delete any email containing this link',
          'Report to authorities or IT security',
          'Warn others if shared in group',
          'Block the sender',
          'Change passwords if already compromised'
        ]
      };
    } else if (riskLevel === 'MEDIUM') {
      return {
        doNot: [
          'Enter sensitive information without verification',
          'Download files without scanning',
          'Click suspicious links'
        ],
        do: [
          'Verify the source independently',
          'Check URL carefully for typos',
          'Use caution when interacting',
          'Report if suspicious'
        ]
      };
    } else {
      return {
        doNot: [
          'Assume it is completely safe',
          'Share sensitive information unnecessarily'
        ],
        do: [
          'Remain vigilant',
          'Verify sender identity',
          'Use common sense'
        ]
      };
    }
  }

  private static capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
