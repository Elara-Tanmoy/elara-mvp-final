/**
 * THREAT INTELLIGENCE TO KNOWLEDGE BASE SERVICE
 *
 * Populates the chatbot's knowledge base with threat intelligence data
 * from PhishTank, URLhaus, OpenPhish, MalwareBazaar, and ThreatFox
 *
 * This allows the chatbot to provide accurate, real-time threat information
 * when users ask about specific URLs, domains, or malware.
 */

import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { knowledgeBaseService } from './knowledge-base.service.js';

export class ThreatIntelToKnowledgeService {
  /**
   * Populate knowledge base with ALL threat intelligence data
   */
  async populateFromThreatIntel(): Promise<{
    totalProcessed: number;
    added: number;
    failed: number;
  }> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let added = 0;
    let failed = 0;

    try {
      logger.info('[Threat Intel → Knowledge] Starting population...');

      // Fetch all active threat indicators
      const indicators = await prisma.threatIndicator.findMany({
        where: {
          active: true
        },
        include: {
          source: {
            select: {
              name: true,
              type: true,
              description: true
            }
          }
        },
        orderBy: {
          lastSeen: 'desc'
        }
      });

      logger.info(`[Threat Intel → Knowledge] Found ${indicators.length} threat indicators`);

      // Process in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < indicators.length; i += batchSize) {
        const batch = indicators.slice(i, i + batchSize);

        for (const indicator of batch) {
          try {
            const knowledgeEntry = this.convertToKnowledgeEntry(indicator);

            await knowledgeBaseService.addKnowledge({
              title: knowledgeEntry.title,
              content: knowledgeEntry.content,
              contentType: 'threat_intelligence',
              source: indicator.source?.name || 'Unknown',
              category: 'Threat Intelligence',
              metadata: {
                indicatorId: indicator.id,
                type: indicator.type,
                threatType: indicator.threatType,
                severity: indicator.severity,
                confidence: indicator.confidence,
                tags: indicator.tags,
                firstSeen: indicator.firstSeen,
                lastSeen: indicator.lastSeen,
                sourceType: indicator.source?.type
              },
              userId: 'system'
            });

            added++;
            totalProcessed++;
          } catch (error) {
            logger.error(`[Threat Intel → Knowledge] Failed to add indicator ${indicator.id}:`, error);
            failed++;
            totalProcessed++;
          }
        }

        // Log progress every batch
        logger.info(
          `[Threat Intel → Knowledge] Progress: ${totalProcessed}/${indicators.length} (${added} added, ${failed} failed)`
        );
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(
        `[Threat Intel → Knowledge] ✅ Completed in ${duration}s: ${added} added, ${failed} failed`
      );

      return {
        totalProcessed,
        added,
        failed
      };
    } catch (error) {
      logger.error('[Threat Intel → Knowledge] Population failed:', error);
      throw error;
    }
  }

  /**
   * Populate knowledge base with recent threats (last 30 days)
   */
  async populateRecentThreats(days: number = 30): Promise<{
    totalProcessed: number;
    added: number;
    failed: number;
  }> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let added = 0;
    let failed = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      logger.info(`[Threat Intel → Knowledge] Fetching threats from last ${days} days...`);

      const indicators = await prisma.threatIndicator.findMany({
        where: {
          active: true,
          lastSeen: {
            gte: cutoffDate
          }
        },
        include: {
          source: {
            select: {
              name: true,
              type: true,
              description: true
            }
          }
        },
        orderBy: {
          lastSeen: 'desc'
        }
      });

      logger.info(`[Threat Intel → Knowledge] Found ${indicators.length} recent threat indicators`);

      for (const indicator of indicators) {
        try {
          const knowledgeEntry = this.convertToKnowledgeEntry(indicator);

          await knowledgeBaseService.addKnowledge({
            title: knowledgeEntry.title,
            content: knowledgeEntry.content,
            contentType: 'threat_intelligence',
            source: indicator.source?.name || 'Unknown',
            category: 'Threat Intelligence',
            metadata: {
              indicatorId: indicator.id,
              type: indicator.type,
              threatType: indicator.threatType,
              severity: indicator.severity,
              confidence: indicator.confidence,
              tags: indicator.tags,
              firstSeen: indicator.firstSeen,
              lastSeen: indicator.lastSeen,
              sourceType: indicator.source?.type
            },
            userId: 'system'
          });

          added++;
          totalProcessed++;
        } catch (error) {
          logger.error(`[Threat Intel → Knowledge] Failed to add indicator ${indicator.id}:`, error);
          failed++;
          totalProcessed++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(
        `[Threat Intel → Knowledge] ✅ Completed in ${duration}s: ${added} added, ${failed} failed`
      );

      return {
        totalProcessed,
        added,
        failed
      };
    } catch (error) {
      logger.error('[Threat Intel → Knowledge] Recent population failed:', error);
      throw error;
    }
  }

  /**
   * Populate knowledge base with high-severity threats only
   */
  async populateHighSeverityThreats(): Promise<{
    totalProcessed: number;
    added: number;
    failed: number;
  }> {
    const startTime = Date.now();
    let totalProcessed = 0;
    let added = 0;
    let failed = 0;

    try {
      logger.info('[Threat Intel → Knowledge] Fetching high-severity threats...');

      const indicators = await prisma.threatIndicator.findMany({
        where: {
          active: true,
          severity: {
            in: ['critical', 'high']
          }
        },
        include: {
          source: {
            select: {
              name: true,
              type: true,
              description: true
            }
          }
        },
        orderBy: {
          lastSeen: 'desc'
        }
      });

      logger.info(`[Threat Intel → Knowledge] Found ${indicators.length} high-severity threats`);

      for (const indicator of indicators) {
        try {
          const knowledgeEntry = this.convertToKnowledgeEntry(indicator);

          await knowledgeBaseService.addKnowledge({
            title: knowledgeEntry.title,
            content: knowledgeEntry.content,
            contentType: 'threat_intelligence',
            source: indicator.source?.name || 'Unknown',
            category: 'Threat Intelligence',
            metadata: {
              indicatorId: indicator.id,
              type: indicator.type,
              threatType: indicator.threatType,
              severity: indicator.severity,
              confidence: indicator.confidence,
              tags: indicator.tags,
              firstSeen: indicator.firstSeen,
              lastSeen: indicator.lastSeen,
              sourceType: indicator.source?.type
            },
            userId: 'system'
          });

          added++;
          totalProcessed++;
        } catch (error) {
          logger.error(`[Threat Intel → Knowledge] Failed to add indicator ${indicator.id}:`, error);
          failed++;
          totalProcessed++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(
        `[Threat Intel → Knowledge] ✅ Completed in ${duration}s: ${added} added, ${failed} failed`
      );

      return {
        totalProcessed,
        added,
        failed
      };
    } catch (error) {
      logger.error('[Threat Intel → Knowledge] High-severity population failed:', error);
      throw error;
    }
  }

  /**
   * Convert threat indicator to knowledge base entry
   */
  private convertToKnowledgeEntry(indicator: any): {
    title: string;
    content: string;
  } {
    const sourceName = indicator.source?.name || 'Unknown Source';
    const typeLabel = this.getTypeLabel(indicator.type);
    const severityLabel = this.getSeverityLabel(indicator.severity);
    const threatTypeLabel = this.getThreatTypeLabel(indicator.threatType);

    // Create descriptive title
    const title = `${severityLabel} ${threatTypeLabel} - ${typeLabel}: ${this.truncateValue(indicator.value)}`;

    // Create detailed content for RAG
    const content = this.buildThreatDescription(indicator, sourceName);

    return {
      title,
      content
    };
  }

  /**
   * Build detailed threat description for RAG context
   */
  private buildThreatDescription(indicator: any, sourceName: string): string {
    const parts: string[] = [];

    // Header
    parts.push(`⚠️ THREAT INDICATOR: ${indicator.value}`);
    parts.push('');

    // Basic info
    parts.push(`TYPE: ${this.getTypeLabel(indicator.type)}`);
    parts.push(`THREAT TYPE: ${this.getThreatTypeLabel(indicator.threatType)}`);
    parts.push(`SEVERITY: ${this.getSeverityLabel(indicator.severity)}`);
    parts.push(`CONFIDENCE: ${indicator.confidence}%`);
    parts.push(`SOURCE: ${sourceName}`);
    parts.push('');

    // Description
    if (indicator.description) {
      parts.push(`DESCRIPTION: ${indicator.description}`);
      parts.push('');
    }

    // Tags
    if (indicator.tags && indicator.tags.length > 0) {
      parts.push(`TAGS: ${indicator.tags.join(', ')}`);
      parts.push('');
    }

    // Timeline
    if (indicator.firstSeen) {
      parts.push(`FIRST SEEN: ${new Date(indicator.firstSeen).toISOString().split('T')[0]}`);
    }
    if (indicator.lastSeen) {
      parts.push(`LAST SEEN: ${new Date(indicator.lastSeen).toISOString().split('T')[0]}`);
    }
    parts.push('');

    // Metadata
    if (indicator.metadata && Object.keys(indicator.metadata).length > 0) {
      parts.push('ADDITIONAL DETAILS:');
      for (const [key, value] of Object.entries(indicator.metadata)) {
        if (value && typeof value !== 'object') {
          parts.push(`- ${key}: ${value}`);
        }
      }
      parts.push('');
    }

    // Safety recommendations
    parts.push('⚠️ SAFETY RECOMMENDATIONS:');
    if (indicator.type === 'url') {
      parts.push('- DO NOT visit this URL');
      parts.push('- DO NOT click links to this domain');
      parts.push('- Report if received via email or message');
      parts.push('- Warn others if this link was shared');
    } else if (indicator.type === 'hash') {
      parts.push('- DO NOT execute files with this hash');
      parts.push('- Delete immediately if found on your system');
      parts.push('- Run a full antivirus scan');
      parts.push('- Report to your IT security team');
    } else if (indicator.type === 'domain') {
      parts.push('- DO NOT visit this domain');
      parts.push('- Block this domain in your firewall/DNS');
      parts.push('- Report suspicious emails from this domain');
    } else if (indicator.type === 'ip') {
      parts.push('- Block this IP address in your firewall');
      parts.push('- Monitor for connections to this IP');
      parts.push('- Report to your network administrator');
    }

    return parts.join('\n');
  }

  /**
   * Get human-readable type label
   */
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      url: 'Malicious URL',
      domain: 'Malicious Domain',
      ip: 'Malicious IP Address',
      hash: 'Malware Hash',
      email: 'Malicious Email',
      other: 'Threat Indicator'
    };
    return labels[type] || type.toUpperCase();
  }

  /**
   * Get human-readable severity label
   */
  private getSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      critical: '🔴 CRITICAL',
      high: '🟠 HIGH',
      medium: '🟡 MEDIUM',
      low: '🟢 LOW'
    };
    return labels[severity] || severity.toUpperCase();
  }

  /**
   * Get human-readable threat type label
   */
  private getThreatTypeLabel(threatType: string): string {
    const labels: Record<string, string> = {
      phishing: 'Phishing Attack',
      malware: 'Malware',
      c2: 'Command & Control Server',
      ransomware: 'Ransomware',
      trojan: 'Trojan',
      botnet: 'Botnet',
      spam: 'Spam/Malicious Email',
      exploit: 'Exploit Kit'
    };
    return labels[threatType] || threatType;
  }

  /**
   * Truncate long values for title
   */
  private truncateValue(value: string, maxLength: number = 80): string {
    if (value.length <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get population statistics
   */
  async getPopulationStats(): Promise<{
    totalThreatIndicators: number;
    totalKnowledgeEntries: number;
    threatIntelKnowledgeEntries: number;
    lastPopulated: Date | null;
  }> {
    try {
      const [totalThreatIndicators, totalKnowledgeEntries, threatIntelEntries] = await Promise.all([
        prisma.threatIndicator.count({ where: { active: true } }),
        prisma.knowledgeBase.count({ where: { indexed: true } }),
        prisma.knowledgeBase.count({
          where: {
            indexed: true,
            contentType: 'threat_intelligence'
          }
        })
      ]);

      const lastEntry = await prisma.knowledgeBase.findFirst({
        where: {
          contentType: 'threat_intelligence'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          createdAt: true
        }
      });

      return {
        totalThreatIndicators,
        totalKnowledgeEntries,
        threatIntelKnowledgeEntries: threatIntelEntries,
        lastPopulated: lastEntry?.createdAt || null
      };
    } catch (error) {
      logger.error('[Threat Intel → Knowledge] Failed to get stats:', error);
      throw error;
    }
  }

  /**
   * Clear all threat intelligence entries from knowledge base
   */
  async clearThreatIntelKnowledge(): Promise<number> {
    try {
      logger.info('[Threat Intel → Knowledge] Clearing threat intelligence knowledge...');

      const result = await prisma.knowledgeBase.deleteMany({
        where: {
          contentType: 'threat_intelligence'
        }
      });

      logger.info(`[Threat Intel → Knowledge] ✅ Cleared ${result.count} entries`);
      return result.count;
    } catch (error) {
      logger.error('[Threat Intel → Knowledge] Failed to clear:', error);
      throw error;
    }
  }
}

export const threatIntelToKnowledgeService = new ThreatIntelToKnowledgeService();
