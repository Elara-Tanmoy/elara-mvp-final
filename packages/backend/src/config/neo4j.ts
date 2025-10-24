/**
 * Neo4j Graph Database Configuration
 *
 * Provides connection management for the Trust Graph feature.
 * Neo4j stores relationships between domains, IPs, registrars, and other entities
 * to identify scam networks and connected threats.
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { logger } from './logger.js';

class Neo4jConnection {
  private driver: Driver | null = null;
  private readonly uri: string;
  private readonly username: string;
  private readonly password: string;

  constructor() {
    // Default to Docker environment
    this.uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    this.username = process.env.NEO4J_USERNAME || 'neo4j';
    this.password = process.env.NEO4J_PASSWORD || 'elara_neo4j_pass_2024';
  }

  /**
   * Initialize Neo4j driver connection
   */
  async connect(): Promise<void> {
    try {
      this.driver = neo4j.driver(
        this.uri,
        neo4j.auth.basic(this.username, this.password),
        {
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 60000, // 60 seconds
          connectionTimeout: 30000, // 30 seconds
        }
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
      logger.info('✅ Neo4j connection established successfully');

      // Create initial constraints and indexes
      await this.createConstraintsAndIndexes();
    } catch (error) {
      logger.error('❌ Failed to connect to Neo4j:', error);
      throw new Error(`Neo4j connection failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get a Neo4j session for running queries
   */
  getSession(): Session {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session();
  }

  /**
   * Close the driver connection
   */
  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      logger.info('Neo4j connection closed');
      this.driver = null;
    }
  }

  /**
   * Create database constraints and indexes for optimal performance
   */
  private async createConstraintsAndIndexes(): Promise<void> {
    const session = this.getSession();

    try {
      logger.info('Creating Neo4j constraints and indexes...');

      // Domain constraints
      await session.run(`
        CREATE CONSTRAINT domain_url_unique IF NOT EXISTS
        FOR (d:Domain) REQUIRE d.url IS UNIQUE
      `);

      // IP Address constraints
      await session.run(`
        CREATE CONSTRAINT ip_address_unique IF NOT EXISTS
        FOR (ip:IPAddress) REQUIRE ip.address IS UNIQUE
      `);

      // Registrar constraints
      await session.run(`
        CREATE CONSTRAINT registrar_name_unique IF NOT EXISTS
        FOR (r:Registrar) REQUIRE r.name IS UNIQUE
      `);

      // SSL Certificate constraints
      await session.run(`
        CREATE CONSTRAINT ssl_fingerprint_unique IF NOT EXISTS
        FOR (s:SSLCertificate) REQUIRE s.fingerprint IS UNIQUE
      `);

      // Payment Processor constraints
      await session.run(`
        CREATE CONSTRAINT payment_processor_name_unique IF NOT EXISTS
        FOR (p:PaymentProcessor) REQUIRE p.name IS UNIQUE
      `);

      // Nameserver constraints
      await session.run(`
        CREATE CONSTRAINT nameserver_name_unique IF NOT EXISTS
        FOR (n:Nameserver) REQUIRE n.hostname IS UNIQUE
      `);

      // Indexes for common queries
      await session.run(`
        CREATE INDEX domain_risk_score IF NOT EXISTS
        FOR (d:Domain) ON (d.riskScore)
      `);

      await session.run(`
        CREATE INDEX domain_first_seen IF NOT EXISTS
        FOR (d:Domain) ON (d.firstSeen)
      `);

      await session.run(`
        CREATE INDEX ip_risk_score IF NOT EXISTS
        FOR (ip:IPAddress) ON (ip.riskScore)
      `);

      logger.info('✅ Neo4j constraints and indexes created successfully');
    } catch (error) {
      logger.error('Error creating Neo4j constraints:', error);
      // Don't throw - constraints might already exist
    } finally {
      await session.close();
    }
  }

  /**
   * Check if the connection is alive
   */
  async isConnected(): Promise<boolean> {
    if (!this.driver) return false;

    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run a Cypher query with parameters
   */
  async runQuery<T = any>(cypher: string, params: Record<string, any> = {}): Promise<T[]> {
    const session = this.getSession();

    try {
      const result = await session.run(cypher, params);
      return result.records.map((record) => record.toObject() as T);
    } finally {
      await session.close();
    }
  }
}

// Export singleton instance
export const neo4jConnection = new Neo4jConnection();
