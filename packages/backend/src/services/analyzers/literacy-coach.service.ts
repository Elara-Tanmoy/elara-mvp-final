import { logger } from '../../config/logger.js';

/**
 * Digital Literacy Coach Service
 * Provides security awareness training and assessment
 */

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'phishing' | 'passwords' | 'social_engineering' | 'malware' | 'privacy';
  explanation: string;
}

export interface QuizResult {
  score: number; // 0-100
  totalQuestions: number;
  correctAnswers: number;
  literacyLevel: 'beginner' | 'intermediate' | 'advanced';
  knowledgeGaps: string[];
  strengths: string[];
  timeTaken: number; // seconds
}

export interface Lesson {
  id: string;
  title: string;
  content: string; // Markdown format
  duration: number; // minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  quiz: QuizQuestion[];
  resources: Resource[];
  priority: number;
}

export interface Resource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'interactive' | 'tool';
  duration?: number;
}

export interface LearningPath {
  lessons: Lesson[];
  estimatedTime: number; // minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  completionRate: number; // 0-100
}

export interface LearningProgress {
  userId: string;
  lessonsCompleted: number;
  totalLessons: number;
  averageQuizScore: number;
  timeSpent: number; // minutes
  comprehensionGrowth: number[]; // Quiz scores over time
  behavioralImprovement: {
    scamsAvoided: number;
    detectionAccuracyChange: number;
  };
  lastActivity: Date;
}

export class LiteracyCoachService {
  /**
   * Security awareness quiz database
   */
  private readonly quizQuestions: QuizQuestion[] = [
    // Phishing Detection
    {
      id: 'q1',
      question: 'You receive an urgent email from your "bank" asking you to verify your account. What should you do?',
      options: [
        'Click the link and enter your information immediately',
        'Call the bank using the number on their official website',
        'Reply to the email asking for more information',
        'Forward it to friends to ask their opinion'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'phishing',
      explanation: 'Always verify urgent requests by contacting the organization through official channels, not links in emails. Banks never ask for account verification via email.'
    },
    {
      id: 'q2',
      question: 'What is a common sign of a phishing email?',
      options: [
        'Perfect grammar and spelling',
        'Urgent language and threats of account closure',
        'Personalized greeting with your full name',
        'Email from a known company domain'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'phishing',
      explanation: 'Phishing emails often use urgency and fear tactics to pressure you into acting quickly without thinking.'
    },
    {
      id: 'q3',
      question: 'Which of these email addresses is most likely legitimate for Amazon?',
      options: [
        'support@amazon-security.com',
        'no-reply@amazon.com',
        'amazon-support@gmail.com',
        'verify@amaz0n.com'
      ],
      correctAnswer: 1,
      difficulty: 'intermediate',
      category: 'phishing',
      explanation: 'Legitimate Amazon emails come from @amazon.com domain. Look-alike domains (amazon-security, amaz0n) are red flags.'
    },

    // Password Security
    {
      id: 'q4',
      question: 'What makes a password strong?',
      options: [
        'Using your birthday and name',
        'A mix of uppercase, lowercase, numbers, and symbols',
        'A common word with a number at the end',
        'Your pet\'s name'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'passwords',
      explanation: 'Strong passwords are long (12+ characters) and use a mix of character types. Avoid personal information and common words.'
    },
    {
      id: 'q5',
      question: 'How often should you reuse the same password across different accounts?',
      options: [
        'Always - it\'s easier to remember',
        'Only for unimportant accounts',
        'Never - each account should have a unique password',
        'Only for accounts from the same company'
      ],
      correctAnswer: 2,
      difficulty: 'beginner',
      category: 'passwords',
      explanation: 'Never reuse passwords. If one account is breached, all accounts with the same password are at risk.'
    },
    {
      id: 'q6',
      question: 'What is the safest way to manage multiple passwords?',
      options: [
        'Write them in a notebook',
        'Use a password manager',
        'Use the same password for everything',
        'Save them in a Word document'
      ],
      correctAnswer: 1,
      difficulty: 'intermediate',
      category: 'passwords',
      explanation: 'Password managers securely encrypt and store all your passwords, requiring you to remember only one master password.'
    },

    // Social Engineering
    {
      id: 'q7',
      question: 'Someone calls claiming to be from IT support and asks for your password. What should you do?',
      options: [
        'Give them your password since they\'re from IT',
        'Hang up and call IT through official channels',
        'Give them a fake password to test if they\'re real',
        'Ask them to prove who they are by telling you your password'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'social_engineering',
      explanation: 'Legitimate IT staff never ask for your password. Hang up and verify through official channels.'
    },
    {
      id: 'q8',
      question: 'What is "pretexting" in social engineering?',
      options: [
        'Sending text messages to scam victims',
        'Creating a fabricated scenario to trick someone',
        'Testing security systems',
        'Pre-writing email templates'
      ],
      correctAnswer: 1,
      difficulty: 'intermediate',
      category: 'social_engineering',
      explanation: 'Pretexting is when attackers create fake scenarios (like pretending to be IT support) to gain trust and extract information.'
    },

    // Malware Awareness
    {
      id: 'q9',
      question: 'You downloaded a file and your antivirus flagged it. What should you do?',
      options: [
        'Disable antivirus and open the file',
        'Delete the file and scan your system',
        'Open the file to see what happens',
        'Upload it to social media to ask if it\'s safe'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'malware',
      explanation: 'Always trust your antivirus warnings. Delete suspicious files and run a full system scan.'
    },
    {
      id: 'q10',
      question: 'What is ransomware?',
      options: [
        'Software that encrypts your files and demands payment',
        'A type of advertising software',
        'A legitimate security tool',
        'A free antivirus program'
      ],
      correctAnswer: 0,
      difficulty: 'intermediate',
      category: 'malware',
      explanation: 'Ransomware locks your files and demands payment (usually cryptocurrency) to unlock them. Never pay - it doesn\'t guarantee recovery.'
    },

    // Privacy Protection
    {
      id: 'q11',
      question: 'What should you do before posting vacation photos on social media?',
      options: [
        'Post them immediately to share the excitement',
        'Wait until you return home',
        'Tag your location so friends know where you are',
        'Include your home address in the caption'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'privacy',
      explanation: 'Posting real-time vacation updates tells criminals your home is empty. Wait until you return.'
    },
    {
      id: 'q12',
      question: 'What is two-factor authentication (2FA)?',
      options: [
        'Using two different passwords',
        'Logging in twice',
        'Requiring a password and a second verification method',
        'Having two user accounts'
      ],
      correctAnswer: 2,
      difficulty: 'intermediate',
      category: 'privacy',
      explanation: '2FA requires both something you know (password) and something you have (phone code), making accounts much more secure.'
    },

    // Advanced Questions
    {
      id: 'q13',
      question: 'What is "typosquatting"?',
      options: [
        'Making typos in emails',
        'Registering misspelled domain names to trick users',
        'A typing exercise program',
        'A legitimate SEO technique'
      ],
      correctAnswer: 1,
      difficulty: 'advanced',
      category: 'phishing',
      explanation: 'Typosquatting involves registering domains similar to legitimate sites (e.g., gooogle.com) to capture users who make typos.'
    },
    {
      id: 'q14',
      question: 'What is a "watering hole" attack?',
      options: [
        'Phishing emails about water bills',
        'Infecting websites that target victims frequently visit',
        'Physical surveillance near water fountains',
        'A type of password attack'
      ],
      correctAnswer: 1,
      difficulty: 'advanced',
      category: 'malware',
      explanation: 'Watering hole attacks compromise legitimate websites that specific target groups visit, then infect visitors.'
    },
    {
      id: 'q15',
      question: 'What is the principle of "least privilege"?',
      options: [
        'Always use admin accounts for convenience',
        'Users should only have access needed for their role',
        'Share passwords to collaborate better',
        'Disable all security features'
      ],
      correctAnswer: 1,
      difficulty: 'advanced',
      category: 'privacy',
      explanation: 'Least privilege means users get only the minimum access necessary. This limits damage if an account is compromised.'
    },

    // Behavioral Security
    {
      id: 'q16',
      question: 'What should you do if you accidentally clicked a suspicious link?',
      options: [
        'Ignore it and hope for the best',
        'Immediately disconnect from internet and scan for malware',
        'Continue browsing normally',
        'Delete your browser history'
      ],
      correctAnswer: 1,
      difficulty: 'intermediate',
      category: 'malware',
      explanation: 'Disconnect immediately to prevent data exfiltration, then run antivirus/antimalware scans. Report to IT if work device.'
    },
    {
      id: 'q17',
      question: 'How can you verify a website is using secure encryption?',
      options: [
        'Check for "https://" and a padlock icon in the address bar',
        'The website looks professional',
        'It has a .com domain',
        'It asks for your credit card'
      ],
      correctAnswer: 0,
      difficulty: 'beginner',
      category: 'privacy',
      explanation: 'HTTPS (not HTTP) and the padlock icon indicate the connection is encrypted. However, this doesn\'t guarantee the site is trustworthy.'
    },
    {
      id: 'q18',
      question: 'What is "shoulder surfing"?',
      options: [
        'A water sport',
        'Watching someone enter passwords or sensitive data',
        'A network hacking technique',
        'A type of malware'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'social_engineering',
      explanation: 'Shoulder surfing is when attackers observe you entering passwords or PINs. Always be aware of your surroundings.'
    },
    {
      id: 'q19',
      question: 'What is a "zero-day" vulnerability?',
      options: [
        'A bug that takes zero days to fix',
        'A security flaw unknown to the software vendor',
        'A vulnerability that exists for less than a day',
        'A fake security threat'
      ],
      correctAnswer: 1,
      difficulty: 'advanced',
      category: 'malware',
      explanation: 'Zero-day vulnerabilities are unknown to vendors, making them extremely dangerous as no patch exists yet.'
    },
    {
      id: 'q20',
      question: 'What should you do with software updates?',
      options: [
        'Ignore them - they\'re annoying',
        'Install them promptly as they fix security holes',
        'Wait 6 months to ensure they\'re stable',
        'Only update if you have problems'
      ],
      correctAnswer: 1,
      difficulty: 'beginner',
      category: 'malware',
      explanation: 'Updates often patch critical security vulnerabilities. Install them promptly to stay protected.'
    }
  ];

  /**
   * Lesson content database
   */
  private readonly lessons: Lesson[] = [
    {
      id: 'lesson-phishing-101',
      title: 'Phishing 101: Recognizing Email Scams',
      duration: 15,
      difficulty: 'beginner',
      category: 'phishing',
      priority: 1,
      content: `# Phishing 101: Recognizing Email Scams

## What is Phishing?

Phishing is a cyberattack where criminals impersonate legitimate organizations to steal your personal information, passwords, or money.

## Common Red Flags

### 1. Urgent Language
- "Your account will be closed in 24 hours!"
- "Immediate action required!"
- "Verify now or lose access!"

### 2. Suspicious Sender
- Misspelled email addresses (amaz0n.com instead of amazon.com)
- Generic greetings ("Dear Customer" instead of your name)
- Unfamiliar sender claiming to be from known company

### 3. Suspicious Links
- Hover over links (don't click!) to see the real destination
- Look for misspellings in URLs
- Check for HTTPS and the padlock icon

### 4. Requests for Personal Information
- Legitimate companies never ask for passwords via email
- Social Security numbers should never be requested by email
- Credit card details should only be entered on secure websites

### 5. Attachments from Unknown Senders
- Never open unexpected attachments
- Even if it looks like it's from someone you know, verify first

## What to Do

✅ **DO:**
- Verify requests through official channels
- Report suspicious emails to your IT department
- Delete phishing emails
- Enable spam filters

❌ **DON'T:**
- Click suspicious links
- Reply to phishing emails
- Download unexpected attachments
- Share the email (it could infect others)

## Real Example

**Phishing Email:**
\`\`\`
From: security@paypa1-verify.com
Subject: Account Suspended - Verify Now

Your PayPal account has been suspended due to unusual activity.
Click here to verify your account within 24 hours or it will be permanently closed.
[Verify Account]
\`\`\`

**Red Flags:**
1. Domain is "paypa1" (with number 1) not "paypal"
2. Urgent language and threats
3. Unexpected email
4. Asks you to click a link

**Correct Action:**
Go directly to paypal.com (type it yourself) and check your account. Call PayPal's official support number if concerned.
`,
      quiz: [
        this.quizQuestions[0], // Bank verification question
        this.quizQuestions[1], // Common signs
        this.quizQuestions[2]  // Email address legitimacy
      ],
      resources: [
        {
          title: 'FTC Guide to Phishing',
          url: 'https://www.consumer.ftc.gov/articles/how-recognize-and-avoid-phishing-scams',
          type: 'article'
        },
        {
          title: 'Google Phishing Quiz',
          url: 'https://phishingquiz.withgoogle.com/',
          type: 'interactive',
          duration: 10
        }
      ]
    },
    {
      id: 'lesson-passwords',
      title: 'Password Security: Creating Unbreakable Passwords',
      duration: 12,
      difficulty: 'beginner',
      category: 'passwords',
      priority: 2,
      content: `# Password Security: Creating Unbreakable Passwords

## Why Password Security Matters

A weak password is like leaving your front door unlocked. Hackers use automated tools to try millions of password combinations per second.

## Password Best Practices

### 1. Length is Strength
- Minimum 12 characters (longer is better)
- Each additional character makes passwords exponentially harder to crack

### 2. Complexity
- Mix uppercase and lowercase letters
- Include numbers
- Add special characters (!@#$%^&*)

### 3. Avoid Common Mistakes
❌ Password123
❌ Your name + birthday
❌ Common words (password, admin, qwerty)
❌ Sequential characters (abc123, 111111)

### 4. Use Passphrases
Instead of: D0g$2023
Try: Correct-Horse-Battery-Staple-47!

## Password Manager Benefits

✅ Generate complex random passwords
✅ Remember them for you
✅ Auto-fill securely
✅ Alert you to breached passwords
✅ Sync across devices

**Recommended:** Bitwarden, 1Password, LastPass

## Two-Factor Authentication (2FA)

Add a second layer of security:
1. Something you know (password)
2. Something you have (phone code)

Even if your password is stolen, attackers can't access your account without the second factor.

## What to Do After a Breach

If a service you use gets breached:
1. Change that password immediately
2. Change passwords on any other accounts that used the same password
3. Enable 2FA if available
4. Monitor your accounts for suspicious activity

## Password Strength Examples

**Weak:** john1990 (8 characters, predictable)
Crack time: < 1 second

**Medium:** J0hn$1990 (9 characters, some complexity)
Crack time: ~2 hours

**Strong:** MyDog$LovesT0Run#47 (20 characters, complex)
Crack time: Billions of years
`,
      quiz: [
        this.quizQuestions[3], // Strong password definition
        this.quizQuestions[4], // Password reuse
        this.quizQuestions[5]  // Password managers
      ],
      resources: [
        {
          title: 'How Secure Is My Password?',
          url: 'https://www.security.org/how-secure-is-my-password/',
          type: 'interactive'
        },
        {
          title: 'Bitwarden Password Manager',
          url: 'https://bitwarden.com',
          type: 'tool'
        }
      ]
    },
    {
      id: 'lesson-social-engineering',
      title: 'Social Engineering: How Scammers Manipulate People',
      duration: 18,
      difficulty: 'intermediate',
      category: 'social_engineering',
      priority: 3,
      content: `# Social Engineering: How Scammers Manipulate People

## What is Social Engineering?

Social engineering is psychological manipulation to trick people into revealing confidential information or performing actions that compromise security.

## Common Techniques

### 1. Pretexting
Creating a fake scenario to extract information.

**Example:** Someone calls claiming to be from IT and says they need your password to "fix a problem."

### 2. Baiting
Offering something enticing to lure victims.

**Example:** "Free iPhone - Just enter your email and password to claim!"

### 3. Tailgating
Following someone into a restricted area.

**Example:** Holding coffee and asking someone to hold the door open.

### 4. Quid Pro Quo
Offering a service in exchange for information.

**Example:** "I'm from tech support. I'll fix your computer if you disable your antivirus first."

### 5. Authority
Impersonating someone in a position of power.

**Example:** Email from "CEO" asking you to buy gift cards urgently.

## Psychological Triggers

Scammers exploit:
- **Urgency:** "Act now or lose access!"
- **Fear:** "Your account has been hacked!"
- **Greed:** "You've won $1 million!"
- **Curiosity:** "See who viewed your profile"
- **Trust:** "We're from IT support"
- **Helpfulness:** "Can you hold the door?"

## Defense Strategies

✅ **Verify Identity**
- Call back using official numbers
- Check email addresses carefully
- Ask questions only the real person would know

✅ **Slow Down**
- Resist pressure to act immediately
- Take time to think critically
- Consult with others

✅ **Question Everything**
- Why are they contacting me?
- How did they get my information?
- What do they really want?

✅ **Follow Policy**
- Never share passwords (even to "IT")
- Don't let strangers into secure areas
- Report suspicious requests

## Real-World Scenarios

**Scenario 1: The CEO Email**
"I'm in a meeting and need you to buy $500 in iTunes gift cards immediately. Send the codes to this email."

**Red Flags:**
- Urgency
- Unusual request
- Request for gift cards (untraceable)

**Action:** Call CEO directly to verify.

**Scenario 2: The Tech Support Call**
"We've detected a virus on your computer. Give me remote access and your credit card to clean it."

**Red Flags:**
- Unsolicited call
- Request for payment
- Request for remote access

**Action:** Hang up. Legitimate companies don't cold-call about viruses.
`,
      quiz: [
        this.quizQuestions[6], // IT password request
        this.quizQuestions[7], // Pretexting definition
        this.quizQuestions[17] // Shoulder surfing
      ],
      resources: [
        {
          title: 'Social Engineering Red Flags',
          url: 'https://www.cisa.gov/news-events/news/avoiding-social-engineering-and-phishing-attacks',
          type: 'article'
        }
      ]
    }
  ];

  /**
   * Assess user's literacy level based on quiz performance
   */
  private assessLiteracyLevel(score: number): QuizResult['literacyLevel'] {
    if (score >= 80) return 'advanced';
    if (score >= 60) return 'intermediate';
    return 'beginner';
  }

  /**
   * Identify knowledge gaps from quiz results
   */
  private identifyKnowledgeGaps(
    questions: QuizQuestion[],
    userAnswers: number[]
  ): string[] {
    const gaps: Set<string> = new Set();

    questions.forEach((q, index) => {
      if (userAnswers[index] !== q.correctAnswer) {
        gaps.add(q.category);
      }
    });

    return Array.from(gaps);
  }

  /**
   * Identify strengths from quiz results
   */
  private identifyStrengths(
    questions: QuizQuestion[],
    userAnswers: number[]
  ): string[] {
    const categoryCorrect: Map<string, number> = new Map();
    const categoryTotal: Map<string, number> = new Map();

    questions.forEach((q, index) => {
      const cat = q.category;
      categoryTotal.set(cat, (categoryTotal.get(cat) || 0) + 1);

      if (userAnswers[index] === q.correctAnswer) {
        categoryCorrect.set(cat, (categoryCorrect.get(cat) || 0) + 1);
      }
    });

    const strengths: string[] = [];
    categoryTotal.forEach((total, category) => {
      const correct = categoryCorrect.get(category) || 0;
      if (correct / total >= 0.8) { // 80% or higher
        strengths.push(category);
      }
    });

    return strengths;
  }

  /**
   * Grade quiz and return results
   */
  gradeQuiz(
    questions: QuizQuestion[],
    userAnswers: number[],
    timeTaken: number
  ): QuizResult {
    const correctAnswers = questions.reduce((count, q, index) => {
      return count + (userAnswers[index] === q.correctAnswer ? 1 : 0);
    }, 0);

    const score = Math.round((correctAnswers / questions.length) * 100);
    const literacyLevel = this.assessLiteracyLevel(score);
    const knowledgeGaps = this.identifyKnowledgeGaps(questions, userAnswers);
    const strengths = this.identifyStrengths(questions, userAnswers);

    return {
      score,
      totalQuestions: questions.length,
      correctAnswers,
      literacyLevel,
      knowledgeGaps,
      strengths,
      timeTaken
    };
  }

  /**
   * Generate personalized learning path based on quiz results
   */
  generateLearningPath(quizResult: QuizResult): LearningPath {
    const relevantLessons: Lesson[] = [];

    // Add lessons for knowledge gaps
    for (const gap of quizResult.knowledgeGaps) {
      const lesson = this.lessons.find(l => l.category === gap);
      if (lesson && !relevantLessons.includes(lesson)) {
        relevantLessons.push(lesson);
      }
    }

    // Add lessons matching literacy level
    const levelLessons = this.lessons.filter(
      l => l.difficulty === quizResult.literacyLevel
    );
    levelLessons.forEach(lesson => {
      if (!relevantLessons.includes(lesson)) {
        relevantLessons.push(lesson);
      }
    });

    // Sort by priority
    relevantLessons.sort((a, b) => a.priority - b.priority);

    const estimatedTime = relevantLessons.reduce((sum, l) => sum + l.duration, 0);

    return {
      lessons: relevantLessons,
      estimatedTime,
      difficulty: quizResult.literacyLevel,
      completionRate: 0
    };
  }

  /**
   * Get quiz questions
   */
  getQuizQuestions(count: number = 10, difficulty?: QuizQuestion['difficulty']): QuizQuestion[] {
    let questions = [...this.quizQuestions];

    if (difficulty) {
      questions = questions.filter(q => q.difficulty === difficulty);
    }

    // Shuffle and take requested count
    const shuffled = questions.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /**
   * Get lesson by ID
   */
  getLesson(lessonId: string): Lesson | null {
    return this.lessons.find(l => l.id === lessonId) || null;
  }

  /**
   * Get all lessons
   */
  getAllLessons(): Lesson[] {
    return this.lessons;
  }

  /**
   * Track learning progress
   */
  updateProgress(
    userId: string,
    lessonId: string,
    quizScore: number,
    timeSpent: number,
    currentProgress?: LearningProgress
  ): LearningProgress {
    const baseProgress = currentProgress || {
      userId,
      lessonsCompleted: 0,
      totalLessons: this.lessons.length,
      averageQuizScore: 0,
      timeSpent: 0,
      comprehensionGrowth: [],
      behavioralImprovement: {
        scamsAvoided: 0,
        detectionAccuracyChange: 0
      },
      lastActivity: new Date()
    };

    const lesson = this.getLesson(lessonId);
    if (!lesson) return baseProgress;

    // Update completed lessons
    const newProgress: LearningProgress = {
      ...baseProgress,
      lessonsCompleted: baseProgress.lessonsCompleted + 1,
      timeSpent: baseProgress.timeSpent + timeSpent,
      comprehensionGrowth: [...baseProgress.comprehensionGrowth, quizScore],
      lastActivity: new Date()
    };

    // Calculate average quiz score
    newProgress.averageQuizScore =
      newProgress.comprehensionGrowth.reduce((a, b) => a + b, 0) /
      newProgress.comprehensionGrowth.length;

    // Calculate detection accuracy improvement
    if (newProgress.comprehensionGrowth.length >= 2) {
      const first = newProgress.comprehensionGrowth[0];
      const latest = newProgress.comprehensionGrowth[newProgress.comprehensionGrowth.length - 1];
      newProgress.behavioralImprovement.detectionAccuracyChange = latest - first;
    }

    return newProgress;
  }
}

export const literacyCoachService = new LiteracyCoachService();
