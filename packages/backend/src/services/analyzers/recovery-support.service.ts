import { logger } from '../../config/logger.js';

/**
 * Recovery Support Service
 * Provides guidance and resources for scam victims
 */

export interface ScamIncident {
  id?: string;
  scamType: 'romance' | 'investment' | 'tech_support' | 'phishing' | 'employment' | 'lottery' | 'advance_fee' | 'other';
  dateFirstContact: Date;
  dateOfLoss: Date;
  totalLoss: number; // USD
  paymentMethod: 'wire_transfer' | 'gift_cards' | 'cryptocurrency' | 'check' | 'cash' | 'credit_card' | 'other';
  hasEvidence: boolean;
  evidenceTypes: string[]; // screenshots, emails, recordings, documents
  reportedToPolice: boolean;
  reportedToBank: boolean;
  description: string;
  scammerContact: string; // phone, email, social media handle
}

export interface EmotionalAssessment {
  distressLevel: 'low' | 'moderate' | 'high' | 'severe';
  detectedEmotions: string[]; // shame, anger, fear, hopelessness, guilt
  suicidalIdeation: boolean; // CRITICAL: immediate crisis referral
  supportNeeded: 'basic' | 'counseling' | 'crisis_intervention';
  assessmentText: string;
}

export interface RecoveryStep {
  id: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'ongoing';
  title: string;
  instructions: string;
  timeframe: string;
  completed: boolean;
  resources?: RecoveryResource[];
  phone?: string;
  url?: string;
}

export interface RecoveryResource {
  name: string;
  type: 'reporting' | 'financial' | 'emotional' | 'legal' | 'educational';
  description: string;
  phone?: string;
  url?: string;
  available24_7?: boolean;
}

export interface RecoveryPlan {
  incidentId: string;
  steps: RecoveryStep[];
  emotionalSupport: RecoveryResource[];
  estimatedRecoveryTime: string;
  priorityActions: RecoveryStep[];
}

export class RecoverySupportService {
  /**
   * Resource directory
   */
  private readonly resources: RecoveryResource[] = [
    // Reporting Resources
    {
      name: 'FBI Internet Crime Complaint Center (IC3)',
      type: 'reporting',
      description: 'Federal reporting for internet crimes including scams and fraud',
      url: 'https://www.ic3.gov',
      available24_7: true
    },
    {
      name: 'Federal Trade Commission (FTC)',
      type: 'reporting',
      description: 'Report fraud, scams, and bad business practices',
      url: 'https://reportfraud.ftc.gov',
      available24_7: true
    },
    {
      name: 'Local Police Department',
      type: 'reporting',
      description: 'File a police report for local jurisdiction',
      phone: '911 (emergency) or local non-emergency number'
    },
    {
      name: 'Better Business Bureau Scam Tracker',
      type: 'reporting',
      description: 'Report scams and warn others',
      url: 'https://www.bbb.org/scamtracker'
    },

    // Financial Resources
    {
      name: 'Bank Fraud Department',
      type: 'financial',
      description: 'Contact your bank immediately to report fraud and potentially recover funds',
      phone: 'Number on back of your card'
    },
    {
      name: 'Equifax Fraud Alert',
      type: 'financial',
      description: 'Place fraud alert on credit report',
      phone: '1-888-766-0008',
      url: 'https://www.equifax.com/personal/credit-report-services/credit-fraud-alerts/'
    },
    {
      name: 'Experian Credit Freeze',
      type: 'financial',
      description: 'Freeze your credit to prevent new accounts',
      phone: '1-888-397-3742',
      url: 'https://www.experian.com/freeze/center.html'
    },
    {
      name: 'TransUnion Fraud Assistance',
      type: 'financial',
      description: 'Report fraud and freeze credit',
      phone: '1-800-680-7289',
      url: 'https://www.transunion.com/fraud-victim-resource-center'
    },
    {
      name: 'Consumer Financial Protection Bureau',
      type: 'financial',
      description: 'File complaint about financial institutions',
      url: 'https://www.consumerfinance.gov/complaint/'
    },

    // Emotional Support
    {
      name: 'AARP Fraud Watch Network Helpline',
      type: 'emotional',
      description: 'Support for fraud victims, volunteer fraud specialists available',
      phone: '1-877-908-3360',
      available24_7: false
    },
    {
      name: 'Crisis Text Line',
      type: 'emotional',
      description: 'Free 24/7 crisis support via text',
      phone: 'Text HOME to 741741',
      available24_7: true
    },
    {
      name: 'National Suicide Prevention Lifeline',
      type: 'emotional',
      description: 'Free, confidential support for people in distress',
      phone: '988',
      available24_7: true
    },
    {
      name: 'SAMHSA National Helpline',
      type: 'emotional',
      description: 'Mental health and substance abuse support',
      phone: '1-800-662-4357',
      available24_7: true
    },
    {
      name: 'Victim Connect Resource Center',
      type: 'emotional',
      description: 'Support and resources for crime victims',
      phone: '1-855-484-2846',
      available24_7: true
    },

    // Legal Resources
    {
      name: 'Legal Services Corporation',
      type: 'legal',
      description: 'Find free legal aid in your area',
      url: 'https://www.lsc.gov/what-legal-aid/find-legal-aid'
    },
    {
      name: 'State Attorney General',
      type: 'legal',
      description: 'Consumer protection division can help with fraud cases',
      url: 'https://www.naag.org/find-my-ag/'
    },
    {
      name: 'Identity Theft Resource Center',
      type: 'legal',
      description: 'Free assistance for identity theft victims',
      phone: '1-888-400-5530',
      url: 'https://www.idtheftcenter.org/'
    },

    // Educational Resources
    {
      name: 'FTC Scam Alerts',
      type: 'educational',
      description: 'Learn about current scams and how to avoid them',
      url: 'https://consumer.ftc.gov/scam-alerts'
    },
    {
      name: 'AARP Fraud Watch Network',
      type: 'educational',
      description: 'Education and awareness about fraud',
      url: 'https://www.aarp.org/money/scams-fraud/'
    }
  ];

  /**
   * Emotional distress keywords by severity
   */
  private readonly distressKeywords = {
    severe: [
      'kill myself', 'suicide', 'end it all', 'no point living',
      'better off dead', 'want to die', 'end my life'
    ],
    high: [
      "can't take it", 'overwhelming', 'destroyed', 'ruined my life',
      'lost everything', "can't go on", 'hopeless', 'devastated',
      'want to disappear'
    ],
    moderate: [
      'stressed', 'depressed', 'upset', 'worried', 'anxious',
      'ashamed', 'humiliated', 'embarrassed', 'scared'
    ],
    low: [
      'concerned', 'confused', 'frustrated', 'angry', 'disappointed'
    ]
  };

  /**
   * Assess emotional state from user input
   */
  assessEmotionalState(userInput: string): EmotionalAssessment {
    const inputLower = userInput.toLowerCase();
    const detectedEmotions: Set<string> = new Set();
    let distressLevel: EmotionalAssessment['distressLevel'] = 'low';
    let suicidalIdeation = false;

    // Check for suicidal ideation (CRITICAL)
    if (this.distressKeywords.severe.some(kw => inputLower.includes(kw))) {
      suicidalIdeation = true;
      distressLevel = 'severe';
      detectedEmotions.add('suicidal thoughts');
    }

    // Check for severe distress
    if (this.distressKeywords.high.some(kw => inputLower.includes(kw))) {
      if (distressLevel !== 'severe') distressLevel = 'high';
    }

    // Check for moderate distress
    if (this.distressKeywords.moderate.some(kw => inputLower.includes(kw))) {
      if (distressLevel === 'low') distressLevel = 'moderate';
    }

    // Detect specific emotions
    if (inputLower.includes('shame') || inputLower.includes('ashamed')) {
      detectedEmotions.add('shame');
    }
    if (inputLower.includes('angry') || inputLower.includes('rage')) {
      detectedEmotions.add('anger');
    }
    if (inputLower.includes('scared') || inputLower.includes('afraid')) {
      detectedEmotions.add('fear');
    }
    if (inputLower.includes('hopeless') || inputLower.includes('no hope')) {
      detectedEmotions.add('hopelessness');
    }
    if (inputLower.includes('guilty') || inputLower.includes('my fault')) {
      detectedEmotions.add('guilt');
    }

    // Determine support needed
    let supportNeeded: EmotionalAssessment['supportNeeded'] = 'basic';
    if (suicidalIdeation) {
      supportNeeded = 'crisis_intervention';
    } else if (distressLevel === 'high' || distressLevel === 'severe') {
      supportNeeded = 'counseling';
    }

    return {
      distressLevel,
      detectedEmotions: Array.from(detectedEmotions),
      suicidalIdeation,
      supportNeeded,
      assessmentText: userInput
    };
  }

  /**
   * Generate recovery plan based on incident details
   */
  generateRecoveryPlan(incident: ScamIncident, emotionalAssessment?: EmotionalAssessment): RecoveryPlan {
    const steps: RecoveryStep[] = [];

    // CRITICAL: If suicidal ideation, prioritize crisis intervention
    if (emotionalAssessment?.suicidalIdeation) {
      steps.push({
        id: 'crisis-1',
        priority: 'urgent',
        title: '🚨 GET IMMEDIATE HELP - Crisis Support',
        instructions: `You are not alone, and help is available right now. Please reach out immediately:

• Call 988 (National Suicide Prevention Lifeline) - Available 24/7
• Text HOME to 741741 (Crisis Text Line) - Available 24/7
• Call 911 if you are in immediate danger

What happened to you is NOT your fault. Scammers are professional criminals who manipulate people. Your life has value beyond this situation.`,
        timeframe: 'RIGHT NOW',
        completed: false,
        phone: '988',
        resources: this.resources.filter(r => r.type === 'emotional' && r.available24_7)
      });
    }

    // Step 1: Stop the bleeding (financial)
    if (!incident.reportedToBank) {
      const urgency = this.calculateFinancialUrgency(incident);

      steps.push({
        id: 'financial-1',
        priority: urgency,
        title: 'Contact Your Bank/Financial Institution IMMEDIATELY',
        instructions: this.getBankInstructions(incident.paymentMethod),
        timeframe: urgency === 'urgent' ? 'Within 1 hour' : 'Within 24 hours',
        completed: false,
        resources: this.resources.filter(r => r.type === 'financial' && r.name.includes('Bank'))
      });
    }

    // Step 2: Preserve evidence
    if (incident.hasEvidence) {
      steps.push({
        id: 'evidence-1',
        priority: 'high',
        title: 'Preserve All Evidence',
        instructions: `Document everything immediately:

✅ Take screenshots of ALL messages, posts, and conversations
✅ Save emails (don't just screenshot - save the actual email)
✅ Record phone numbers, email addresses, social media profiles
✅ Document dates, times, and amounts
✅ Save receipts, transaction records, wire transfer details
✅ Write down everything you remember while it's fresh
✅ Don't delete anything - even if it's embarrassing

Store everything in multiple places (cloud backup, external drive, printed copies).`,
        timeframe: 'Next 24 hours',
        completed: false
      });
    }

    // Step 3: Report to authorities
    if (!incident.reportedToPolice) {
      steps.push({
        id: 'report-1',
        priority: 'high',
        title: 'File Reports with Law Enforcement',
        instructions: `Report to multiple agencies:

1. **Local Police** - File in-person or online report
   - Bring all evidence
   - Get a copy of the police report
   - Ask for report number

2. **FBI IC3** (ic3.gov)
   - Federal database for internet crimes
   - File comprehensive complaint
   - Include all evidence

3. **FTC** (reportfraud.ftc.gov)
   - Quick online reporting
   - Helps track national trends
   - May assist in recovery efforts

Why report even if you think nothing will happen:
• Creates official record for insurance/tax purposes
• Helps law enforcement track patterns
• May help recover funds
• Protects others from same scammer`,
        timeframe: 'Within 48 hours',
        completed: false,
        resources: this.resources.filter(r => r.type === 'reporting')
      });
    }

    // Step 4: Credit protection
    steps.push({
      id: 'credit-1',
      priority: 'high',
      title: 'Protect Your Credit and Identity',
      instructions: `Take these steps to prevent further damage:

1. **Place Fraud Alert** (FREE)
   Call one credit bureau (they notify the others):
   • Equifax: 1-888-766-0008
   • Experian: 1-888-397-3742
   • TransUnion: 1-800-680-7289

2. **Consider Credit Freeze** (FREE)
   Prevents new accounts from being opened:
   • Contact all three bureaus
   • Keep PIN safe to unfreeze when needed

3. **Monitor Credit Reports**
   • Get free report: annualcreditreport.com
   • Check for unauthorized accounts
   • Dispute any fraudulent items

4. **Change Compromised Passwords**
   • Any passwords shared with scammer
   • All accounts using the same password
   • Enable 2-factor authentication`,
        timeframe: 'Within 1 week',
        completed: false,
        resources: this.resources.filter(r =>
          r.type === 'financial' && (r.name.includes('Equifax') || r.name.includes('Experian') || r.name.includes('TransUnion'))
        )
      });

    // Step 5: Emotional support
    steps.push({
      id: 'emotional-1',
      priority: 'ongoing',
      title: 'Seek Emotional Support',
      instructions: `What you're feeling is normal. Scam victims often experience:
• Shame and embarrassment
• Anger at the scammer and yourself
• Anxiety and fear
• Depression
• Isolation

**You are NOT alone. Millions fall victim to scams each year.**

Support options:
• AARP Fraud Hotline: 1-877-908-3360 (volunteers who understand)
• Crisis Text Line: Text HOME to 741741
• Victim Connect: 1-855-484-2846
• Consider professional counseling
• Join support groups for scam victims

**Remember:**
✅ This is NOT your fault - scammers are professionals
✅ You did nothing wrong - they manipulated you
✅ Your worth is not defined by this experience
✅ Recovery is possible - others have been through this`,
        timeframe: 'Ongoing',
        completed: false,
        resources: this.resources.filter(r => r.type === 'emotional')
      });

    // Step 6: Scam-specific actions
    const scamSpecificSteps = this.getScamSpecificSteps(incident);
    steps.push(...scamSpecificSteps);

    // Step 7: Learn and protect
    steps.push({
      id: 'learn-1',
      priority: 'low',
      title: 'Learn and Protect Yourself',
      instructions: `Turn this experience into protection:

1. **Educate Yourself**
   • Learn about common scams
   • Understand red flags
   • Take our Digital Literacy course

2. **Warn Others**
   • Share your story (anonymously if preferred)
   • Help friends/family recognize scams
   • Report scammer on Scam Tracker

3. **Stay Vigilant**
   • Scammers may contact you again
   • Block all scammer contacts
   • Be suspicious of "recovery" scams

4. **Plan for Future**
   • Review what made you vulnerable
   • Set up safeguards
   • Trust your instincts`,
        timeframe: 'When ready',
        completed: false,
        resources: this.resources.filter(r => r.type === 'educational')
      });

    // Identify priority actions
    const priorityActions = steps.filter(s =>
      s.priority === 'urgent' || s.priority === 'high'
    );

    // Calculate estimated recovery time
    const estimatedRecoveryTime = this.estimateRecoveryTime(incident);

    return {
      incidentId: incident.id || 'new',
      steps,
      emotionalSupport: this.resources.filter(r => r.type === 'emotional'),
      estimatedRecoveryTime,
      priorityActions
    };
  }

  /**
   * Get bank-specific instructions based on payment method
   */
  private getBankInstructions(paymentMethod: ScamIncident['paymentMethod']): string {
    switch (paymentMethod) {
      case 'wire_transfer':
        return `**URGENT: Wire transfers are hard to reverse. Act NOW.**

1. Call your bank's fraud department immediately (number on back of card)
2. Request a wire recall - you have a limited window
3. Ask for a "recall request" to be sent to receiving bank
4. File fraud claim with your bank
5. Request all transaction details
6. Ask about recovery options

Time is critical - wire transfers can be withdrawn quickly.`;

      case 'gift_cards':
        return `Gift card payments are difficult to recover, but try:

1. Contact the gift card company (iTunes, Google Play, etc.)
2. Provide card numbers and receipts
3. Request freeze on unredeemed value
4. File fraud report with card issuer
5. Some companies may refund unused portions

Important: Gift cards are scammers' favorite - legitimate businesses NEVER request gift card payments.`;

      case 'cryptocurrency':
        return `Cryptocurrency transactions are nearly impossible to reverse, but:

1. Contact the crypto exchange/wallet provider
2. Report the transaction as fraud
3. Request transaction trace if possible
4. File reports with FBI IC3 and FTC
5. Document wallet addresses involved
6. Consider blockchain analysis firms (for large amounts)

Note: Most crypto losses are unrecoverable. Focus on preventing further loss.`;

      case 'credit_card':
        return `Credit cards have strong fraud protection:

1. Call your credit card issuer immediately
2. Report charges as fraudulent
3. Request chargeback for unauthorized transactions
4. Request new card with different number
5. Review recent statements for other suspicious charges
6. You typically have 60 days to dispute charges

Credit card fraud has better recovery odds than other methods.`;

      case 'check':
        return `If you sent a check:

1. Contact your bank immediately
2. Request stop payment if check hasn't cleared
3. If cleared, file fraud claim
4. Provide copy of check and evidence
5. Request account monitoring

If you deposited a fake check:
1. Notify bank immediately
2. You may be liable for the amount
3. Don't withdraw or spend any funds
4. Cooperate fully with bank investigation`;

      default:
        return `Contact your financial institution immediately:

1. Call fraud department (number on back of card)
2. Report the fraudulent transaction
3. Request all available recovery options
4. File formal fraud claim
5. Ask for account security review
6. Request transaction details

Act quickly - early reporting improves recovery chances.`;
    }
  }

  /**
   * Calculate financial urgency
   */
  private calculateFinancialUrgency(incident: ScamIncident): RecoveryStep['priority'] {
    const hoursSinceLoss = (Date.now() - incident.dateOfLoss.getTime()) / (1000 * 60 * 60);

    if (incident.paymentMethod === 'wire_transfer' && hoursSinceLoss < 24) {
      return 'urgent'; // Wire recalls have very limited window
    }

    if (hoursSinceLoss < 48) {
      return 'high'; // First 48 hours critical for any recovery
    }

    return 'medium';
  }

  /**
   * Get scam-specific recovery steps
   */
  private getScamSpecificSteps(incident: ScamIncident): RecoveryStep[] {
    const steps: RecoveryStep[] = [];

    switch (incident.scamType) {
      case 'romance':
        steps.push({
          id: 'romance-1',
          priority: 'medium',
          title: 'Romance Scam Specific Actions',
          instructions: `Additional steps for romance scams:

• Report dating site/app used
• Report fake profiles to platform
• Do reverse image search on scammer photos
• Block on all platforms and phone
• Be aware: scammer may try to reconnect
• Consider professional counseling - emotional impact is real
• Join romance scam survivor support groups

Remember: The person you thought you knew never existed. Your feelings were real, but they were manipulated.`,
          timeframe: 'Next week',
          completed: false
        });
        break;

      case 'investment':
        steps.push({
          id: 'investment-1',
          priority: 'high',
          title: 'Investment Scam Specific Actions',
          instructions: `Additional steps for investment scams:

• Report to SEC (sec.gov/tcr)
• Report to FINRA if securities involved
• Report to CFTC if commodities/forex
• Check if firm is registered (brokercheck.finra.org)
• File complaint with state securities regulator
• Consult securities attorney for recovery options
• Review tax implications with accountant

Large losses may be tax deductible as theft losses.`,
          timeframe: 'Within 1 week',
          completed: false,
          url: 'https://www.sec.gov/tcr'
        });
        break;

      case 'tech_support':
        steps.push({
          id: 'tech-1',
          priority: 'urgent',
          title: 'Tech Support Scam Specific Actions',
          instructions: `IMMEDIATE actions for tech support scams:

1. **Disconnect from Internet**
2. **Run full antivirus/antimalware scan**
3. **Change ALL passwords** (from different device)
4. **Check for remote access software** (TeamViewer, AnyDesk, etc.) and uninstall
5. **Review bank/credit card statements** for unauthorized charges
6. **Consider professional PC cleanup**
7. **Check for installed malware or keyloggers**

If they had remote access, assume everything on your computer was compromised.`,
          timeframe: 'Immediately',
          completed: false
        });
        break;
    }

    return steps;
  }

  /**
   * Estimate recovery time based on incident
   */
  private estimateRecoveryTime(incident: ScamIncident): string {
    const amount = incident.totalLoss;

    if (incident.scamType === 'romance') {
      return '3-12 months (emotional recovery may take longer)';
    }

    if (amount > 100000) {
      return '6-18 months (large losses require legal action)';
    }

    if (amount > 10000) {
      return '3-9 months (moderate recovery complexity)';
    }

    return '1-3 months (smaller losses, faster recovery)';
  }

  /**
   * Get resources by type
   */
  getResourcesByType(type: RecoveryResource['type']): RecoveryResource[] {
    return this.resources.filter(r => r.type === type);
  }

  /**
   * Get all resources
   */
  getAllResources(): RecoveryResource[] {
    return this.resources;
  }

  /**
   * Create follow-up check-in
   */
  generateFollowUp(daysSinceIncident: number): {
    message: string;
    resources: RecoveryResource[];
    nextCheckIn: number; // days
  } {
    if (daysSinceIncident === 1) {
      return {
        message: `It's been 24 hours since you reported the incident. How are you doing?

✅ Have you contacted your bank?
✅ Have you filed police reports?
✅ Have you preserved all evidence?

Remember: You are not alone. Reach out if you need support.`,
        resources: this.resources.filter(r => r.type === 'emotional'),
        nextCheckIn: 7
      };
    }

    if (daysSinceIncident === 7) {
      return {
        message: `It's been one week. This is a difficult time, but you're taking the right steps.

Progress check:
• Financial recovery steps underway?
• Reports filed with all agencies?
• Credit protection in place?
• Support system engaged?

How are you feeling emotionally? It's normal to have ups and downs.`,
        resources: this.resources.filter(r => r.type === 'emotional' || r.type === 'legal'),
        nextCheckIn: 30
      };
    }

    if (daysSinceIncident === 30) {
      return {
        message: `One month milestone. You've shown strength in handling this.

Reflection:
• What recovery progress has been made?
• What lessons have you learned?
• How can you protect yourself going forward?
• Are you ready to help others recognize scams?

Consider sharing your story to help others (anonymously if preferred).`,
        resources: this.resources.filter(r => r.type === 'educational'),
        nextCheckIn: 90
      };
    }

    return {
      message: `Checking in. Recovery is a journey, not a destination.

You've come far from where you started. Focus on:
• Continued emotional healing
• Applying lessons learned
• Helping others avoid scams
• Moving forward with confidence

You are stronger than you think.`,
      resources: this.resources.filter(r => r.type === 'educational'),
      nextCheckIn: 180
    };
  }
}

export const recoverySupportService = new RecoverySupportService();
