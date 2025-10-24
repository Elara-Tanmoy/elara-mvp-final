/**
 * TRUST GRAPH API CONTROLLER
 *
 * Provides REST API endpoints for the Trust Graph network analysis feature
 *
 * Endpoints:
 * - GET /api/v2/graph/network/:domain - Get network analysis for a domain
 * - GET /api/v2/graph/visualization/:domain - Get graph visualization data
 * - GET /api/v2/graph/bulk-registration/:registrar - Detect bulk registration patterns
 * - POST /api/v2/graph/build - Manually trigger graph build for a domain
 */

import { Request, Response } from 'express';
import { trustGraphService } from '../services/graph/trustGraphService.js';
import { logger } from '../config/logger.js';

export class GraphController {
  /**
   * GET /api/v2/graph/network/:domain
   * Get complete network analysis for a domain
   */
  async getNetworkAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;

      if (!domain || typeof domain !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Domain parameter is required',
        });
        return;
      }

      logger.info(`[GraphAPI] Network analysis requested for: ${domain}`);

      // Check if Neo4j is configured
      const neo4jConfigured = process.env.NEO4J_URI && process.env.NEO4J_URI !== '';

      if (!neo4jConfigured) {
        // Return helpful fallback when Neo4j not configured
        logger.warn('[GraphAPI] Neo4j not configured - returning fallback response');
        res.json({
          success: true,
          domain,
          analysis: {
            networkSize: 0,
            connectedDomains: [],
            sharedResources: [],
            riskAssessment: {
              score: 0,
              level: 'unknown',
              factors: [],
              recommendations: [
                'Trust Graph feature requires Neo4j database to be configured.',
                'This is an advanced feature for Phase 1 that helps identify networks of related domains.',
                'The platform works fully without this feature - it\'s an enhancement.'
              ]
            },
            patterns: [],
            timestamp: new Date().toISOString()
          },
          configured: false,
          message: 'Neo4j database not configured. Trust Graph is an optional Phase 1 enhancement.',
          setupGuide: '/docs/services-setup#neo4j',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Run network analysis
      const analysis = await trustGraphService.analyzeNetwork(domain);

      res.json({
        success: true,
        domain,
        analysis,
        configured: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[GraphAPI] Network analysis failed:', error);

      // Check if it's a Neo4j connection error
      if (error.message?.includes('Neo4j') || error.message?.includes('database') || error.message?.includes('connect')) {
        logger.warn('[GraphAPI] Neo4j connection failed - returning fallback response');
        res.json({
          success: true,
          domain: req.params.domain,
          analysis: {
            networkSize: 0,
            connectedDomains: [],
            sharedResources: [],
            riskAssessment: {
              score: 0,
              level: 'unknown',
              factors: [],
              recommendations: [
                'Unable to connect to Neo4j database.',
                'Please check your Neo4j configuration in environment variables.',
                'Trust Graph is an optional enhancement - core scanning features work without it.'
              ]
            },
            patterns: [],
            timestamp: new Date().toISOString()
          },
          configured: false,
          error: 'Neo4j connection failed',
          message: 'Trust Graph temporarily unavailable. Core features are working normally.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Other errors
      res.status(500).json({
        success: false,
        error: 'Failed to analyze network',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/graph/visualization/:domain
   * Get graph visualization data (nodes and edges) for a domain
   */
  async getGraphVisualization(req: Request, res: Response): Promise<void> {
    try {
      const { domain } = req.params;
      const depth = parseInt(req.query.depth as string) || 2;

      if (!domain || typeof domain !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Domain parameter is required',
        });
        return;
      }

      logger.info(`[GraphAPI] Visualization requested for: ${domain} (depth: ${depth})`);

      // Check if Neo4j is configured
      const neo4jConfigured = process.env.NEO4J_URI && process.env.NEO4J_URI !== '';

      if (!neo4jConfigured) {
        // Return empty graph when Neo4j not configured
        logger.warn('[GraphAPI] Neo4j not configured - returning empty graph');
        res.json({
          success: true,
          domain,
          depth,
          graph: {
            nodes: [{
              id: domain,
              label: domain,
              type: 'domain',
              properties: {}
            }],
            edges: []
          },
          configured: false,
          message: 'Neo4j not configured. Graph visualization requires Neo4j database.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Get graph visualization data
      const graphData = await trustGraphService.getNetworkGraph(domain, depth);

      res.json({
        success: true,
        domain,
        depth,
        graph: graphData,
        configured: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error('[GraphAPI] Graph visualization failed:', error);

      // Return empty graph on error
      res.json({
        success: true,
        domain: req.params.domain,
        depth: parseInt(req.query.depth as string) || 2,
        graph: {
          nodes: [{
            id: req.params.domain,
            label: req.params.domain,
            type: 'domain',
            properties: {}
          }],
          edges: []
        },
        configured: false,
        error: 'Graph visualization failed',
        message: error.message?.includes('Neo4j') ? 'Neo4j connection failed' : 'Graph service temporarily unavailable',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/v2/graph/bulk-registration/:registrar
   * Detect bulk domain registration patterns
   */
  async getBulkRegistration(req: Request, res: Response): Promise<void> {
    try {
      const { registrar } = req.params;
      const hours = parseInt(req.query.hours as string) || 24;

      if (!registrar || typeof registrar !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Registrar parameter is required',
        });
        return;
      }

      logger.info(`[GraphAPI] Bulk registration check for: ${registrar} (${hours}h window)`);

      // Check for bulk registration
      const bulkData = await trustGraphService.detectBulkRegistration(registrar, hours);

      res.json({
        success: true,
        registrar,
        timeWindow: `${hours} hours`,
        detected: bulkData.detected,
        domainCount: bulkData.domainCount,
        domains: bulkData.domains,
        assessment: bulkData.detected
          ? `⚠️ BULK REGISTRATION DETECTED - ${bulkData.domainCount} domains in ${hours} hours`
          : `✅ No bulk registration pattern detected`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[GraphAPI] Bulk registration check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check bulk registration',
        details: (error as Error).message,
      });
    }
  }

  /**
   * POST /api/v2/graph/build
   * Manually trigger graph build for a domain
   * PRODUCTION-GRADE: Returns detailed diagnostics
   */
  async buildDomainGraph(req: Request, res: Response): Promise<void> {
    try {
      const { domain, scanData } = req.body;

      if (!domain || typeof domain !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Domain is required in request body',
        });
        return;
      }

      logger.info(`[GraphAPI] Manual graph build requested for: ${domain}`);

      // Build the domain graph with detailed results
      const buildResult = await trustGraphService.buildDomainGraph(domain, scanData || {});

      // Get the network analysis
      const analysis = await trustGraphService.analyzeNetwork(domain);

      // Construct detailed response
      const response: any = {
        success: buildResult.success,
        message: buildResult.success
          ? `✅ Graph successfully built for ${domain}`
          : `⚠️ Graph partially built for ${domain} - some lookups failed`,
        domain,
        buildDetails: {
          nodesCreated: buildResult.nodesCreated,
          relationshipsCreated: buildResult.relationshipsCreated,
          domainNode: buildResult.details.domainNode,
          ipAddresses: buildResult.details.ipAddresses,
          registrar: buildResult.details.registrar,
          nameservers: buildResult.details.nameservers,
          sslCertificate: buildResult.details.sslCertificate,
        },
        networkAnalysis: {
          networkSize: analysis.networkSize,
          connectedDomains: analysis.connectedDomains,
          sharedInfrastructure: analysis.sharedInfrastructure,
          riskAssessment: analysis.riskAssessment,
          scamNetworkMembership: analysis.scamNetworkMembership,
        },
        diagnostics: {
          warnings: buildResult.warnings,
          errors: buildResult.errors,
          buildDuration: `${Date.now() - buildResult.timestamp.getTime()}ms`,
        },
        timestamp: new Date().toISOString(),
      };

      // Add helpful suggestions if there were issues
      response.suggestions = [];

      if (!buildResult.success || buildResult.warnings.length > 0) {
        if (!buildResult.details.ipAddresses.success) {
          response.suggestions.push(
            '🔧 DNS lookup failed - Check if the domain is valid and accessible. ' +
            'The backend uses Google (8.8.8.8) and Cloudflare (1.1.1.1) DNS with 3 retries.'
          );
        }

        if (!buildResult.details.registrar.success) {
          response.suggestions.push(
            '🔧 WHOIS lookup failed - This is common for new domains or privacy-protected registrations. ' +
            'The graph will have limited relationship data but core functionality still works.'
          );
        }

        if (buildResult.relationshipsCreated === 0) {
          response.suggestions.push(
            '⚠️ No relationships created - The domain node exists but has no connections. ' +
            'This could mean: (1) Domain doesn\'t exist, (2) Network lookups failed, or (3) Domain has privacy protection. ' +
            'Try scanning the full URL first in the URL Scanner to gather more data, then rebuild the graph.'
          );
        }
      }

      // Explain why no connected domains (even with successful build)
      if (analysis.networkSize === 0 && buildResult.relationshipsCreated > 0) {
        response.suggestions.push(
          'ℹ️ No connected domains found - This is NORMAL if this is the first or only domain you\'ve scanned. ' +
          'Connected domains only appear when MULTIPLE domains share the same infrastructure (IP, registrar, nameservers). ' +
          'To see network relationships: (1) Scan more URLs, (2) Wait for others to scan related domains, or (3) The domain is truly isolated.'
        );

        response.suggestions.push(
          `✅ Graph data collected successfully: ${buildResult.nodesCreated} nodes, ${buildResult.relationshipsCreated} relationships. ` +
          'This data will be used to find connections as more domains are scanned.'
        );
      }

      res.json(response);
    } catch (error) {
      logger.error('[GraphAPI] Graph build failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to build domain graph',
        details: (error as Error).message,
        suggestions: [
          '🔧 Check that Neo4j database is running and accessible',
          '🔧 Verify NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD environment variables',
          '🔧 Check backend logs for detailed error messages',
        ],
      });
    }
  }
}

export const graphController = new GraphController();
