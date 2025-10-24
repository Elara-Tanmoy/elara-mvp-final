import axios from 'axios';
import https from 'https';
import tls from 'tls';
import { logger } from '../../config/logger.js';

export interface NetworkSecurityResult {
  score: number;
  maxScore: number;
  findings: Finding[];
  evidence: {
    hasSSL?: boolean;
    sslValid?: boolean;
    sslGrade?: string;
    hstsEnabled?: boolean;
    ipAddress?: string;
    ipReputation?: number;
    asnInfo?: any;
    openPorts?: number[];
    vulnerabilities?: string[];
  };
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  points: number;
  source: string;
}

/**
 * RYAN RAG - Network Security Analysis (45 points max)
 * Analyzes SSL/TLS, IP reputation, ASN, and network infrastructure
 */
export async function analyzeNetworkSecurity(url: string, hostname: string): Promise<NetworkSecurityResult> {
  const findings: Finding[] = [];
  let score = 0;
  const maxScore = 45;
  const evidence: any = {};

  try {
    logger.info(`[Network Security] Analyzing ${hostname}`);

    // 1. SSL/TLS Analysis (0-15 points)
    await analyzeSSL(url, hostname, findings, evidence, (pts) => { score += pts; });

    // 2. HSTS Header Check (8 points)
    await checkHSTS(url, findings, evidence, (pts) => { score += pts; });

    // 3. IP Reputation via AbuseIPDB (10 points)
    await checkIPReputation(hostname, findings, evidence, (pts) => { score += pts; });

    // 4. ASN Analysis via BGPView (5 points)
    await analyzeASN(hostname, findings, evidence, (pts) => { score += pts; });

    // 5. Open Ports via Shodan InternetDB (7 points)
    await checkOpenPorts(hostname, findings, evidence, (pts) => { score += pts; });

    logger.info(`[Network Security] Complete: ${score}/${maxScore} points`);

    return {
      score,
      maxScore,
      findings,
      evidence
    };

  } catch (error) {
    logger.error('[Network Security] Error:', error);
    return {
      score: 0,
      maxScore,
      findings: [{
        severity: 'info',
        message: 'Network security analysis could not be completed',
        points: 0,
        source: 'System'
      }],
      evidence: {}
    };
  }
}

async function analyzeSSL(
  url: string,
  hostname: string,
  findings: Finding[],
  evidence: any,
  addScore: (pts: number) => void
): Promise<void> {
  try {
    const urlObj = new URL(url);

    if (urlObj.protocol === 'http:') {
      evidence.hasSSL = false;
      addScore(15);
      findings.push({
        severity: 'critical',
        message: 'No SSL/TLS encryption - data transmitted in plain text',
        points: 15,
        source: 'SSL Check'
      });
      return;
    }

    evidence.hasSSL = true;

    // Check certificate validity
    return new Promise((resolve) => {
      const options = {
        host: hostname,
        port: 443,
        method: 'GET',
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        const cert = (res.socket as any).getPeerCertificate();

        if (!cert || Object.keys(cert).length === 0) {
          evidence.sslValid = false;
          addScore(12);
          findings.push({
            severity: 'high',
            message: 'Invalid or missing SSL certificate',
            points: 12,
            source: 'SSL Check'
          });
        } else {
          const validTo = new Date(cert.valid_to);
          const now = new Date();

          if (validTo < now) {
            evidence.sslValid = false;
            addScore(12);
            findings.push({
              severity: 'high',
              message: 'SSL certificate has expired',
              points: 12,
              source: 'SSL Check'
            });
          } else {
            evidence.sslValid = true;

            // Check for weak ciphers
            const socket = res.socket as tls.TLSSocket;
            const cipher = socket.getCipher();

            if (cipher && cipher.name.includes('RC4') || cipher?.name.includes('DES')) {
              addScore(6);
              findings.push({
                severity: 'medium',
                message: `Weak cipher suite detected: ${cipher.name}`,
                points: 6,
                source: 'SSL Check'
              });
            } else {
              findings.push({
                severity: 'info',
                message: 'Valid SSL certificate with strong encryption',
                points: 0,
                source: 'SSL Check'
              });
            }
          }
        }
        resolve();
      });

      req.on('error', () => {
        evidence.sslValid = false;
        addScore(12);
        findings.push({
          severity: 'high',
          message: 'SSL connection failed - certificate issues',
          points: 12,
          source: 'SSL Check'
        });
        resolve();
      });

      req.setTimeout(3000, () => {
        req.destroy();
        resolve();
      });

      req.end();
    });

  } catch (error) {
    logger.warn('[Network Security] SSL check failed:', error);
  }
}

async function checkHSTS(
  url: string,
  findings: Finding[],
  evidence: any,
  addScore: (pts: number) => void
): Promise<void> {
  try {
    const response = await axios.head(url, {
      timeout: 3000,
      validateStatus: () => true,
      maxRedirects: 0
    });

    const hstsHeader = response.headers['strict-transport-security'];
    evidence.hstsEnabled = !!hstsHeader;

    if (!hstsHeader) {
      addScore(8);
      findings.push({
        severity: 'medium',
        message: 'HSTS header not present - vulnerable to SSL stripping attacks',
        points: 8,
        source: 'HSTS Check'
      });
    } else {
      findings.push({
        severity: 'info',
        message: 'HSTS enabled - forces secure connections',
        points: 0,
        source: 'HSTS Check'
      });
    }
  } catch (error) {
    logger.warn('[Network Security] HSTS check failed:', error);
  }
}

async function checkIPReputation(
  hostname: string,
  findings: Finding[],
  evidence: any,
  addScore: (pts: number) => void
): Promise<void> {
  try {
    const dns = await import('dns').then(m => m.promises);
    const addresses = await dns.resolve4(hostname);
    evidence.ipAddress = addresses[0];

    const apiKey = process.env.ABUSEIPDB_API_KEY;
    if (!apiKey) {
      logger.warn('[Network Security] AbuseIPDB API key not configured');
      return;
    }

    const response = await axios.get(
      `https://api.abuseipdb.com/api/v2/check`,
      {
        headers: { 'Key': apiKey, 'Accept': 'application/json' },
        params: { ipAddress: addresses[0], maxAgeInDays: 90 },
        timeout: 3000
      }
    );

    const abuseScore = response.data.data.abuseConfidenceScore;
    evidence.ipReputation = abuseScore;

    if (abuseScore >= 75) {
      addScore(10);
      findings.push({
        severity: 'critical',
        message: `IP has high abuse score: ${abuseScore}% (reported for malicious activity)`,
        points: 10,
        source: 'AbuseIPDB'
      });
    } else if (abuseScore >= 50) {
      addScore(7);
      findings.push({
        severity: 'high',
        message: `IP has moderate abuse score: ${abuseScore}%`,
        points: 7,
        source: 'AbuseIPDB'
      });
    } else if (abuseScore >= 25) {
      addScore(4);
      findings.push({
        severity: 'medium',
        message: `IP has some abuse reports: ${abuseScore}%`,
        points: 4,
        source: 'AbuseIPDB'
      });
    } else {
      findings.push({
        severity: 'info',
        message: `IP reputation clean: ${abuseScore}% abuse score`,
        points: 0,
        source: 'AbuseIPDB'
      });
    }
  } catch (error) {
    logger.warn('[Network Security] IP reputation check failed:', error);
  }
}

async function analyzeASN(
  hostname: string,
  findings: Finding[],
  evidence: any,
  addScore: (pts: number) => void
): Promise<void> {
  try {
    const dns = await import('dns').then(m => m.promises);
    const addresses = await dns.resolve4(hostname);

    // BGPView doesn't need API key
    const response = await axios.get(
      `https://api.bgpview.io/ip/${addresses[0]}`,
      { timeout: 3000 }
    );

    const asnData = response.data.data;
    evidence.asnInfo = {
      asn: asnData.prefixes?.[0]?.asn?.asn,
      name: asnData.prefixes?.[0]?.asn?.name,
      country: asnData.prefixes?.[0]?.asn?.country_code
    };

    // Check for suspicious hosting providers
    const suspiciousHosts = ['bulletproof', 'offshore', 'anonymous'];
    const asnName = (evidence.asnInfo.name || '').toLowerCase();

    if (suspiciousHosts.some(sh => asnName.includes(sh))) {
      addScore(5);
      findings.push({
        severity: 'medium',
        message: `Hosted on suspicious network: ${evidence.asnInfo.name}`,
        points: 5,
        source: 'BGPView'
      });
    } else {
      findings.push({
        severity: 'info',
        message: `Hosted by: ${evidence.asnInfo.name} (${evidence.asnInfo.country})`,
        points: 0,
        source: 'BGPView'
      });
    }
  } catch (error) {
    logger.warn('[Network Security] ASN analysis failed:', error);
  }
}

async function checkOpenPorts(
  hostname: string,
  findings: Finding[],
  evidence: any,
  addScore: (pts: number) => void
): Promise<void> {
  try {
    const dns = await import('dns').then(m => m.promises);
    const addresses = await dns.resolve4(hostname);

    // Shodan InternetDB is free, no API key needed
    const response = await axios.get(
      `https://internetdb.shodan.io/${addresses[0]}`,
      { timeout: 3000, validateStatus: () => true }
    );

    if (response.status === 200 && response.data.ports) {
      evidence.openPorts = response.data.ports;
      evidence.vulnerabilities = response.data.vulns || [];

      const dangerousPorts = [21, 23, 3389, 5900]; // FTP, Telnet, RDP, VNC
      const foundDangerous = evidence.openPorts.filter((p: number) =>
        dangerousPorts.includes(p)
      );

      if (foundDangerous.length > 0) {
        addScore(7);
        findings.push({
          severity: 'high',
          message: `Dangerous ports open: ${foundDangerous.join(', ')}`,
          points: 7,
          source: 'Shodan InternetDB'
        });
      } else if (evidence.openPorts.length > 10) {
        addScore(4);
        findings.push({
          severity: 'medium',
          message: `Many open ports detected: ${evidence.openPorts.length}`,
          points: 4,
          source: 'Shodan InternetDB'
        });
      } else {
        findings.push({
          severity: 'info',
          message: `${evidence.openPorts.length} ports detected`,
          points: 0,
          source: 'Shodan InternetDB'
        });
      }

      if (evidence.vulnerabilities.length > 0) {
        findings.push({
          severity: 'info',
          message: `Known vulnerabilities: ${evidence.vulnerabilities.join(', ')}`,
          points: 0,
          source: 'Shodan InternetDB'
        });
      }
    }
  } catch (error) {
    logger.warn('[Network Security] Port scan failed:', error);
  }
}
