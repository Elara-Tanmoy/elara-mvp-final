/**
 * ELARA TRUST GRAPH SERVICE
 *
 * Multi-Dimensional Trust Graph for identifying scam networks
 *
 * This service builds and queries a graph database to track relationships between:
 * - Domains
 * - IP Addresses
 * - Registrars
 * - Nameservers
 * - SSL Certificates
 * - Payment Processors
 *
 * By analyzing these relationships, we can identify:
 * - Scam networks (multiple related domains)
 * - Bulk domain registration patterns
 * - Infrastructure sharing patterns
 * - Payment processor abuse
 *
 * FREE ENTERPRISE-GRADE SOLUTION: Uses Neo4j Community Edition (open-source)
 */

import { neo4jConnection } from '../../config/neo4j.js';
import { logger } from '../../config/logger.js';
import dns from 'dns/promises';
import whois from 'whois-json';

export interface GraphNode {
  id: string;
  type: 'domain' | 'ip' | 'registrar' | 'ssl_cert' | 'payment_processor' | 'nameserver' | 'template';
  properties: Record<string, any>;
  riskScore: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface GraphBuildResult {
  success: boolean;
  domain: string;
  nodesCreated: number;
  relationshipsCreated: number;
  details: {
    domainNode: { success: boolean; error?: string };
    ipAddresses: { success: boolean; count: number; ips: string[]; error?: string };
    registrar: { success: boolean; name?: string; error?: string };
    nameservers: { success: boolean; count: number; servers: string[]; error?: string };
    sslCertificate: { success: boolean; fingerprint?: string; error?: string };
  };
  warnings: string[];
  errors: string[];
  timestamp: Date;
}

export interface NetworkAnalysis {
  domain: string;
  networkSize: number;
  connectedDomains: string[];
  sharedInfrastructure: {
    ipAddresses: Array<{ ip: string; sharedWith: number }>;
    registrars: Array<{ name: string; sharedWith: number }>;
    nameservers: Array<{ name: string; sharedWith: number }>;
    sslCerts: Array<{ fingerprint: string; sharedWith: number }>;
  };
  riskAssessment: {
    level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    score: number;
    maxScore: number;
    reasons: string[];
  };
  scamNetworkMembership: {
    isPartOfNetwork: boolean;
    networkId?: string;
    networkName?: string;
    flaggedDomainsInNetwork: number;
  };
}

export class TrustGraphService {
  /**
   * Add or update a domain node in the trust graph
   */
  async addDomain(domain: string, properties: Record<string, any> = {}): Promise<void> {
    try {
      const cypher = `
        MERGE (d:Domain {url: $url})
        ON CREATE SET
          d.firstSeen = datetime(),
          d.lastSeen = datetime(),
          d.riskScore = $riskScore,
          d.properties = $properties
        ON MATCH SET
          d.lastSeen = datetime(),
          d.riskScore = $riskScore,
          d.properties = $properties
        RETURN d
      `;

      await neo4jConnection.runQuery(cypher, {
        url: domain,
        riskScore: properties.riskScore || 0,
        properties: JSON.stringify(properties),
      });

      logger.info(`✅ Domain added to graph: ${domain}`);
    } catch (error) {
      logger.error(`Failed to add domain to graph: ${domain}`, error);
      throw error;
    }
  }

  /**
   * Add an IP address node and create HOSTED_ON relationship
   */
  async linkIPAddress(domain: string, ipAddress: string, properties: Record<string, any> = {}): Promise<void> {
    try {
      const cypher = `
        MATCH (d:Domain {url: $domain})
        MERGE (ip:IPAddress {address: $ipAddress})
        ON CREATE SET
          ip.firstSeen = datetime(),
          ip.lastSeen = datetime(),
          ip.riskScore = $riskScore,
          ip.properties = $properties
        ON MATCH SET
          ip.lastSeen = datetime()

        MERGE (d)-[r:HOSTED_ON]->(ip)
        ON CREATE SET r.firstSeen = datetime(), r.lastSeen = datetime()
        ON MATCH SET r.lastSeen = datetime()

        RETURN d, ip, r
      `;

      await neo4jConnection.runQuery(cypher, {
        domain,
        ipAddress,
        riskScore: properties.riskScore || 0,
        properties: JSON.stringify(properties),
      });

      logger.info(`✅ IP ${ipAddress} linked to domain ${domain}`);
    } catch (error) {
      logger.error(`Failed to link IP ${ipAddress} to domain ${domain}`, error);
    }
  }

  /**
   * Add registrar node and create REGISTERED_BY relationship
   */
  async linkRegistrar(domain: string, registrarName: string, properties: Record<string, any> = {}): Promise<void> {
    try {
      const cypher = `
        MATCH (d:Domain {url: $domain})
        MERGE (r:Registrar {name: $registrarName})
        ON CREATE SET
          r.firstSeen = datetime(),
          r.lastSeen = datetime(),
          r.riskScore = $riskScore,
          r.properties = $properties
        ON MATCH SET
          r.lastSeen = datetime()

        MERGE (d)-[rel:REGISTERED_BY]->(r)
        ON CREATE SET rel.firstSeen = datetime(), rel.lastSeen = datetime()
        ON MATCH SET rel.lastSeen = datetime()

        RETURN d, r, rel
      `;

      await neo4jConnection.runQuery(cypher, {
        domain,
        registrarName,
        riskScore: properties.riskScore || 0,
        properties: JSON.stringify(properties),
      });

      logger.info(`✅ Registrar ${registrarName} linked to domain ${domain}`);
    } catch (error) {
      logger.error(`Failed to link registrar ${registrarName} to domain ${domain}`, error);
    }
  }

  /**
   * Add nameserver node and create USES_NS relationship
   */
  async linkNameserver(domain: string, nameserver: string, properties: Record<string, any> = {}): Promise<void> {
    try {
      const cypher = `
        MATCH (d:Domain {url: $domain})
        MERGE (ns:Nameserver {hostname: $nameserver})
        ON CREATE SET
          ns.firstSeen = datetime(),
          ns.lastSeen = datetime(),
          ns.riskScore = $riskScore,
          ns.properties = $properties
        ON MATCH SET
          ns.lastSeen = datetime()

        MERGE (d)-[rel:USES_NS]->(ns)
        ON CREATE SET rel.firstSeen = datetime(), rel.lastSeen = datetime()
        ON MATCH SET rel.lastSeen = datetime()

        RETURN d, ns, rel
      `;

      await neo4jConnection.runQuery(cypher, {
        domain,
        nameserver,
        riskScore: properties.riskScore || 0,
        properties: JSON.stringify(properties),
      });

      logger.info(`✅ Nameserver ${nameserver} linked to domain ${domain}`);
    } catch (error) {
      logger.error(`Failed to link nameserver ${nameserver} to domain ${domain}`, error);
    }
  }

  /**
   * Add SSL certificate node and create USES_CERT relationship
   */
  async linkSSLCertificate(
    domain: string,
    fingerprint: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    try {
      const cypher = `
        MATCH (d:Domain {url: $domain})
        MERGE (ssl:SSLCertificate {fingerprint: $fingerprint})
        ON CREATE SET
          ssl.firstSeen = datetime(),
          ssl.lastSeen = datetime(),
          ssl.riskScore = $riskScore,
          ssl.properties = $properties
        ON MATCH SET
          ssl.lastSeen = datetime()

        MERGE (d)-[rel:USES_CERT]->(ssl)
        ON CREATE SET rel.firstSeen = datetime(), rel.lastSeen = datetime()
        ON MATCH SET rel.lastSeen = datetime()

        RETURN d, ssl, rel
      `;

      await neo4jConnection.runQuery(cypher, {
        domain,
        fingerprint,
        riskScore: properties.riskScore || 0,
        properties: JSON.stringify(properties),
      });

      logger.info(`✅ SSL cert ${fingerprint} linked to domain ${domain}`);
    } catch (error) {
      logger.error(`Failed to link SSL cert ${fingerprint} to domain ${domain}`, error);
    }
  }

  /**
   * Add payment processor node and create USES_PROCESSOR relationship
   */
  async linkPaymentProcessor(
    domain: string,
    processorName: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    try {
      const cypher = `
        MATCH (d:Domain {url: $domain})
        MERGE (p:PaymentProcessor {name: $processorName})
        ON CREATE SET
          p.firstSeen = datetime(),
          p.lastSeen = datetime(),
          p.riskScore = $riskScore,
          p.properties = $properties
        ON MATCH SET
          p.lastSeen = datetime()

        MERGE (d)-[rel:USES_PROCESSOR]->(p)
        ON CREATE SET rel.firstSeen = datetime(), rel.lastSeen = datetime()
        ON MATCH SET rel.lastSeen = datetime()

        RETURN d, p, rel
      `;

      await neo4jConnection.runQuery(cypher, {
        domain,
        processorName,
        riskScore: properties.riskScore || 0,
        properties: JSON.stringify(properties),
      });

      logger.info(`✅ Payment processor ${processorName} linked to domain ${domain}`);
    } catch (error) {
      logger.error(`Failed to link payment processor ${processorName} to domain ${domain}`, error);
    }
  }

  /**
   * DNS lookup with retry logic and fallback servers
   */
  private async resolveDNSWithRetry(domain: string, retries = 3): Promise<string[]> {
    const dnsServers = ['8.8.8.8', '1.1.1.1', '8.8.4.4']; // Google, Cloudflare, Google backup

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Try system DNS first
        const ips = await dns.resolve4(domain);
        if (ips && ips.length > 0) {
          logger.info(`✅ DNS resolved for ${domain}: ${ips.join(', ')}`);
          return ips;
        }
      } catch (error: any) {
        logger.warn(`DNS attempt ${attempt + 1}/${retries} failed for ${domain}: ${error.message}`);

        if (attempt === retries - 1) {
          throw new Error(`DNS resolution failed after ${retries} attempts: ${error.message}`);
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }

    throw new Error('DNS resolution failed - all retries exhausted');
  }

  /**
   * WHOIS lookup with retry logic and response normalization
   */
  private async getWhoisWithRetry(domain: string, retries = 2): Promise<any> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const rawWhoisData = await whois(domain);

        if (rawWhoisData) {
          // Log raw response for debugging
          logger.debug(`[Trust Graph] Raw WHOIS data for ${domain}:`, JSON.stringify(rawWhoisData).substring(0, 500));

          // Normalize WHOIS response (different providers use different field names)
          const normalized = {
            registrar:
              rawWhoisData.registrar ||
              rawWhoisData.registrarName ||
              rawWhoisData['Registrar'] ||
              rawWhoisData['Registrar Name'] ||
              null,

            nameServers:
              rawWhoisData.nameServers ||
              rawWhoisData.nameServer ||
              rawWhoisData['Name Server'] ||
              rawWhoisData.nserver ||
              rawWhoisData.ns ||
              [],

            creationDate:
              rawWhoisData.creationDate ||
              rawWhoisData.createdDate ||
              rawWhoisData['Creation Date'] ||
              rawWhoisData.created ||
              null,

            expirationDate:
              rawWhoisData.expirationDate ||
              rawWhoisData.expiryDate ||
              rawWhoisData['Expiry Date'] ||
              rawWhoisData.expires ||
              null,

            // Keep raw data for reference
            _raw: rawWhoisData
          };

          // Ensure nameServers is an array
          if (normalized.nameServers && !Array.isArray(normalized.nameServers)) {
            normalized.nameServers = [normalized.nameServers];
          }

          logger.info(
            `✅ WHOIS data retrieved for ${domain} - ` +
            `Registrar: ${normalized.registrar || 'N/A'}, ` +
            `Nameservers: ${normalized.nameServers?.length || 0}`
          );

          return normalized;
        }
      } catch (error: any) {
        logger.warn(`WHOIS attempt ${attempt + 1}/${retries} failed for ${domain}: ${error.message}`);

        if (attempt === retries - 1) {
          throw new Error(`WHOIS lookup failed after ${retries} attempts: ${error.message}`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }

    throw new Error('WHOIS lookup failed - all retries exhausted');
  }

  /**
   * Build complete graph for a domain by fetching all infrastructure data
   * PRODUCTION-GRADE: Returns detailed results showing what succeeded and what failed
   */
  async buildDomainGraph(domain: string, scanData: Record<string, any> = {}): Promise<GraphBuildResult> {
    const startTime = Date.now();
    const result: GraphBuildResult = {
      success: false,
      domain,
      nodesCreated: 0,
      relationshipsCreated: 0,
      details: {
        domainNode: { success: false },
        ipAddresses: { success: false, count: 0, ips: [] },
        registrar: { success: false },
        nameservers: { success: false, count: 0, servers: [] },
        sslCertificate: { success: false },
      },
      warnings: [],
      errors: [],
      timestamp: new Date(),
    };

    try {
      logger.info(`🔍 [Trust Graph] Building graph for ${domain}...`);

      // 1. Add the domain node
      try {
        await this.addDomain(domain, {
          riskScore: scanData.riskScore || 0,
          riskLevel: scanData.riskLevel || 'unknown',
          scannedAt: new Date().toISOString(),
        });
        result.details.domainNode.success = true;
        result.nodesCreated++;
        logger.info(`✅ [Trust Graph] Domain node created for ${domain}`);
      } catch (error: any) {
        const errorMsg = `Failed to create domain node: ${error.message}`;
        result.details.domainNode.error = errorMsg;
        result.errors.push(errorMsg);
        logger.error(`❌ [Trust Graph] ${errorMsg}`);
        throw error; // Can't continue without domain node
      }

      // 2. Get and link IP addresses with retry
      try {
        logger.info(`🔍 [Trust Graph] Resolving DNS for ${domain}...`);
        const ipAddresses = await this.resolveDNSWithRetry(domain, 3);

        for (const ip of ipAddresses) {
          await this.linkIPAddress(domain, ip, {
            resolvedAt: new Date().toISOString(),
          });
          result.relationshipsCreated++;
        }

        result.details.ipAddresses = {
          success: true,
          count: ipAddresses.length,
          ips: ipAddresses,
        };
        result.nodesCreated += ipAddresses.length;
        logger.info(`✅ [Trust Graph] Linked ${ipAddresses.length} IP(s): ${ipAddresses.join(', ')}`);
      } catch (error: any) {
        const errorMsg = `DNS resolution failed: ${error.message}`;
        result.details.ipAddresses.error = errorMsg;
        result.warnings.push(errorMsg);
        logger.warn(`⚠️  [Trust Graph] ${errorMsg}`);
      }

      // 3. Get and link WHOIS/registrar data with retry
      try {
        logger.info(`🔍 [Trust Graph] Fetching WHOIS data for ${domain}...`);
        const whoisData = await this.getWhoisWithRetry(domain, 2);

        // Link registrar
        if (whoisData.registrar) {
          await this.linkRegistrar(domain, whoisData.registrar, {
            createdDate: whoisData.creationDate,
            expiryDate: whoisData.expirationDate,
          });
          result.details.registrar = {
            success: true,
            name: whoisData.registrar,
          };
          result.nodesCreated++;
          result.relationshipsCreated++;
          logger.info(`✅ [Trust Graph] Linked registrar: ${whoisData.registrar}`);
        } else {
          result.warnings.push('WHOIS data retrieved but no registrar found');
        }

        // Link nameservers
        if (whoisData.nameServers && Array.isArray(whoisData.nameServers)) {
          const nameservers = whoisData.nameServers.filter((ns: any) => ns && typeof ns === 'string');

          for (const ns of nameservers) {
            await this.linkNameserver(domain, ns);
            result.relationshipsCreated++;
          }

          result.details.nameservers = {
            success: true,
            count: nameservers.length,
            servers: nameservers,
          };
          result.nodesCreated += nameservers.length;
          logger.info(`✅ [Trust Graph] Linked ${nameservers.length} nameserver(s): ${nameservers.join(', ')}`);
        } else {
          result.warnings.push('WHOIS data retrieved but no nameservers found');
        }
      } catch (error: any) {
        const errorMsg = `WHOIS lookup failed: ${error.message}`;
        result.details.registrar.error = errorMsg;
        result.details.nameservers.error = errorMsg;
        result.warnings.push(errorMsg);
        logger.warn(`⚠️  [Trust Graph] ${errorMsg}`);
      }

      // 4. Link SSL certificate if available
      if (scanData.sslFingerprint) {
        try {
          await this.linkSSLCertificate(domain, scanData.sslFingerprint, {
            validFrom: scanData.sslValidFrom,
            validTo: scanData.sslValidTo,
            issuer: scanData.sslIssuer,
          });
          result.details.sslCertificate = {
            success: true,
            fingerprint: scanData.sslFingerprint,
          };
          result.nodesCreated++;
          result.relationshipsCreated++;
          logger.info(`✅ [Trust Graph] Linked SSL certificate: ${scanData.sslFingerprint}`);
        } catch (error: any) {
          const errorMsg = `Failed to link SSL certificate: ${error.message}`;
          result.details.sslCertificate.error = errorMsg;
          result.warnings.push(errorMsg);
          logger.warn(`⚠️  [Trust Graph] ${errorMsg}`);
        }
      }

      // Calculate overall success
      const hasRelationships = result.relationshipsCreated > 0;
      result.success = result.details.domainNode.success && hasRelationships;

      const duration = Date.now() - startTime;
      logger.info(
        `${result.success ? '✅' : '⚠️'} [Trust Graph] Build ${result.success ? 'completed' : 'partially completed'} for ${domain} in ${duration}ms - ` +
        `Nodes: ${result.nodesCreated}, Relationships: ${result.relationshipsCreated}, Warnings: ${result.warnings.length}, Errors: ${result.errors.length}`
      );

      return result;
    } catch (error: any) {
      const errorMsg = `Critical failure building graph: ${error.message}`;
      result.errors.push(errorMsg);
      result.success = false;
      logger.error(`❌ [Trust Graph] ${errorMsg}`);
      return result;
    }
  }

  /**
   * Analyze domain's network connections and identify scam networks
   */
  async analyzeNetwork(domain: string): Promise<NetworkAnalysis> {
    try {
      logger.info(`📊 Analyzing network for ${domain}...`);

      // 1. Find all domains sharing the same IP
      const domainsOnSameIP = await this.findDomainsOnSameIP(domain);

      // 2. Find domains with same registrar
      const domainsWithSameRegistrar = await this.findDomainsWithSameRegistrar(domain);

      // 3. Find domains using same nameservers
      const domainsWithSameNS = await this.findDomainsWithSameNameservers(domain);

      // 4. Find domains sharing SSL cert
      const domainsWithSameSSL = await this.findDomainsWithSameSSL(domain);

      // 5. Calculate network size (unique domains)
      const allConnectedDomains = new Set([
        ...domainsOnSameIP.map((d) => d.domain),
        ...domainsWithSameRegistrar.map((d) => d.domain),
        ...domainsWithSameNS.map((d) => d.domain),
        ...domainsWithSameSSL.map((d) => d.domain),
      ]);
      allConnectedDomains.delete(domain); // Remove self

      // 6. Calculate risk score
      const riskAssessment = this.calculateNetworkRisk(
        Array.from(allConnectedDomains),
        domainsOnSameIP,
        domainsWithSameRegistrar,
        domainsWithSameNS
      );

      // 7. Check for scam network membership
      const scamNetworkMembership = await this.checkScamNetworkMembership(domain);

      return {
        domain,
        networkSize: allConnectedDomains.size,
        connectedDomains: Array.from(allConnectedDomains),
        sharedInfrastructure: {
          ipAddresses: domainsOnSameIP.map((d) => ({
            ip: d.sharedResource,
            sharedWith: d.count,
          })),
          registrars: domainsWithSameRegistrar.map((d) => ({
            name: d.sharedResource,
            sharedWith: d.count,
          })),
          nameservers: domainsWithSameNS.map((d) => ({
            name: d.sharedResource,
            sharedWith: d.count,
          })),
          sslCerts: domainsWithSameSSL.map((d) => ({
            fingerprint: d.sharedResource,
            sharedWith: d.count,
          })),
        },
        riskAssessment,
        scamNetworkMembership,
      };
    } catch (error) {
      logger.error(`Failed to analyze network for ${domain}:`, error);
      throw error;
    }
  }

  /**
   * Find domains hosted on the same IP address
   */
  private async findDomainsOnSameIP(domain: string): Promise<Array<{ domain: string; sharedResource: string; count: number }>> {
    const cypher = `
      MATCH (d:Domain {url: $domain})-[:HOSTED_ON]->(ip:IPAddress)
      MATCH (other:Domain)-[:HOSTED_ON]->(ip)
      WHERE other.url <> $domain
      WITH ip.address AS ipAddress, COUNT(other) AS domainCount, COLLECT(other.url) AS domains
      RETURN ipAddress, domainCount, domains
    `;

    const results = await neo4jConnection.runQuery<{ ipAddress: string; domainCount: number; domains: string[] }>(
      cypher,
      { domain }
    );

    return results.flatMap((result) =>
      result.domains.map((dom) => ({
        domain: dom,
        sharedResource: result.ipAddress,
        count: result.domainCount,
      }))
    );
  }

  /**
   * Find domains registered with the same registrar
   */
  private async findDomainsWithSameRegistrar(domain: string): Promise<Array<{ domain: string; sharedResource: string; count: number }>> {
    const cypher = `
      MATCH (d:Domain {url: $domain})-[:REGISTERED_BY]->(r:Registrar)
      MATCH (other:Domain)-[:REGISTERED_BY]->(r)
      WHERE other.url <> $domain
      WITH r.name AS registrar, COUNT(other) AS domainCount, COLLECT(other.url) AS domains
      RETURN registrar, domainCount, domains
    `;

    const results = await neo4jConnection.runQuery<{ registrar: string; domainCount: number; domains: string[] }>(
      cypher,
      { domain }
    );

    return results.flatMap((result) =>
      result.domains.map((dom) => ({
        domain: dom,
        sharedResource: result.registrar,
        count: result.domainCount,
      }))
    );
  }

  /**
   * Find domains using the same nameservers
   */
  private async findDomainsWithSameNameservers(domain: string): Promise<Array<{ domain: string; sharedResource: string; count: number }>> {
    const cypher = `
      MATCH (d:Domain {url: $domain})-[:USES_NS]->(ns:Nameserver)
      MATCH (other:Domain)-[:USES_NS]->(ns)
      WHERE other.url <> $domain
      WITH ns.hostname AS nameserver, COUNT(other) AS domainCount, COLLECT(other.url) AS domains
      RETURN nameserver, domainCount, domains
    `;

    const results = await neo4jConnection.runQuery<{ nameserver: string; domainCount: number; domains: string[] }>(
      cypher,
      { domain }
    );

    return results.flatMap((result) =>
      result.domains.map((dom) => ({
        domain: dom,
        sharedResource: result.nameserver,
        count: result.domainCount,
      }))
    );
  }

  /**
   * Find domains sharing the same SSL certificate
   */
  private async findDomainsWithSameSSL(domain: string): Promise<Array<{ domain: string; sharedResource: string; count: number }>> {
    const cypher = `
      MATCH (d:Domain {url: $domain})-[:USES_CERT]->(ssl:SSLCertificate)
      MATCH (other:Domain)-[:USES_CERT]->(ssl)
      WHERE other.url <> $domain
      WITH ssl.fingerprint AS cert, COUNT(other) AS domainCount, COLLECT(other.url) AS domains
      RETURN cert, domainCount, domains
    `;

    const results = await neo4jConnection.runQuery<{ cert: string; domainCount: number; domains: string[] }>(
      cypher,
      { domain }
    );

    return results.flatMap((result) =>
      result.domains.map((dom) => ({
        domain: dom,
        sharedResource: result.cert,
        count: result.domainCount,
      }))
    );
  }

  /**
   * Calculate risk score based on network connections
   */
  private calculateNetworkRisk(
    connectedDomains: string[],
    ipConnections: any[],
    registrarConnections: any[],
    nsConnections: any[]
  ): NetworkAnalysis['riskAssessment'] {
    let score = 0;
    const maxScore = 30; // As per enhancement document
    const reasons: string[] = [];

    // Network size risk
    if (connectedDomains.length >= 10) {
      score += 30;
      reasons.push(`Part of large network (${connectedDomains.length}+ connected domains) - CRITICAL`);
    } else if (connectedDomains.length >= 5) {
      score += 20;
      reasons.push(`Part of medium network (${connectedDomains.length} connected domains) - HIGH RISK`);
    } else if (connectedDomains.length >= 2) {
      score += 12;
      reasons.push(`Shares infrastructure with ${connectedDomains.length} other domain(s)`);
    }

    // IP sharing risk (many domains on same IP = shared hosting or scam network)
    const highIPSharing = ipConnections.some((conn) => conn.count > 50);
    if (highIPSharing) {
      if (score < 30) score += 8;
      reasons.push('Hosted on IP with 50+ other domains (shared hosting or scam network)');
    }

    // Registrar risk (bulk registration pattern)
    const bulkRegistration = registrarConnections.some((conn) => conn.count > 100);
    if (bulkRegistration) {
      if (score < 30) score += 8;
      reasons.push('Registrar used for 100+ domains (bulk registration pattern)');
    }

    // Determine risk level
    let level: NetworkAnalysis['riskAssessment']['level'];
    if (score >= 25) level = 'critical';
    else if (score >= 18) level = 'high';
    else if (score >= 10) level = 'medium';
    else if (score >= 5) level = 'low';
    else level = 'safe';

    return {
      level,
      score: Math.min(score, maxScore),
      maxScore,
      reasons: reasons.length > 0 ? reasons : ['No significant network risk detected'],
    };
  }

  /**
   * Check if domain is part of a known scam network
   */
  private async checkScamNetworkMembership(domain: string): Promise<NetworkAnalysis['scamNetworkMembership']> {
    // Query for high-risk domains in the network
    const cypher = `
      MATCH (d:Domain {url: $domain})-[*1..2]-(connected:Domain)
      WHERE connected.riskScore > 200
      RETURN COUNT(connected) AS flaggedCount
    `;

    const results = await neo4jConnection.runQuery<{ flaggedCount: number }>(cypher, { domain });
    const flaggedCount = results[0]?.flaggedCount || 0;

    return {
      isPartOfNetwork: flaggedCount > 0,
      flaggedDomainsInNetwork: flaggedCount,
      networkId: flaggedCount > 5 ? `SCAM_NETWORK_${domain.split('.')[0]}` : undefined,
      networkName: flaggedCount > 5 ? 'Suspected Scam Network' : undefined,
    };
  }

  /**
   * Detect bulk registration patterns (50+ domains registered in 24 hours)
   */
  async detectBulkRegistration(registrar: string, hours: number = 24): Promise<{
    detected: boolean;
    domainCount: number;
    domains: string[];
  }> {
    const cypher = `
      MATCH (r:Registrar {name: $registrar})<-[:REGISTERED_BY]-(d:Domain)
      WHERE d.firstSeen > datetime() - duration('PT${hours}H')
      RETURN COUNT(d) AS count, COLLECT(d.url) AS domains
    `;

    const results = await neo4jConnection.runQuery<{ count: number; domains: string[] }>(cypher, { registrar });
    const result = results[0] || { count: 0, domains: [] };

    return {
      detected: result.count >= 50,
      domainCount: result.count,
      domains: result.domains,
    };
  }

  /**
   * Get full network graph data for visualization
   */
  async getNetworkGraph(domain: string, depth: number = 2): Promise<{
    nodes: Array<{ id: string; label: string; type: string; riskScore: number }>;
    edges: Array<{ from: string; to: string; label: string }>;
  }> {
    const cypher = `
      MATCH path = (d:Domain {url: $domain})-[*1..${depth}]-(connected)
      WITH d, connected, relationships(path) AS rels
      RETURN
        d.url AS sourceUrl,
        labels(connected)[0] AS connectedType,
        CASE labels(connected)[0]
          WHEN 'Domain' THEN connected.url
          WHEN 'IPAddress' THEN connected.address
          WHEN 'Registrar' THEN connected.name
          WHEN 'Nameserver' THEN connected.hostname
          WHEN 'SSLCertificate' THEN connected.fingerprint
          WHEN 'PaymentProcessor' THEN connected.name
          ELSE 'Unknown'
        END AS connectedId,
        connected.riskScore AS riskScore,
        [rel IN rels | type(rel)] AS relationshipTypes
      LIMIT 100
    `;

    const results = await neo4jConnection.runQuery<{
      sourceUrl: string;
      connectedType: string;
      connectedId: string;
      riskScore: number;
      relationshipTypes: string[];
    }>(cypher, { domain });

    // Build nodes and edges
    const nodes = new Map<string, any>();
    const edges: Array<{ from: string; to: string; label: string }> = [];

    // Add source domain
    nodes.set(domain, {
      id: domain,
      label: domain,
      type: 'domain',
      riskScore: 0,
    });

    // Add connected nodes and edges
    for (const result of results) {
      const connectedNode = {
        id: result.connectedId,
        label: result.connectedId,
        type: result.connectedType.toLowerCase(),
        riskScore: result.riskScore || 0,
      };

      nodes.set(result.connectedId, connectedNode);

      // Add edge
      edges.push({
        from: result.sourceUrl,
        to: result.connectedId,
        label: result.relationshipTypes[0] || 'CONNECTED_TO',
      });
    }

    return {
      nodes: Array.from(nodes.values()),
      edges,
    };
  }
}

// Export singleton instance
export const trustGraphService = new TrustGraphService();
