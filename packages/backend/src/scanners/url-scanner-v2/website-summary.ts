/**
 * Website Summary Generator
 *
 * Extracts and generates a human-friendly summary of what a website is about
 * by analyzing HTML content (title, meta tags, headings, and prominent text).
 */

import * as cheerio from 'cheerio';

export interface WebsiteSummary {
  title: string;
  description: string;
  mainClaims: string[];
  purpose: string;
  targetAudience?: string;
  keyFeatures: string[];
}

/**
 * Generate a website summary from HTML content
 */
export function generateWebsiteSummary(html: string, url: string): WebsiteSummary {
  try {
    const $ = cheerio.load(html);

    // Extract title
    const title = extractTitle($);

    // Extract meta description
    const description = extractDescription($);

    // Extract main headings (h1, h2, h3)
    const headings = extractHeadings($);

    // Extract OpenGraph data
    const ogData = extractOpenGraph($);

    // Extract main claims from prominent text
    const mainClaims = extractMainClaims($, headings);

    // Determine purpose based on content
    const purpose = determinePurpose($, title, description, headings, url);

    // Extract key features
    const keyFeatures = extractKeyFeatures($, headings);

    // Determine target audience (if possible)
    const targetAudience = determineTargetAudience($, description, headings);

    return {
      title,
      description,
      mainClaims,
      purpose,
      targetAudience,
      keyFeatures
    };
  } catch (error) {
    console.error('[WebsiteSummary] Error generating summary:', error);

    // Return minimal summary on error
    return {
      title: 'Website',
      description: 'Unable to analyze website content',
      mainClaims: [],
      purpose: 'Unknown',
      keyFeatures: []
    };
  }
}

/**
 * Extract page title
 */
function extractTitle($: cheerio.CheerioAPI): string {
  // Try various sources in order of preference
  const sources = [
    $('title').first().text(),
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('h1').first().text(),
    'Untitled Website'
  ];

  for (const source of sources) {
    if (source && source.trim()) {
      return cleanText(source).slice(0, 200);
    }
  }

  return 'Untitled Website';
}

/**
 * Extract meta description
 */
function extractDescription($: cheerio.CheerioAPI): string {
  const sources = [
    $('meta[name="description"]').attr('content'),
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="twitter:description"]').attr('content'),
    // Fallback to first paragraph
    $('p').first().text()
  ];

  for (const source of sources) {
    if (source && source.trim()) {
      return cleanText(source).slice(0, 300);
    }
  }

  return 'No description available';
}

/**
 * Extract main headings (h1, h2, h3)
 */
function extractHeadings($: cheerio.CheerioAPI): string[] {
  const headings: string[] = [];

  // Get first few h1-h3 tags
  $('h1, h2, h3').each((i, el) => {
    if (headings.length >= 10) return false; // Stop after 10
    const text = cleanText($(el).text());
    if (text && text.length > 3 && text.length < 200) {
      headings.push(text);
    }
  });

  return headings;
}

/**
 * Extract OpenGraph data
 */
function extractOpenGraph($: cheerio.CheerioAPI): Record<string, string> {
  const ogData: Record<string, string> = {};

  $('meta[property^="og:"]').each((i, el) => {
    const property = $(el).attr('property')?.replace('og:', '');
    const content = $(el).attr('content');
    if (property && content) {
      ogData[property] = content;
    }
  });

  return ogData;
}

/**
 * Extract main claims from prominent text
 */
function extractMainClaims($: cheerio.CheerioAPI, headings: string[]): string[] {
  const claims: string[] = [];

  // Use headings as claims (they're usually the main value propositions)
  claims.push(...headings.slice(0, 5));

  // Also look for prominent CTAs or value propositions
  const selectors = [
    '.hero', '.jumbotron', '.banner', '.cta',
    '[class*="hero"]', '[class*="banner"]', '[class*="feature"]'
  ];

  selectors.forEach(selector => {
    $(selector).find('p, h1, h2, h3').each((i, el) => {
      if (claims.length >= 8) return false;
      const text = cleanText($(el).text());
      if (text && text.length > 10 && text.length < 200 && !claims.includes(text)) {
        claims.push(text);
      }
    });
  });

  return claims.slice(0, 6); // Limit to 6 claims
}

/**
 * Determine website purpose based on content analysis
 */
function determinePurpose(
  $: cheerio.CheerioAPI,
  title: string,
  description: string,
  headings: string[],
  url: string
): string {
  const allText = [title, description, ...headings].join(' ').toLowerCase();

  // E-commerce indicators
  if (
    allText.includes('shop') || allText.includes('store') ||
    allText.includes('buy') || allText.includes('cart') ||
    allText.includes('product') || allText.includes('price') ||
    $('[class*="cart"]').length > 0 || $('[class*="shop"]').length > 0
  ) {
    return 'E-commerce / Online Store';
  }

  // Banking/Finance
  if (
    allText.includes('bank') || allText.includes('account') ||
    allText.includes('transfer') || allText.includes('payment') ||
    allText.includes('wallet') || allText.includes('crypto')
  ) {
    return 'Banking / Financial Services';
  }

  // Login/Authentication page
  if (
    $('input[type="password"]').length > 0 &&
    (allText.includes('sign in') || allText.includes('log in') || allText.includes('login'))
  ) {
    return 'Authentication / Login Page';
  }

  // News/Blog
  if (
    allText.includes('news') || allText.includes('blog') ||
    allText.includes('article') || $('article').length > 3
  ) {
    return 'News / Blog / Publishing';
  }

  // Corporate/Business
  if (
    allText.includes('about us') || allText.includes('services') ||
    allText.includes('contact us') || allText.includes('company')
  ) {
    return 'Corporate / Business Website';
  }

  // Social Media
  if (
    allText.includes('follow') || allText.includes('share') ||
    allText.includes('post') || allText.includes('profile')
  ) {
    return 'Social Media / Community Platform';
  }

  // Download/Software
  if (
    allText.includes('download') || allText.includes('install') ||
    allText.includes('app') || allText.includes('software')
  ) {
    return 'Software / App Distribution';
  }

  // Support/Help
  if (
    allText.includes('support') || allText.includes('help') ||
    allText.includes('faq') || allText.includes('contact')
  ) {
    return 'Customer Support / Help Center';
  }

  // Generic fallback
  return 'General Website / Landing Page';
}

/**
 * Extract key features mentioned on the page
 */
function extractKeyFeatures($: cheerio.CheerioAPI, headings: string[]): string[] {
  const features: string[] = [];

  // Look for common feature list patterns
  const featureSelectors = [
    '.features li',
    '.feature-list li',
    '[class*="feature"] li',
    '.benefits li',
    '[class*="benefit"] li'
  ];

  featureSelectors.forEach(selector => {
    $(selector).each((i, el) => {
      if (features.length >= 8) return false;
      const text = cleanText($(el).text());
      if (text && text.length > 5 && text.length < 150 && !features.includes(text)) {
        features.push(text);
      }
    });
  });

  // If no explicit feature lists, use prominent headings
  if (features.length === 0) {
    features.push(...headings.slice(0, 5));
  }

  return features.slice(0, 5); // Limit to 5 features
}

/**
 * Determine target audience (if detectable)
 */
function determineTargetAudience(
  $: cheerio.CheerioAPI,
  description: string,
  headings: string[]
): string | undefined {
  const allText = [description, ...headings].join(' ').toLowerCase();

  // Business/Enterprise
  if (
    allText.includes('enterprise') || allText.includes('business') ||
    allText.includes('professional') || allText.includes('company')
  ) {
    return 'Businesses and Enterprises';
  }

  // Developers
  if (
    allText.includes('developer') || allText.includes('api') ||
    allText.includes('code') || allText.includes('integration')
  ) {
    return 'Developers and Technical Users';
  }

  // Consumers
  if (
    allText.includes('everyone') || allText.includes('anyone') ||
    allText.includes('personal') || allText.includes('individual')
  ) {
    return 'General Consumers';
  }

  // Students/Education
  if (
    allText.includes('student') || allText.includes('education') ||
    allText.includes('learning') || allText.includes('course')
  ) {
    return 'Students and Learners';
  }

  return undefined; // Unable to determine
}

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\r\n\t]/g, ' ') // Remove line breaks and tabs
    .trim();
}
