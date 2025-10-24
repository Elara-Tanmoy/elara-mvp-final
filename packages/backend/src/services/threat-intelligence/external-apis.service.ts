import axios from 'axios';
import { logger } from '../../config/logger.js';

interface ThreatIntelResult {
  source: string;
  verdict: string;
  details: any;
  timestamp: Date;
  processingTime: number;
  error?: string;
}

interface ComprehensiveThreatIntel {
  virustotal?: ThreatIntelResult;
  googleSafeBrowsing?: ThreatIntelResult;
  abuseIPDB?: ThreatIntelResult;
  phishTank?: ThreatIntelResult;
  urlhaus?: ThreatIntelResult;
  // PHASE 2: New threat intelligence sources
  surbl?: ThreatIntelResult;
  openphish?: ThreatIntelResult;
  summary: {
    totalChecks: number;
    flaggedCount: number;
    safeCount: number;
    overallVerdict: string;
  };
}

export class ExternalThreatIntelligenceService {
  private virusTotalApiKey: string | undefined;
  private abuseIPDBApiKey: string | undefined;
  private googleSafeBrowsingApiKey: string | undefined;

  constructor() {
    this.virusTotalApiKey = process.env.VIRUSTOTAL_API_KEY;
    this.abuseIPDBApiKey = process.env.ABUSEIPDB_API_KEY;
    this.googleSafeBrowsingApiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  }

  /**
   * Run all threat intelligence checks in parallel
   * PHASE 2: Added SURBL and OpenPhish
   */
  async checkURL(url: string): Promise<ComprehensiveThreatIntel> {
    // Extract domain for SURBL check
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    const results = await Promise.allSettled([
      this.checkVirusTotal(url),
      this.checkGoogleSafeBrowsing(url),
      this.checkAbuseIPDB(url),
      this.checkPhishTank(url),
      this.checkURLhaus(url),
      // PHASE 2: New sources
      this.checkSURBL(domain),
      this.checkOpenPhish(url)
    ]);

    const intel: ComprehensiveThreatIntel = {
      summary: {
        totalChecks: 0,
        flaggedCount: 0,
        safeCount: 0,
        overallVerdict: 'UNKNOWN'
      }
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const response = result.value;
        intel.summary.totalChecks++;

        if (response.verdict === 'MALICIOUS' || response.verdict === 'SUSPICIOUS') {
          intel.summary.flaggedCount++;
        } else if (response.verdict === 'SAFE' || response.verdict === 'CLEAN') {
          intel.summary.safeCount++;
        }

        switch (index) {
          case 0: intel.virustotal = response; break;
          case 1: intel.googleSafeBrowsing = response; break;
          case 2: intel.abuseIPDB = response; break;
          case 3: intel.phishTank = response; break;
          case 4: intel.urlhaus = response; break;
          case 5: intel.surbl = response; break; // PHASE 2
          case 6: intel.openphish = response; break; // PHASE 2
        }
      }
    });

    // Determine overall verdict - prioritize security (any threat is a threat)
    if (intel.summary.flaggedCount > 0) {
      // If ANY source flags it as malicious, mark as suspicious at minimum
      if (intel.summary.flaggedCount >= 2 || intel.summary.flaggedCount >= intel.summary.totalChecks * 0.4) {
        intel.summary.overallVerdict = 'MALICIOUS';
      } else {
        intel.summary.overallVerdict = 'SUSPICIOUS';
      }
    } else if (intel.summary.safeCount >= intel.summary.totalChecks * 0.6 && intel.summary.totalChecks >= 3) {
      // Only mark as SAFE if majority of sources (60%+) explicitly say it's safe
      intel.summary.overallVerdict = 'SAFE';
    } else if (intel.summary.totalChecks > 0) {
      intel.summary.overallVerdict = 'UNKNOWN';
    }

    return intel;
  }

  /**
   * Check VirusTotal
   */
  private async checkVirusTotal(url: string): Promise<ThreatIntelResult> {
    const startTime = Date.now();

    if (!this.virusTotalApiKey) {
      return {
        source: 'VirusTotal',
        verdict: 'UNAVAILABLE',
        details: { message: 'API key not configured' },
        timestamp: new Date(),
        processingTime: 0,
        error: 'API key not provided'
      };
    }

    try {
      // URL encode the URL for VirusTotal API
      const urlId = Buffer.from(url).toString('base64').replace(/=/g, '');

      // First, submit URL for scanning
      const submitResponse = await axios.post(
        'https://www.virustotal.com/api/v3/urls',
        `url=${encodeURIComponent(url)}`,
        {
          headers: {
            'x-apikey': this.virusTotalApiKey,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const analysisId = submitResponse.data.data.id;

      // Get analysis results
      const analysisResponse = await axios.get(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        {
          headers: { 'x-apikey': this.virusTotalApiKey }
        }
      );

      const stats = analysisResponse.data.data.attributes.stats;
      const maliciousCount = stats.malicious || 0;
      const suspiciousCount = stats.suspicious || 0;
      const totalEngines = Object.values(stats).reduce((sum: number, val) => sum + (val as number), 0);

      let verdict = 'CLEAN';
      if (maliciousCount > 0) verdict = 'MALICIOUS';
      else if (suspiciousCount > 0) verdict = 'SUSPICIOUS';

      return {
        source: 'VirusTotal',
        verdict,
        details: {
          malicious: maliciousCount,
          suspicious: suspiciousCount,
          clean: stats.harmless || 0,
          undetected: stats.undetected || 0,
          totalEngines,
          detectionRatio: `${maliciousCount}/${totalEngines}`,
          fullResults: analysisResponse.data.data.attributes.results
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error('VirusTotal check error:', error.message);
      return {
        source: 'VirusTotal',
        verdict: 'ERROR',
        details: { error: error.message },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check Google Safe Browsing
   */
  private async checkGoogleSafeBrowsing(url: string): Promise<ThreatIntelResult> {
    const startTime = Date.now();

    if (!this.googleSafeBrowsingApiKey) {
      return {
        source: 'Google Safe Browsing',
        verdict: 'UNAVAILABLE',
        details: { message: 'API key not configured' },
        timestamp: new Date(),
        processingTime: 0,
        error: 'API key not provided'
      };
    }

    try {
      const response = await axios.post(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${this.googleSafeBrowsingApiKey}`,
        {
          client: {
            clientId: 'elara-platform',
            clientVersion: '1.0.0'
          },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }]
          }
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const matches = response.data.matches || [];
      let verdict = 'SAFE';
      const threats: string[] = [];

      if (matches.length > 0) {
        verdict = 'MALICIOUS';
        matches.forEach((match: any) => {
          threats.push(match.threatType);
        });
      }

      return {
        source: 'Google Safe Browsing',
        verdict,
        details: {
          threatsFound: matches.length,
          threatTypes: threats,
          matches: matches
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error('Google Safe Browsing check error:', error.response?.data || error.message);
      return {
        source: 'Google Safe Browsing',
        verdict: 'UNAVAILABLE',
        details: {
          message: 'Service temporarily unavailable',
          error: error.response?.data?.error?.message || error.message
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Check AbuseIPDB (for IP reputation)
   */
  private async checkAbuseIPDB(url: string): Promise<ThreatIntelResult> {
    const startTime = Date.now();

    if (!this.abuseIPDBApiKey) {
      return {
        source: 'AbuseIPDB',
        verdict: 'UNAVAILABLE',
        details: { message: 'API key not configured' },
        timestamp: new Date(),
        processingTime: 0,
        error: 'API key not provided'
      };
    }

    try {
      // Extract domain/IP from URL
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Check if it's already an IP or need DNS resolution
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      const ipAddress = ipRegex.test(hostname) ? hostname : await this.resolveHostname(hostname);

      if (!ipAddress) {
        return {
          source: 'AbuseIPDB',
          verdict: 'UNKNOWN',
          details: { message: 'Could not resolve hostname to IP' },
          timestamp: new Date(),
          processingTime: Date.now() - startTime
        };
      }

      const response = await axios.get(
        'https://api.abuseipdb.com/api/v2/check',
        {
          headers: {
            'Key': this.abuseIPDBApiKey,
            'Accept': 'application/json'
          },
          params: {
            ipAddress,
            maxAgeInDays: 90,
            verbose: true
          }
        }
      );

      const data = response.data.data;
      const abuseScore = data.abuseConfidenceScore;
      let verdict = 'SAFE';

      if (abuseScore > 75) verdict = 'MALICIOUS';
      else if (abuseScore > 50) verdict = 'SUSPICIOUS';
      else if (abuseScore > 25) verdict = 'QUESTIONABLE';

      return {
        source: 'AbuseIPDB',
        verdict,
        details: {
          ipAddress,
          abuseConfidenceScore: abuseScore,
          totalReports: data.totalReports,
          numDistinctUsers: data.numDistinctUsers,
          lastReportedAt: data.lastReportedAt,
          isWhitelisted: data.isWhitelisted,
          countryCode: data.countryCode,
          usageType: data.usageType,
          isp: data.isp,
          domain: data.domain
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error('AbuseIPDB check error:', error.message);
      return {
        source: 'AbuseIPDB',
        verdict: 'ERROR',
        details: { error: error.message },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Check PhishTank
   */
  private async checkPhishTank(url: string): Promise<ThreatIntelResult> {
    const startTime = Date.now();

    try {
      // PhishTank checkurl API - using public endpoint
      const formData = new URLSearchParams();
      formData.append('url', url);
      formData.append('format', 'json');
      formData.append('app_key', process.env.PHISHTANK_API_KEY || 'public');

      const response = await axios.post(
        'https://checkurl.phishtank.com/checkurl/',
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'phishtank/Elara-Platform-1.0'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500 // Accept 4xx responses
        }
      );

      // Handle rate limiting or errors
      if (response.status === 509 || response.status === 429) {
        return {
          source: 'PhishTank',
          verdict: 'UNAVAILABLE',
          details: { message: 'Rate limit exceeded - PhishTank API key recommended' },
          timestamp: new Date(),
          processingTime: Date.now() - startTime,
          error: 'Rate limited'
        };
      }

      const data = response.data;
      let verdict = 'SAFE';

      if (data.results && data.results.in_database) {
        if (data.results.valid) {
          verdict = 'MALICIOUS';
        }
      }

      return {
        source: 'PhishTank',
        verdict,
        details: {
          inDatabase: data.results?.in_database || false,
          verified: data.results?.verified || false,
          validPhish: data.results?.valid || false,
          phishId: data.results?.phish_id,
          submittedAt: data.results?.submitted_at,
          verifiedAt: data.results?.verified_at,
          phishDetailPage: data.results?.phish_detail_page
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      // PhishTank public endpoint has strict rate limits
      logger.warn('PhishTank check failed:', error.response?.status || error.message);
      return {
        source: 'PhishTank',
        verdict: 'UNAVAILABLE',
        details: {
          message: error.response?.status === 509
            ? 'Rate limit exceeded - configure PHISHTANK_API_KEY for higher limits'
            : 'Service temporarily unavailable'
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        error: error.response?.status === 509 ? 'Rate limited' : 'Service unavailable'
      };
    }
  }

  /**
   * Check URLhaus (abuse.ch)
   */
  private async checkURLhaus(url: string): Promise<ThreatIntelResult> {
    const startTime = Date.now();

    try {
      const formData = new URLSearchParams();
      formData.append('url', url);

      const response = await axios.post(
        'https://urlhaus-api.abuse.ch/v1/url/',
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Elara-Platform/1.0'
          },
          timeout: 10000
        }
      );

      const data = response.data;
      let verdict = 'SAFE';

      if (data.query_status === 'ok') {
        verdict = 'MALICIOUS';
      } else if (data.query_status === 'no_results') {
        verdict = 'SAFE';
      } else if (data.query_status === 'invalid_url') {
        verdict = 'UNKNOWN';
      }

      return {
        source: 'URLhaus',
        verdict,
        details: {
          queryStatus: data.query_status,
          found: data.query_status === 'ok',
          urlStatus: data.url_status,
          threat: data.threat,
          tags: data.tags || [],
          dateAdded: data.date_added,
          reporter: data.reporter,
          urlhausReference: data.urlhaus_reference
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error('URLhaus check error:', error.response?.data || error.message);
      return {
        source: 'URLhaus',
        verdict: 'UNAVAILABLE',
        details: {
          message: 'Service temporarily unavailable',
          error: error.message
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Resolve hostname to IP address
   */
  private async resolveHostname(hostname: string): Promise<string | null> {
    try {
      const dns = await import('dns/promises');
      const addresses = await dns.resolve4(hostname);
      return addresses[0] || null;
    } catch (error) {
      logger.error('DNS resolution error:', error);
      return null;
    }
  }

  /**
   * Get IP information for network analysis
   */
  async getIPInformation(ip: string): Promise<any> {
    try {
      // Use ip-api.com for geolocation (free, no key required)
      const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`);

      if (response.data.status === 'success') {
        return {
          ip: response.data.query,
          country: response.data.country,
          countryCode: response.data.countryCode,
          region: response.data.regionName,
          city: response.data.city,
          isp: response.data.isp,
          org: response.data.org,
          as: response.data.as,
          asname: response.data.asname,
          isProxy: response.data.proxy,
          isHosting: response.data.hosting,
          isMobile: response.data.mobile,
          timezone: response.data.timezone,
          lat: response.data.lat,
          lon: response.data.lon
        };
      }

      return null;
    } catch (error: any) {
      logger.error('IP geolocation error:', error.message);
      return null;
    }
  }

  /**
   * PHASE 2: Check SURBL (Spam URI Realtime Blocklists)
   * Free DNS-based query for URL reputation
   */
  async checkSURBL(domain: string): Promise<ThreatIntelResult> {
    const startTime = Date.now();

    try {
      const dns = await import('dns/promises');

      // SURBL uses multi.surbl.org for combined blocklist
      const queryDomain = `${domain}.multi.surbl.org`;

      try {
        const addresses = await dns.resolve4(queryDomain);

        // If we get a response, the domain is listed (blocked)
        if (addresses && addresses.length > 0) {
          // Decode the response code
          const code = addresses[0].split('.')[3];
          const categories = [];

          if (code === '2') categories.push('spam');
          if (code === '4') categories.push('phishing');
          if (code === '8') categories.push('malware');
          if (code === '16') categories.push('botnet');

          return {
            source: 'SURBL',
            verdict: 'MALICIOUS',
            details: {
              listed: true,
              responseCode: code,
              categories,
              message: `Domain listed in SURBL: ${categories.join(', ')}`
            },
            timestamp: new Date(),
            processingTime: Date.now() - startTime
          };
        }
      } catch (error: any) {
        // NXDOMAIN means not listed (safe)
        if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
          return {
            source: 'SURBL',
            verdict: 'SAFE',
            details: {
              listed: false,
              message: 'Domain not found in SURBL blocklists'
            },
            timestamp: new Date(),
            processingTime: Date.now() - startTime
          };
        }
        throw error;
      }

      return {
        source: 'SURBL',
        verdict: 'SAFE',
        details: { listed: false },
        timestamp: new Date(),
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error('SURBL check error:', error.message);
      return {
        source: 'SURBL',
        verdict: 'UNAVAILABLE',
        details: { error: error.message },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * PHASE 2: Check OpenPhish
   * Free phishing intelligence feed
   */
  async checkOpenPhish(url: string): Promise<ThreatIntelResult> {
    const startTime = Date.now();

    try {
      // OpenPhish provides a free feed that we can check against
      // Note: Full feed download required for comprehensive checking
      // This is a simplified check using their API-like endpoint

      const response = await axios.get('https://openphish.com/feed.txt', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Elara-Platform/1.0'
        }
      });

      const phishList = response.data.split('\n').map((line: string) => line.trim());
      const isListed = phishList.some((phishUrl: string) =>
        phishUrl === url || url.includes(phishUrl) || phishUrl.includes(url)
      );

      return {
        source: 'OpenPhish',
        verdict: isListed ? 'MALICIOUS' : 'SAFE',
        details: {
          found: isListed,
          totalEntries: phishList.length,
          message: isListed ? 'URL found in OpenPhish feed' : 'URL not in OpenPhish feed'
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime
      };
    } catch (error: any) {
      logger.error('OpenPhish check error:', error.message);
      return {
        source: 'OpenPhish',
        verdict: 'UNAVAILABLE',
        details: {
          message: 'Service temporarily unavailable',
          error: error.message
        },
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * PHASE 2: Check BGPView for ASN information
   * Free API for AS number and network info
   */
  async checkBGPView(ip: string): Promise<any> {
    try {
      const response = await axios.get(`https://api.bgpview.io/ip/${ip}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Elara-Platform/1.0'
        }
      });

      const data = response.data.data;

      return {
        ip,
        asn: data.prefixes?.[0]?.asn?.asn,
        asnName: data.prefixes?.[0]?.asn?.name,
        asnDescription: data.prefixes?.[0]?.asn?.description,
        asnCountry: data.prefixes?.[0]?.asn?.country_code,
        prefix: data.prefixes?.[0]?.prefix,
        prefixName: data.prefixes?.[0]?.name,
        prefixDescription: data.prefixes?.[0]?.description,
        rir: data.rir_allocation?.rir_name
      };
    } catch (error: any) {
      logger.error('BGPView check error:', error.message);
      return null;
    }
  }

  /**
   * PHASE 2: Check Shodan InternetDB
   * Free service for port and vulnerability data
   */
  async checkShodanInternetDB(ip: string): Promise<any> {
    try {
      const response = await axios.get(`https://internetdb.shodan.io/${ip}`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Elara-Platform/1.0'
        }
      });

      const data = response.data;

      return {
        ip,
        ports: data.ports || [],
        cpes: data.cpes || [],
        hostnames: data.hostnames || [],
        tags: data.tags || [],
        vulns: data.vulns || [],
        hasOpenPorts: (data.ports || []).length > 0,
        hasVulnerabilities: (data.vulns || []).length > 0,
        riskScore: this.calculateShodanRiskScore(data)
      };
    } catch (error: any) {
      // 404 means no data available (which is actually good - no known issues)
      if (error.response?.status === 404) {
        return {
          ip,
          ports: [],
          cpes: [],
          hostnames: [],
          tags: [],
          vulns: [],
          hasOpenPorts: false,
          hasVulnerabilities: false,
          riskScore: 0,
          message: 'No data available (good sign)'
        };
      }

      logger.error('Shodan InternetDB check error:', error.message);
      return null;
    }
  }

  /**
   * Calculate risk score from Shodan data
   */
  private calculateShodanRiskScore(data: any): number {
    let score = 0;

    // Open ports increase risk
    const ports = data.ports || [];
    score += ports.length * 2;

    // Vulnerabilities are high risk
    const vulns = data.vulns || [];
    score += vulns.length * 10;

    // Suspicious tags
    const tags = data.tags || [];
    const suspiciousTags = ['malware', 'compromised', 'botnet', 'tor', 'proxy'];
    tags.forEach((tag: string) => {
      if (suspiciousTags.some(st => tag.toLowerCase().includes(st))) {
        score += 15;
      }
    });

    // Common risky ports
    const riskyPorts = [21, 23, 135, 139, 445, 1433, 3306, 3389, 5900];
    ports.forEach((port: number) => {
      if (riskyPorts.includes(port)) {
        score += 5;
      }
    });

    return score;
  }
}

export const externalThreatIntelService = new ExternalThreatIntelligenceService();
