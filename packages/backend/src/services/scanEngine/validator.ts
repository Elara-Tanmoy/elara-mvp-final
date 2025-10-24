/**
 * Stage 0.1: URL Validation & Normalization
 * Validates URL format, normalizes, extracts components, detects private networks
 */

import crypto from 'crypto';
import { URL } from 'url';
import { ValidationResult, URLComponents } from './types.js';

export class URLValidator {
  private static readonly PRIVATE_NETWORK_PATTERNS = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^localhost$/i,
    /^0\.0\.0\.0$/
  ];

  /**
   * Validate and normalize URL
   */
  static async validate(urlString: string): Promise<ValidationResult> {
    try {
      // Basic format validation
      if (!urlString || typeof urlString !== 'string') {
        return { valid: false, error: 'URL must be a non-empty string' };
      }

      // Trim whitespace
      urlString = urlString.trim();

      // Add protocol if missing
      if (!/^https?:\/\//i.test(urlString)) {
        urlString = 'http://' + urlString;
      }

      // Parse URL
      let parsedURL: URL;
      try {
        parsedURL = new URL(urlString);
      } catch (e) {
        return { valid: false, error: 'Invalid URL format' };
      }

      // Extract components
      const components = this.extractComponents(parsedURL);

      // Check for private network
      const isPrivateNetwork = this.isPrivateNetwork(components.hostname);
      if (isPrivateNetwork) {
        return {
          valid: false,
          error: 'Private network addresses are not allowed',
          isPrivateNetwork: true,
          components
        };
      }

      return {
        valid: true,
        components
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Extract URL components
   */
  private static extractComponents(parsedURL: URL): URLComponents {
    const hostname = parsedURL.hostname.toLowerCase();
    const parts = hostname.split('.');

    // Extract TLD and domain
    const tld = parts[parts.length - 1];
    const domain = parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : hostname;
    const subdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : null;

    // Create canonical URL (normalized for caching)
    const canonical = this.canonicalize(parsedURL);

    // Generate hash
    const hash = crypto.createHash('sha256').update(canonical).digest('hex');

    return {
      original: parsedURL.href,
      canonical,
      protocol: parsedURL.protocol.replace(':', ''),
      hostname,
      domain,
      subdomain,
      tld,
      port: parsedURL.port ? parseInt(parsedURL.port) : null,
      path: parsedURL.pathname,
      query: parsedURL.search.replace('?', '') || null,
      fragment: parsedURL.hash.replace('#', '') || null,
      hash
    };
  }

  /**
   * Canonicalize URL for consistent caching
   */
  private static canonicalize(url: URL): string {
    // Normalize protocol
    const protocol = url.protocol.toLowerCase();

    // Normalize hostname (lowercase, remove www)
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    // Normalize path (remove trailing slash except for root)
    let path = url.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Sort query parameters
    const params = new URLSearchParams(url.search);
    const sortedParams = new URLSearchParams(
      Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    );

    // Build canonical URL (no fragment)
    let canonical = `${protocol}//${hostname}`;
    if (url.port && url.port !== '80' && url.port !== '443') {
      canonical += `:${url.port}`;
    }
    canonical += path;
    if (sortedParams.toString()) {
      canonical += `?${sortedParams.toString()}`;
    }

    return canonical;
  }

  /**
   * Check if hostname is a private network address
   */
  private static isPrivateNetwork(hostname: string): boolean {
    return this.PRIVATE_NETWORK_PATTERNS.some(pattern => pattern.test(hostname));
  }

  /**
   * Quick validation (just check format, don't extract components)
   */
  static isValidFormat(urlString: string): boolean {
    try {
      if (!urlString || typeof urlString !== 'string') return false;
      urlString = urlString.trim();
      if (!/^https?:\/\//i.test(urlString)) {
        urlString = 'http://' + urlString;
      }
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  }
}
