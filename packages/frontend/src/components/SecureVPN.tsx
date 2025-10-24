import React, { useState, useEffect, useRef } from 'react';
import { Shield, Globe, Activity, Database, Clock, AlertCircle, CheckCircle2, Loader2, ExternalLink, Power, Lock } from 'lucide-react';
import api from '../lib/api';

interface SessionStats {
  requestCount: number;
  bytesTransferred: string;
  duration: number;
  status: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const SecureVPN: React.FC = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    requestCount: 0,
    bytesTransferred: '0',
    duration: 0,
    status: 'disconnected'
  });
  const [proxyContent, setProxyContent] = useState<string | null>(null);
  const viewMode = 'window' as 'iframe' | 'window'; // Default to new window mode
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const proxyWindowRef = useRef<Window | null>(null);
  const statsIntervalRef = useRef<number | null>(null);

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format duration to readable time
  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // Update stats every 5 seconds when connected
  useEffect(() => {
    if (status === 'connected' && sessionToken) {
      statsIntervalRef.current = window.setInterval(async () => {
        try {
          const response = await api.get(`/v2/proxy/session/${sessionToken}`);
          if (response.data.success) {
            setStats(response.data.data);
          }
        } catch (error) {
          console.error('Failed to fetch stats:', error);
        }
      }, 5000);
    } else {
      if (statsIntervalRef.current) {
        window.clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    }

    return () => {
      if (statsIntervalRef.current) {
        window.clearInterval(statsIntervalRef.current);
      }
    };
  }, [status, sessionToken]);

  // Open content in new window
  const openInNewWindow = (content: string) => {
    // Close existing window if open
    if (proxyWindowRef.current && !proxyWindowRef.current.closed) {
      proxyWindowRef.current.close();
    }

    // Open new window
    const newWindow = window.open('', 'SecureVPN_Browser', 'width=1200,height=800,menubar=yes,toolbar=yes,location=yes,status=yes,resizable=yes,scrollbars=yes');

    if (newWindow) {
      proxyWindowRef.current = newWindow;

      // Write content to new window
      newWindow.document.open();
      newWindow.document.write(content);
      newWindow.document.close();

      // Set window title
      newWindow.document.title = `SecureVPN Browser - ${url}`;

      console.log('[SecureVPN] Opened in new window');
    } else {
      console.error('[SecureVPN] Failed to open new window - popup might be blocked');
      setError('Failed to open new window. Please allow popups for this site and try again.');
      setStatus('error');
    }
  };

  // Connect to URL
  const handleConnect = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Basic URL validation
    if (!url.match(/^https?:\/\//)) {
      setError('URL must start with http:// or https://');
      return;
    }

    setStatus('connecting');
    setError(null);
    setProxyContent(null);

    try {
      console.log('[SecureVPN] Creating session for URL:', url);

      // Create session
      const sessionResponse = await api.post('/v2/proxy/session', { url });
      console.log('[SecureVPN] Session response:', sessionResponse.data);

      if (!sessionResponse.data.success) {
        setStatus('error');
        const errorMsg = sessionResponse.data.error || 'Failed to create session';
        setError(errorMsg);
        console.error('[SecureVPN] Session creation failed:', errorMsg);
        return;
      }

      const token = sessionResponse.data.data.sessionToken;
      setSessionToken(token);
      console.log('[SecureVPN] Session created, token:', token);

      // Make initial request
      console.log('[SecureVPN] Making proxy request...');
      const proxyResponse = await api.post('/v2/proxy/request', {
        sessionToken: token,
        url
      });
      console.log('[SecureVPN] Proxy response:', proxyResponse.data);

      if (!proxyResponse.data.success) {
        setStatus('error');
        const errorMsg = proxyResponse.data.error || 'Failed to load website';
        setError(errorMsg);
        console.error('[SecureVPN] Proxy request failed:', errorMsg);
        return;
      }

      const content = proxyResponse.data.data.content;
      setProxyContent(content);
      setStatus('connected');
      console.log('[SecureVPN] Successfully connected!');

      // Open in new window if that mode is selected
      if (viewMode === 'window') {
        openInNewWindow(content);
      }

      // Fetch initial stats
      const statsResponse = await api.get(`/v2/proxy/session/${token}`);
      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }
    } catch (error: any) {
      setStatus('error');
      console.error('[SecureVPN] Connection error:', error);

      let errorMessage = 'Failed to connect. ';

      if (error.response) {
        // Server responded with error
        errorMessage += error.response.data?.error || `Server error: ${error.response.status}`;
        console.error('[SecureVPN] Server error:', error.response.status, error.response.data);
      } else if (error.request) {
        // Request made but no response
        errorMessage += 'No response from server. The backend may be unavailable.';
        console.error('[SecureVPN] No response:', error.request);
      } else {
        // Error setting up request
        errorMessage += error.message || 'Unknown error occurred.';
        console.error('[SecureVPN] Request setup error:', error.message);
      }

      setError(errorMessage);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!sessionToken) return;

    try {
      const response = await api.post(`/v2/proxy/session/${sessionToken}/disconnect`);

      if (response.data.success) {
        const finalStats = response.data.data;
        setStats(finalStats);
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      // Close proxy window if open
      if (proxyWindowRef.current && !proxyWindowRef.current.closed) {
        proxyWindowRef.current.close();
        proxyWindowRef.current = null;
      }

      setStatus('disconnected');
      setSessionToken(null);
      setProxyContent(null);
      setUrl('');
    }
  };

  // Write content to iframe
  useEffect(() => {
    if (proxyContent && iframeRef.current) {
      console.log('[SecureVPN] Writing content to iframe, length:', proxyContent.length);
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        doc.open();
        doc.write(proxyContent);
        doc.close();
        console.log('[SecureVPN] Content written to iframe successfully');
      } else {
        console.error('[SecureVPN] Could not access iframe document');
      }
    } else {
      if (!proxyContent) console.log('[SecureVPN] No proxy content to display');
      if (!iframeRef.current) console.log('[SecureVPN] Iframe ref not available');
    }
  }, [proxyContent]);

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-2xl shadow-2xl overflow-hidden border-2 border-indigo-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                SecureVPN Browser
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-normal">Premium</span>
              </h3>
              <p className="text-purple-100 text-sm">Browse any website securely through our protected proxy</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status === 'connected' && (
              <div className="flex items-center gap-2 bg-green-500 px-4 py-2 rounded-lg">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-white font-semibold text-sm">Connected</span>
              </div>
            )}
            {status === 'connecting' && (
              <div className="flex items-center gap-2 bg-yellow-500 px-4 py-2 rounded-lg">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
                <span className="text-white font-semibold text-sm">Connecting...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Connection Controls */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-indigo-100">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold text-gray-900">Connection</h4>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && status === 'disconnected' && handleConnect()}
                placeholder="Enter website URL (e.g., https://example.com)"
                disabled={status !== 'disconnected'}
                className="w-full px-4 py-3 border-2 border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed pl-10"
              />
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-indigo-400" />
            </div>

            {(status === 'disconnected' || status === 'error') ? (
              <button
                onClick={handleConnect}
                disabled={!url.trim()}
                className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <Power className="w-5 h-5" />
                Connect
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-8 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white font-bold rounded-xl hover:from-red-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <Power className="w-5 h-5" />
                Disconnect
              </button>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">Connection Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {status === 'connected' && !error && (
            <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900">Successfully Connected</p>
                <p className="text-sm text-green-700 mt-1">Your connection is secure and encrypted</p>
              </div>
            </div>
          )}
        </div>

        {/* Live Statistics */}
        {status === 'connected' && (
          <div className="bg-white rounded-xl shadow-md p-6 border border-purple-100">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">Live Statistics</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-900">Requests Made</span>
                </div>
                <div className="text-3xl font-bold text-blue-600">{stats.requestCount}</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-900">Data Transferred</span>
                </div>
                <div className="text-3xl font-bold text-purple-600">
                  {formatBytes(parseInt(stats.bytesTransferred || '0'))}
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-900">Session Duration</span>
                </div>
                <div className="text-3xl font-bold text-green-600">{formatDuration(stats.duration)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Info (temporary) */}
        {status === 'connected' && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-sm">
            <strong>Debug Info:</strong>
            <div>Status: {status}</div>
            <div>Has Content: {proxyContent ? 'Yes' : 'No'}</div>
            <div>Content Length: {proxyContent?.length || 0} characters</div>
            <div>Iframe Ref: {iframeRef.current ? 'Available' : 'Not Available'}</div>
          </div>
        )}

        {/* Proxied Content Display */}
        {status === 'connected' && proxyContent && viewMode === 'iframe' && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-900">Secure Browser View</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Lock className="w-3 h-3" />
                <span>Connection Encrypted</span>
              </div>
            </div>
            <div className="bg-white" style={{ height: '600px' }}>
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                title="Secure Proxy View"
              />
            </div>
          </div>
        )}

        {/* New Window Notification */}
        {status === 'connected' && proxyContent && viewMode === 'window' && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-8">
            <div className="text-center">
              <div className="inline-flex p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full mb-4">
                <ExternalLink className="w-12 h-12 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Website Opened in New Window</h4>
              <p className="text-gray-600 mb-4 max-w-2xl mx-auto">
                Your secure browser session has opened in a separate window for the best browsing experience.
              </p>
              <div className="bg-white rounded-lg p-4 border border-green-200 max-w-md mx-auto">
                <p className="text-sm text-gray-700">
                  <strong>Can't see the window?</strong> Check your popup blocker settings or look for the "SecureVPN Browser" window.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Content Warning */}
        {status === 'connected' && !proxyContent && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
            <p className="text-red-900 font-semibold">⚠️ Connected but no content received</p>
            <p className="text-red-700 text-sm mt-2">
              The proxy returned success but didn't send the website content. Check console logs for details.
            </p>
          </div>
        )}

        {/* Instructions when disconnected */}
        {status === 'disconnected' && !error && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-8 border-2 border-blue-200">
            <div className="text-center">
              <div className="inline-flex p-4 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mb-4">
                <Shield className="w-12 h-12 text-indigo-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">How to Use SecureVPN Browser</h4>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Enter any website URL above and click "Connect" to browse securely through our encrypted proxy.
                Your real IP address will be hidden, and you'll be protected from malicious content.
              </p>

              <div className="grid md:grid-cols-3 gap-4 text-left max-w-4xl mx-auto">
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-blue-600 font-bold">1</span>
                  </div>
                  <h5 className="font-semibold text-gray-900 mb-1">Enter URL</h5>
                  <p className="text-sm text-gray-600">Type or paste the website URL you want to visit</p>
                </div>

                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-purple-600 font-bold">2</span>
                  </div>
                  <h5 className="font-semibold text-gray-900 mb-1">Click Connect</h5>
                  <p className="text-sm text-gray-600">Establish a secure encrypted connection</p>
                </div>

                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                    <span className="text-green-600 font-bold">3</span>
                  </div>
                  <h5 className="font-semibold text-gray-900 mb-1">Browse Safely</h5>
                  <p className="text-sm text-gray-600">Website loads securely with your IP hidden</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-900">
                  <strong>Security Note:</strong> Localhost, private IPs, and internal domains are blocked for your security.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecureVPN;
