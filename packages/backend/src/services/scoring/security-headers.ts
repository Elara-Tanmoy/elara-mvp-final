import axios from 'axios';

interface Finding {
  check: string;
  result: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  points: number;
  maxPoints: number;
  explanation: string;
  evidence?: any;
}

interface SecurityHeadersResult {
  score: number;
  maxScore: number;
  findings: Finding[];
  status: 'PASS' | 'WARNING' | 'FAIL';
}

export class SecurityHeadersAnalyzer {
  /**
   * Complete Security Headers & Modern Standards Analysis (25 points)
   *
   * Categories:
   * - Content-Security-Policy (7 points)
   * - X-Frame-Options (5 points)
   * - HSTS Configuration (6 points)
   * - Cookie Security (4 points)
   * - Security.txt (3 points)
   */
  async analyzeSecurityHeaders(url: string): Promise<SecurityHeadersResult> {
    const findings: Finding[] = [];
    let score = 0;
    const maxScore = 25;

    try {
      // Fetch headers
      const response = await axios.head(url, {
        timeout: 5000,
        validateStatus: () => true, // Accept any status
        maxRedirects: 5
      });

      const headers = response.headers;

      // 1. Content-Security-Policy (7 points)
      const cspFindings = this.checkCSP(headers);
      findings.push(...cspFindings.findings);
      score += cspFindings.score;

      // 2. X-Frame-Options (5 points)
      const frameOptionsFindings = this.checkFrameOptions(headers);
      findings.push(...frameOptionsFindings.findings);
      score += frameOptionsFindings.score;

      // 3. HSTS Configuration (6 points)
      const hstsFindings = this.checkHSTS(headers, url);
      findings.push(...hstsFindings.findings);
      score += hstsFindings.score;

      // 4. Cookie Security (4 points)
      const cookieFindings = this.checkCookieSecurity(headers);
      findings.push(...cookieFindings.findings);
      score += cookieFindings.score;

      // 5. Security.txt (3 points)
      const securityTxtFindings = await this.checkSecurityTxt(url);
      findings.push(...securityTxtFindings.findings);
      score += securityTxtFindings.score;

    } catch (error) {
      console.error('Security headers analysis error:', error);

      findings.push({
        check: 'Security Headers Check',
        result: 'Unable to Fetch',
        severity: 'MEDIUM',
        points: 5,
        maxPoints: 5,
        explanation: 'Could not fetch HTTP headers to analyze security configuration',
        evidence: { error: (error as Error).message }
      });
      score += 5;
    }

    const status = score >= 15 ? 'FAIL' : score >= 8 ? 'WARNING' : 'PASS';

    return { score, maxScore, findings, status };
  }

  private checkCSP(headers: any): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    const csp = headers['content-security-policy'] || headers['Content-Security-Policy'];

    if (!csp) {
      score += 5;
      findings.push({
        check: 'Content-Security-Policy',
        result: 'Missing',
        severity: 'HIGH',
        points: 5,
        maxPoints: 5,
        explanation: 'No Content-Security-Policy header. CSP prevents XSS attacks by controlling resource loading. Critical security header.',
        evidence: { csp: null }
      });
    } else {
      // Check for unsafe CSP directives
      const hasUnsafeInline = csp.includes("'unsafe-inline'");
      const hasUnsafeEval = csp.includes("'unsafe-eval'");

      if (hasUnsafeInline || hasUnsafeEval) {
        score += 3;
        findings.push({
          check: 'Content-Security-Policy',
          result: 'Weak (unsafe directives)',
          severity: 'MEDIUM',
          points: 3,
          maxPoints: 5,
          explanation: `CSP present but uses unsafe directives (${hasUnsafeInline ? 'unsafe-inline' : ''} ${hasUnsafeEval ? 'unsafe-eval' : ''}). Reduces XSS protection effectiveness.`,
          evidence: { csp, hasUnsafeInline, hasUnsafeEval }
        });
      } else {
        findings.push({
          check: 'Content-Security-Policy',
          result: 'Strong',
          severity: 'LOW',
          points: 0,
          maxPoints: 5,
          explanation: 'Content-Security-Policy properly configured without unsafe directives',
          evidence: { csp }
        });
      }
    }

    // Check for X-Content-Type-Options
    const xContentType = headers['x-content-type-options'] || headers['X-Content-Type-Options'];

    if (!xContentType || xContentType.toLowerCase() !== 'nosniff') {
      score += 2;
      findings.push({
        check: 'X-Content-Type-Options',
        result: 'Missing or Incorrect',
        severity: 'MEDIUM',
        points: 2,
        maxPoints: 2,
        explanation: 'X-Content-Type-Options not set to "nosniff". Allows MIME-type sniffing attacks.',
        evidence: { xContentType }
      });
    } else {
      findings.push({
        check: 'X-Content-Type-Options',
        result: 'Properly Set (nosniff)',
        severity: 'LOW',
        points: 0,
        maxPoints: 2,
        explanation: 'X-Content-Type-Options set to nosniff - prevents MIME-type sniffing',
        evidence: { xContentType }
      });
    }

    return { score, findings };
  }

  private checkFrameOptions(headers: any): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    const xFrameOptions = headers['x-frame-options'] || headers['X-Frame-Options'];

    if (!xFrameOptions) {
      score += 5;
      findings.push({
        check: 'X-Frame-Options',
        result: 'Missing',
        severity: 'HIGH',
        points: 5,
        maxPoints: 5,
        explanation: 'No X-Frame-Options header. Site can be embedded in iframes, vulnerable to clickjacking attacks.',
        evidence: { xFrameOptions: null }
      });
    } else {
      const value = xFrameOptions.toLowerCase();

      if (value === 'allow-from' || value.startsWith('allow-from')) {
        score += 2;
        findings.push({
          check: 'X-Frame-Options',
          result: 'Weak (ALLOW-FROM)',
          severity: 'MEDIUM',
          points: 2,
          maxPoints: 5,
          explanation: 'X-Frame-Options uses deprecated ALLOW-FROM. Should use DENY or SAMEORIGIN.',
          evidence: { xFrameOptions }
        });
      } else if (value === 'deny' || value === 'sameorigin') {
        findings.push({
          check: 'X-Frame-Options',
          result: `Secure (${value.toUpperCase()})`,
          severity: 'LOW',
          points: 0,
          maxPoints: 5,
          explanation: `X-Frame-Options set to ${value.toUpperCase()} - prevents clickjacking`,
          evidence: { xFrameOptions }
        });
      } else {
        score += 3;
        findings.push({
          check: 'X-Frame-Options',
          result: 'Invalid Value',
          severity: 'HIGH',
          points: 3,
          maxPoints: 5,
          explanation: 'X-Frame-Options has invalid value. Should be DENY or SAMEORIGIN.',
          evidence: { xFrameOptions }
        });
      }
    }

    return { score, findings };
  }

  private checkHSTS(headers: any, url: string): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    // HSTS only applies to HTTPS sites
    if (!url.startsWith('https://')) {
      findings.push({
        check: 'HSTS (HTTP Strict Transport Security)',
        result: 'Not Applicable (HTTP)',
        severity: 'CRITICAL',
        points: 0,
        maxPoints: 6,
        explanation: 'Site uses HTTP, HSTS not applicable. However, this is a critical security issue - site should use HTTPS.',
        evidence: { https: false }
      });
      // Note: HTTP gets points in SSL/TLS analysis, not here
      return { score, findings };
    }

    const hsts = headers['strict-transport-security'] || headers['Strict-Transport-Security'];

    if (!hsts) {
      score += 4;
      findings.push({
        check: 'HSTS (HTTP Strict Transport Security)',
        result: 'Missing',
        severity: 'HIGH',
        points: 4,
        maxPoints: 4,
        explanation: 'No HSTS header on HTTPS site. HSTS forces browsers to always use HTTPS, preventing downgrade attacks.',
        evidence: { hsts: null }
      });
    } else {
      // Parse HSTS max-age
      const maxAgeMatch = hsts.match(/max-age=(\d+)/);
      const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;

      const oneYear = 31536000; // seconds in a year

      if (maxAge < oneYear) {
        score += 2;
        findings.push({
          check: 'HSTS Configuration',
          result: `Weak (max-age: ${maxAge}s)`,
          severity: 'MEDIUM',
          points: 2,
          maxPoints: 4,
          explanation: `HSTS max-age (${maxAge}s) is less than one year. Should be at least 31536000 (1 year).`,
          evidence: { hsts, maxAge, recommended: oneYear }
        });
      } else {
        findings.push({
          check: 'HSTS Configuration',
          result: `Strong (max-age: ${maxAge}s)`,
          severity: 'LOW',
          points: 0,
          maxPoints: 4,
          explanation: 'HSTS properly configured with max-age >= 1 year',
          evidence: { hsts, maxAge }
        });
      }

      // Check for includeSubDomains
      const hasIncludeSubDomains = hsts.includes('includeSubDomains');

      if (!hasIncludeSubDomains) {
        score += 1;
        findings.push({
          check: 'HSTS Subdomain Coverage',
          result: 'Missing includeSubDomains',
          severity: 'LOW',
          points: 1,
          maxPoints: 1,
          explanation: 'HSTS does not include subdomains. Subdomains may be vulnerable to downgrade attacks.',
          evidence: { hasIncludeSubDomains: false }
        });
      } else {
        findings.push({
          check: 'HSTS Subdomain Coverage',
          result: 'Includes Subdomains',
          severity: 'LOW',
          points: 0,
          maxPoints: 1,
          explanation: 'HSTS includes subdomain coverage',
          evidence: { hasIncludeSubDomains: true }
        });
      }

      // Check for preload
      const hasPreload = hsts.includes('preload');

      if (!hasPreload) {
        score += 1;
        findings.push({
          check: 'HSTS Preload',
          result: 'Not Preloaded',
          severity: 'LOW',
          points: 1,
          maxPoints: 1,
          explanation: 'HSTS not configured for browser preload list. First-time visitors may be vulnerable.',
          evidence: { hasPreload: false }
        });
      } else {
        findings.push({
          check: 'HSTS Preload',
          result: 'Preload Enabled',
          severity: 'LOW',
          points: 0,
          maxPoints: 1,
          explanation: 'HSTS configured for preload - maximum protection',
          evidence: { hasPreload: true }
        });
      }
    }

    return { score, findings };
  }

  private checkCookieSecurity(headers: any): { score: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let score = 0;

    const setCookie = headers['set-cookie'] || headers['Set-Cookie'];

    if (!setCookie) {
      findings.push({
        check: 'Cookie Security',
        result: 'No Cookies Set',
        severity: 'LOW',
        points: 0,
        maxPoints: 4,
        explanation: 'No cookies set by this response',
        evidence: { setCookie: null }
      });
      return { score, findings };
    }

    // Parse cookies (can be array or string)
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

    let insecureCookies = 0;
    let missingHttpOnly = 0;
    let missingSameSite = 0;

    cookies.forEach(cookie => {
      const cookieLower = cookie.toLowerCase();

      // Check for Secure flag
      if (!cookieLower.includes('secure')) {
        insecureCookies++;
      }

      // Check for HttpOnly flag
      if (!cookieLower.includes('httponly')) {
        missingHttpOnly++;
      }

      // Check for SameSite
      if (!cookieLower.includes('samesite')) {
        missingSameSite++;
      }
    });

    if (insecureCookies > 0) {
      score += 2;
      findings.push({
        check: 'Cookie Secure Flag',
        result: `${insecureCookies} cookie(s) missing Secure flag`,
        severity: 'HIGH',
        points: 2,
        maxPoints: 2,
        explanation: 'Cookies without Secure flag can be transmitted over HTTP, vulnerable to interception.',
        evidence: { insecureCookies, totalCookies: cookies.length }
      });
    } else {
      findings.push({
        check: 'Cookie Secure Flag',
        result: 'All cookies secure',
        severity: 'LOW',
        points: 0,
        maxPoints: 2,
        explanation: 'All cookies have Secure flag set',
        evidence: { insecureCookies: 0, totalCookies: cookies.length }
      });
    }

    if (missingHttpOnly > 0) {
      score += 1;
      findings.push({
        check: 'Cookie HttpOnly Flag',
        result: `${missingHttpOnly} cookie(s) missing HttpOnly`,
        severity: 'MEDIUM',
        points: 1,
        maxPoints: 1,
        explanation: 'Cookies without HttpOnly flag can be accessed by JavaScript, vulnerable to XSS.',
        evidence: { missingHttpOnly, totalCookies: cookies.length }
      });
    } else {
      findings.push({
        check: 'Cookie HttpOnly Flag',
        result: 'All cookies HttpOnly',
        severity: 'LOW',
        points: 0,
        maxPoints: 1,
        explanation: 'All cookies have HttpOnly flag - protected from JavaScript access',
        evidence: { missingHttpOnly: 0, totalCookies: cookies.length }
      });
    }

    if (missingSameSite > 0) {
      score += 1;
      findings.push({
        check: 'Cookie SameSite',
        result: `${missingSameSite} cookie(s) missing SameSite`,
        severity: 'MEDIUM',
        points: 1,
        maxPoints: 1,
        explanation: 'Cookies without SameSite attribute vulnerable to CSRF attacks.',
        evidence: { missingSameSite, totalCookies: cookies.length }
      });
    } else {
      findings.push({
        check: 'Cookie SameSite',
        result: 'All cookies have SameSite',
        severity: 'LOW',
        points: 0,
        maxPoints: 1,
        explanation: 'All cookies have SameSite attribute - CSRF protection',
        evidence: { missingSameSite: 0, totalCookies: cookies.length }
      });
    }

    return { score, findings };
  }

  private async checkSecurityTxt(url: string): Promise<{ score: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    let score = 0;

    try {
      const urlObj = new URL(url);
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

      // Check both locations for security.txt
      const locations = [
        `${baseUrl}/.well-known/security.txt`,
        `${baseUrl}/security.txt`
      ];

      let found = false;

      for (const location of locations) {
        try {
          const response = await axios.get(location, {
            timeout: 3000,
            validateStatus: (status) => status === 200
          });

          if (response.status === 200) {
            found = true;
            findings.push({
              check: 'Security.txt',
              result: 'Present',
              severity: 'LOW',
              points: 0,
              maxPoints: 3,
              explanation: `Security disclosure policy found at ${location}. Shows commitment to responsible vulnerability disclosure.`,
              evidence: { location, found: true }
            });
            break;
          }
        } catch (error) {
          // Continue checking other location
        }
      }

      if (!found) {
        score += 3;
        findings.push({
          check: 'Security.txt',
          result: 'Missing',
          severity: 'MEDIUM',
          points: 3,
          maxPoints: 3,
          explanation: 'No security.txt file found. RFC 9116 recommends security.txt for vulnerability disclosure contact.',
          evidence: { locationsChecked: locations, found: false }
        });
      }
    } catch (error) {
      console.error('Security.txt check error:', error);
    }

    return { score, findings };
  }
}
