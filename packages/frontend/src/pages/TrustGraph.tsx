import React, { useState } from 'react';
import { GitBranch, Users, TrendingUp, Shield, Search, Loader2, AlertCircle } from 'lucide-react';
import api from '../lib/api';

interface GraphNode {
  entity: string;
  entityType: string;
  overallTrustScore: number;
  relationCount: number;
}

interface GraphRelation {
  entity: string;
  relatedEntity: string;
  relationType: string;
  weight: number;
  relationshipTrustImpact: number;
}

interface GraphAnalytics {
  totalEntities: number;
  totalRelations: number;
  avgTrustScore: number;
  avgDegree: number;
}

interface TrustGraphData {
  nodes: GraphNode[];
  relations: GraphRelation[];
  analytics: GraphAnalytics;
}

const TrustGraph: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [graphData, setGraphData] = useState<TrustGraphData | null>(null);
  const [buildingGraph, setBuildingGraph] = useState(false);

  const handleBuildGraph = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a domain first');
      return;
    }

    setBuildingGraph(true);
    setError('');

    try {
      // Trigger graph build
      const response = await api.post('/v2/graph/build', { domain: searchQuery });

      console.log('🔍 [Trust Graph] Build response:', response.data);

      if (response.data.success) {
        // Show detailed build results
        const buildDetails = response.data.buildDetails;
        const networkAnalysis = response.data.networkAnalysis;

        console.log(`✅ Graph built: ${buildDetails.nodesCreated} nodes, ${buildDetails.relationshipsCreated} relationships`);

        // Transform to frontend format
        if (networkAnalysis && networkAnalysis.networkSize > 0) {
          setGraphData({
            nodes: networkAnalysis.connectedDomains.map((domain: string) => ({
              entity: domain,
              entityType: 'domain',
              overallTrustScore: 50,
              relationCount: 1
            })),
            relations: [],
            analytics: {
              totalEntities: networkAnalysis.networkSize + 1,
              totalRelations: buildDetails.relationshipsCreated,
              avgTrustScore: 50,
              avgDegree: networkAnalysis.networkSize
            }
          });
          setError(''); // Clear any previous errors
        } else {
          // Show diagnostic information
          let diagnosticMsg = `Graph built successfully but found no connected domains.\n\n`;
          diagnosticMsg += `📊 Build Details:\n`;
          diagnosticMsg += `• Nodes Created: ${buildDetails.nodesCreated}\n`;
          diagnosticMsg += `• Relationships: ${buildDetails.relationshipsCreated}\n\n`;

          diagnosticMsg += `🔍 Lookups:\n`;
          diagnosticMsg += `• Domain Node: ${buildDetails.domainNode.success ? '✅ Created' : '❌ Failed'}\n`;
          diagnosticMsg += `• DNS Lookup: ${buildDetails.ipAddresses.success ? `✅ Found ${buildDetails.ipAddresses.count} IP(s)` : '❌ Failed'}\n`;
          diagnosticMsg += `• WHOIS Lookup: ${buildDetails.registrar.success ? `✅ Found registrar: ${buildDetails.registrar.name}` : '❌ Failed'}\n`;
          diagnosticMsg += `• Nameservers: ${buildDetails.nameservers.success ? `✅ Found ${buildDetails.nameservers.count} NS` : '❌ Failed'}\n\n`;

          if (response.data.diagnostics.warnings.length > 0) {
            diagnosticMsg += `⚠️  Warnings:\n`;
            response.data.diagnostics.warnings.forEach((warning: string) => {
              diagnosticMsg += `• ${warning}\n`;
            });
            diagnosticMsg += `\n`;
          }

          if (response.data.suggestions && response.data.suggestions.length > 0) {
            diagnosticMsg += `💡 Suggestions:\n`;
            response.data.suggestions.forEach((suggestion: string) => {
              diagnosticMsg += `• ${suggestion}\n`;
            });
          }

          setError(diagnosticMsg);
        }
      } else {
        setError(response.data.error || 'Failed to build graph');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to build graph';
      const suggestions = err.response?.data?.suggestions || [];

      let fullError = `❌ ${errorMsg}\n`;
      if (suggestions.length > 0) {
        fullError += `\n💡 Suggestions:\n`;
        suggestions.forEach((suggestion: string) => {
          fullError += `• ${suggestion}\n`;
        });
      }

      setError(fullError);
    } finally {
      setBuildingGraph(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      setError('Please enter a domain, email, or username to search');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await api.get(`/v2/graph/entity/${encodeURIComponent(searchQuery)}`);

      if (response.data.success) {
        // Check if Neo4j is configured
        if (response.data.configured === false) {
          // Show helpful setup message
          setError(
            response.data.message ||
            'Trust Graph requires Neo4j database to be configured. This is an optional Phase 1 enhancement. ' +
            'The platform works fully without it - Trust Graph helps visualize networks of related domains to detect scam rings. ' +
            'To enable: Follow the setup guide in QUICK_SETUP.md (takes 5 minutes, completely free).'
          );
          setGraphData(null);
        } else if (response.data.analysis && response.data.analysis.networkSize === 0) {
          // Neo4j configured but no data - need to build graph
          setError(
            `No graph data found for "${searchQuery}". This domain hasn't been scanned yet or graph is still building. ` +
            `Click "Build Graph Now" below to populate data, or scan this URL first in the URL Scanner, then come back here.`
          );
          setGraphData(null);
        } else if (response.data.analysis) {
          // Neo4j configured and has data - transform response format
          const analysis = response.data.analysis;
          setGraphData({
            nodes: analysis.connectedDomains.map((domain: string) => ({
              entity: domain,
              entityType: 'domain',
              overallTrustScore: 50, // Default
              relationCount: 1
            })),
            relations: [],
            analytics: {
              totalEntities: analysis.networkSize + 1,
              totalRelations: analysis.connectedDomains.length,
              avgTrustScore: 50,
              avgDegree: analysis.networkSize
            }
          });
        } else {
          setError('No graph data found for this entity');
        }
      } else {
        setError(response.data.error || 'Failed to load trust graph');
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to load trust graph';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getTrustColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50 border-green-300';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-300';
    return 'text-red-600 bg-red-50 border-red-300';
  };

  const getTrustLabel = (score: number) => {
    if (score >= 70) return 'Trusted';
    if (score >= 40) return 'Neutral';
    return 'Suspicious';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <GitBranch className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Trust Network Graph
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore trust relationships and reputation scores across domains, profiles, and entities
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border-2 border-gray-200">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-lg font-semibold text-gray-700 mb-3">
                Search for Domain, Email, or Username:
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="example.com, user@example.com, or @username"
                className="w-full px-6 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none"
              />
            </div>

            {error && (
              <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
                <div className="flex items-start mb-3">
                  <AlertCircle className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <pre className="text-base text-blue-900 font-mono whitespace-pre-wrap leading-relaxed">{error}</pre>
                  </div>
                </div>
                {(error.includes('Build Graph Now') || error.includes('no connected domains')) && (
                  <button
                    onClick={handleBuildGraph}
                    disabled={buildingGraph}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors text-lg flex items-center justify-center mt-3"
                  >
                    {buildingGraph ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Building Graph (DNS + WHOIS lookups)...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5 mr-2" />
                        Build Graph Now
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 rounded-xl transition-colors text-xl flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                  Loading Graph...
                </>
              ) : (
                <>
                  <Search className="w-6 h-6 mr-3" />
                  Explore Trust Network
                </>
              )}
            </button>
          </form>

          <div className="mt-6 bg-blue-50 rounded-xl p-6">
            <p className="text-base text-blue-900 mb-2 font-semibold">How it works:</p>
            <ul className="space-y-2 text-base text-blue-800">
              <li>• View trust scores based on community reports and verification</li>
              <li>• See relationships between entities (domains, users, profiles)</li>
              <li>• Discover patterns and networks of suspicious activity</li>
              <li>• Powered by Neo4j graph database with real-time updates</li>
            </ul>
          </div>
        </div>

        {/* Results */}
        {graphData && (
          <div className="space-y-6">
            {/* Analytics Overview */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center">
                <TrendingUp className="w-8 h-8 mr-3 text-green-600" />
                Network Analytics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                  <Users className="w-10 h-10 text-blue-600 mb-3" />
                  <div className="text-3xl font-bold text-blue-900">{graphData.analytics.totalEntities}</div>
                  <div className="text-base text-blue-700">Total Entities</div>
                </div>
                <div className="bg-purple-50 rounded-xl p-6 border-2 border-purple-200">
                  <GitBranch className="w-10 h-10 text-purple-600 mb-3" />
                  <div className="text-3xl font-bold text-purple-900">{graphData.analytics.totalRelations}</div>
                  <div className="text-base text-purple-700">Total Relations</div>
                </div>
                <div className="bg-green-50 rounded-xl p-6 border-2 border-green-200">
                  <Shield className="w-10 h-10 text-green-600 mb-3" />
                  <div className="text-3xl font-bold text-green-900">{graphData.analytics.avgTrustScore.toFixed(1)}/100</div>
                  <div className="text-base text-green-700">Avg Trust Score</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-6 border-2 border-orange-200">
                  <TrendingUp className="w-10 h-10 text-orange-600 mb-3" />
                  <div className="text-3xl font-bold text-orange-900">{graphData.analytics.avgDegree.toFixed(1)}</div>
                  <div className="text-base text-orange-700">Avg Connections</div>
                </div>
              </div>
            </div>

            {/* Nodes */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Entities in Network ({graphData.nodes.length})
              </h2>
              <div className="space-y-4">
                {graphData.nodes.map((node, index) => (
                  <div key={index} className={`border-2 rounded-xl p-6 ${getTrustColor(node.overallTrustScore)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-2xl font-bold">{node.entity}</h3>
                          <span className="px-3 py-1 bg-white rounded-full text-sm font-semibold">
                            {node.entityType}
                          </span>
                        </div>
                        <div className="text-lg">
                          <strong>Trust Score:</strong> {node.overallTrustScore}/100 ({getTrustLabel(node.overallTrustScore)})
                        </div>
                        <div className="text-lg">
                          <strong>Connections:</strong> {node.relationCount} relationships
                        </div>
                      </div>
                      <Shield className="w-12 h-12" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Relations */}
            {graphData.relations.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Relationships ({graphData.relations.length})
                </h2>
                <div className="space-y-4">
                  {graphData.relations.map((relation, index) => (
                    <div key={index} className="border-2 border-gray-300 rounded-xl p-6 hover:border-green-400 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4 flex-1">
                          <span className="text-lg font-bold text-gray-900">{relation.entity}</span>
                          <span className="text-gray-500">→</span>
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                            {relation.relationType}
                          </span>
                          <span className="text-gray-500">→</span>
                          <span className="text-lg font-bold text-gray-900">{relation.relatedEntity}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Weight: {relation.weight}</div>
                          <div className="text-sm text-gray-600">Impact: {relation.relationshipTrustImpact > 0 ? '+' : ''}{relation.relationshipTrustImpact}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrustGraph;
