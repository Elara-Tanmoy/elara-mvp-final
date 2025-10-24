import { logger } from '../../config/logger.js';

interface ParsedMessage {
  timestamp: string;
  sender: string;
  content: string;
  confidence: number;
}

interface ConversationMetadata {
  platform: string;
  totalMessages: number;
  conversationSpan: {
    start: Date | null;
    end: Date | null;
    durationDays: number;
  };
  participants: {
    name: string;
    isUser: boolean;
    hasProfilePic: boolean;
    phoneNumber?: string;
  }[];
}

interface ConversationChain {
  messages: ParsedMessage[];
  metadata: ConversationMetadata;
  redFlags: string[];
  timeline: {
    day: number;
    phase: string;
    messages: ParsedMessage[];
  }[];
}

export class ConversationParserService {
  /**
   * Parse extracted OCR text into structured conversation
   */
  parseConversation(extractedText: string, metadata: any = {}): ConversationChain {
    const messages = this.extractMessages(extractedText);
    const conversationMeta = this.buildMetadata(messages, metadata);
    const timeline = this.buildTimeline(messages);
    const redFlags = this.identifyRedFlags(messages);

    return {
      messages,
      metadata: conversationMeta,
      redFlags,
      timeline
    };
  }

  /**
   * Extract individual messages from OCR text
   */
  private extractMessages(text: string): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    // Common timestamp patterns
    const timestampPatterns = [
      /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/,
      /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/,
      /(Yesterday|Today|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun))/i,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))/i
    ];

    // Common sender patterns for different messaging apps
    const senderPatterns = [
      /^([A-Z][a-zA-Z\s]+):/,  // "John Doe:"
      /^\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,  // Phone numbers
      /^~([^~]+)~/,  // "~SenderName~"
      /^([A-Za-z0-9]+)\s*>/,  // "Sender >"
    ];

    let currentSender = 'Unknown';
    let currentTimestamp = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Try to extract timestamp
      for (const pattern of timestampPatterns) {
        const match = line.match(pattern);
        if (match) {
          currentTimestamp = match[1];
          break;
        }
      }

      // Try to extract sender
      for (const pattern of senderPatterns) {
        const match = line.match(pattern);
        if (match) {
          currentSender = match[1] || match[0];
          break;
        }
      }

      // Check if this line looks like a message (not UI element)
      if (this.isMessageContent(line)) {
        const cleanedContent = this.cleanMessageContent(line);

        if (cleanedContent.length > 0) {
          messages.push({
            timestamp: currentTimestamp || `Message ${messages.length + 1}`,
            sender: currentSender,
            content: cleanedContent,
            confidence: this.calculateConfidence(line)
          });
        }
      }
    }

    return messages;
  }

  /**
   * Check if line is likely message content
   */
  private isMessageContent(line: string): boolean {
    // Filter out UI elements, app names, status messages
    const uiKeywords = [
      'whatsapp', 'telegram', 'messenger', 'signal', 'imessage',
      'typing...', 'online', 'offline', 'last seen', 'read',
      'delivered', 'sent', 'view profile', 'call', 'video call',
      'attachment', 'photo', 'video', 'audio', 'location',
      'contact', 'document', 'sticker', 'gif'
    ];

    const lowerLine = line.toLowerCase();

    // Must have minimum length
    if (line.length < 3) return false;

    // Check if it's a UI element
    if (uiKeywords.some(keyword => lowerLine.includes(keyword))) {
      return false;
    }

    // Should contain some alphanumeric content
    if (!/[a-zA-Z0-9]{2,}/.test(line)) return false;

    return true;
  }

  /**
   * Clean message content from OCR artifacts
   */
  private cleanMessageContent(content: string): string {
    // Remove timestamp prefixes
    content = content.replace(/^\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*/, '');

    // Remove sender prefixes
    content = content.replace(/^[A-Z][a-zA-Z\s]+:\s*/, '');
    content = content.replace(/^\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\s*/, '');

    // Remove common OCR errors
    content = content.replace(/[|]{2,}/g, '');
    content = content.replace(/_{3,}/g, '');

    return content.trim();
  }

  /**
   * Calculate confidence score for extracted message
   */
  private calculateConfidence(text: string): number {
    let confidence = 70; // Base confidence

    // Higher confidence for longer messages
    if (text.length > 50) confidence += 10;

    // Higher confidence for properly formed sentences
    if (/[.!?]$/.test(text)) confidence += 5;

    // Lower confidence for messages with many special characters
    const specialCharRatio = (text.match(/[^a-zA-Z0-9\s.,!?]/g) || []).length / text.length;
    if (specialCharRatio > 0.3) confidence -= 20;

    return Math.min(Math.max(confidence, 0), 100);
  }

  /**
   * Build conversation metadata
   */
  private buildMetadata(messages: ParsedMessage[], providedMetadata: any): ConversationMetadata {
    const uniqueSenders = Array.from(new Set(messages.map(m => m.sender)));
    const timestamps = this.extractValidTimestamps(messages);

    return {
      platform: providedMetadata.platform || this.detectPlatform(messages),
      totalMessages: messages.length,
      conversationSpan: {
        start: timestamps.length > 0 ? new Date(timestamps[0]) : null,
        end: timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]) : null,
        durationDays: this.calculateDuration(timestamps)
      },
      participants: uniqueSenders.map(sender => ({
        name: sender,
        isUser: providedMetadata.userIdentifier ? sender === providedMetadata.userIdentifier : false,
        hasProfilePic: false,
        phoneNumber: this.isPhoneNumber(sender) ? sender : undefined
      }))
    };
  }

  /**
   * Detect messaging platform from conversation patterns
   */
  private detectPlatform(messages: ParsedMessage[]): string {
    const allText = messages.map(m => m.content + ' ' + m.sender).join(' ').toLowerCase();

    if (allText.includes('whatsapp')) return 'WhatsApp';
    if (allText.includes('telegram')) return 'Telegram';
    if (allText.includes('messenger')) return 'Facebook Messenger';
    if (allText.includes('signal')) return 'Signal';
    if (allText.includes('imessage')) return 'iMessage';

    return 'Unknown Platform';
  }

  /**
   * Extract valid timestamps
   */
  private extractValidTimestamps(messages: ParsedMessage[]): string[] {
    return messages
      .map(m => m.timestamp)
      .filter(ts => {
        // Try to parse as date
        const parsed = new Date(ts);
        return !isNaN(parsed.getTime());
      });
  }

  /**
   * Calculate conversation duration in days
   */
  private calculateDuration(timestamps: string[]): number {
    if (timestamps.length < 2) return 0;

    const start = new Date(timestamps[0]);
    const end = new Date(timestamps[timestamps.length - 1]);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Check if string is phone number
   */
  private isPhoneNumber(str: string): boolean {
    return /^\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(str);
  }

  /**
   * Build conversation timeline
   */
  private buildTimeline(messages: ParsedMessage[]): any[] {
    if (messages.length === 0) return [];

    // Group messages by day/phase
    const timeline: any[] = [];
    let currentDay = 1;
    let dayMessages: ParsedMessage[] = [];

    messages.forEach((message, index) => {
      dayMessages.push(message);

      // New day if significant time gap or every 5-10 messages
      if (index > 0 && (index % 8 === 0 || this.hasTimeGap(messages[index - 1], message))) {
        timeline.push({
          day: currentDay,
          phase: this.identifyPhase(dayMessages),
          messages: [...dayMessages]
        });
        dayMessages = [];
        currentDay++;
      }
    });

    // Add remaining messages
    if (dayMessages.length > 0) {
      timeline.push({
        day: currentDay,
        phase: this.identifyPhase(dayMessages),
        messages: dayMessages
      });
    }

    return timeline;
  }

  /**
   * Check if there's a significant time gap between messages
   */
  private hasTimeGap(msg1: ParsedMessage, msg2: ParsedMessage): boolean {
    // Simple heuristic: check if timestamp changed significantly
    return msg1.timestamp !== msg2.timestamp;
  }

  /**
   * Identify conversation phase
   */
  private identifyPhase(messages: ParsedMessage[]): string {
    const allText = messages.map(m => m.content).join(' ').toLowerCase();

    // Trust building phase keywords
    if (allText.match(/hi|hello|how are you|nice to meet|remember|conference|met at|know you from/i)) {
      return 'Trust Building';
    }

    // Opportunity introduction
    if (allText.match(/opportunity|investment|money|earn|profit|offer|deal|business/i)) {
      return 'Opportunity Introduction';
    }

    // Urgency/pressure phase
    if (allText.match(/urgent|now|today|expires|limited|hurry|quick|immediately|last chance/i)) {
      return 'Pressure & Urgency';
    }

    // Payment request
    if (allText.match(/send|payment|bitcoin|crypto|wallet|transfer|bank|card|gift card/i)) {
      return 'Payment Request';
    }

    return 'General Conversation';
  }

  /**
   * Identify conversation red flags
   */
  private identifyRedFlags(messages: ParsedMessage[]): string[] {
    const redFlags: string[] = [];
    const allText = messages.map(m => m.content).join(' ');

    // False familiarity
    if (allText.match(/remember me|we met|you know me|from the (conference|event|meeting)/i)) {
      redFlags.push('Claims false familiarity or previous meeting');
    }

    // Too good to be true
    if (allText.match(/\$\d{3,}|guaranteed|easy money|no risk|100% return/i)) {
      redFlags.push('Too-good-to-be-true financial promises');
    }

    // Urgency pressure
    if (allText.match(/urgent|expires? (today|now)|limited time|act now|hurry/i)) {
      redFlags.push('Creates false urgency and time pressure');
    }

    // Cryptocurrency/untraceable payment
    if (allText.match(/bitcoin|crypto|wallet address|send to address/i)) {
      redFlags.push('Requests cryptocurrency (untraceable payment)');
    }

    // Moving off platform
    if (allText.match(/text me|call me|email me|switch to|move to|download|install/i)) {
      redFlags.push('Attempts to move conversation off-platform');
    }

    // Avoiding verification
    if (allText.match(/no (video|call|meet)|can't (video|call)|camera (broken|doesn't work)/i)) {
      redFlags.push('Avoids video calls or identity verification');
    }

    // Authority impersonation
    if (allText.match(/\b(IRS|FBI|police|bank|microsoft|apple|amazon|government|official)\b/i)) {
      redFlags.push('May be impersonating authority or legitimate organization');
    }

    // Information harvesting
    if (allText.match(/social security|SSN|password|PIN|account number|routing number|mother's maiden/i)) {
      redFlags.push('Requests sensitive personal or financial information');
    }

    return redFlags;
  }

  /**
   * Analyze conversation progression for scam patterns
   */
  analyzeProgression(chain: ConversationChain): {
    isTypicalScamProgression: boolean;
    progressionType: string;
    confidence: number;
    explanation: string;
  } {
    if (chain.timeline.length < 2) {
      return {
        isTypicalScamProgression: false,
        progressionType: 'Insufficient data',
        confidence: 0,
        explanation: 'Not enough messages to determine pattern'
      };
    }

    const phases = chain.timeline.map(t => t.phase);

    // Romance scam progression
    if (phases.includes('Trust Building') && phases.some(p => p.includes('Opportunity') || p.includes('Payment'))) {
      return {
        isTypicalScamProgression: true,
        progressionType: 'Romance/Investment Scam',
        confidence: 85,
        explanation: 'Conversation follows typical scam pattern: builds trust first, then introduces financial element'
      };
    }

    // Advance-fee scam
    if (phases.includes('Opportunity Introduction') && phases.includes('Payment Request')) {
      return {
        isTypicalScamProgression: true,
        progressionType: 'Advance-Fee Scam',
        confidence: 90,
        explanation: 'Classic advance-fee scam: promises opportunity/returns but requires upfront payment'
      };
    }

    // Phishing/impersonation
    if (chain.redFlags.some(flag => flag.includes('impersonating'))) {
      return {
        isTypicalScamProgression: true,
        progressionType: 'Phishing/Impersonation',
        confidence: 80,
        explanation: 'Impersonates legitimate entity to extract information or money'
      };
    }

    return {
      isTypicalScamProgression: false,
      progressionType: 'Unknown',
      confidence: 50,
      explanation: 'Pattern does not match known scam types, but remain cautious'
    };
  }
}

export const conversationParserService = new ConversationParserService();
