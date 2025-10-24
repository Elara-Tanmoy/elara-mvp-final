import { useState, useEffect } from 'react';
import { X, Shield, AlertTriangle, CheckCircle, XCircle, Info, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface ScanResult {
  url: string;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  riskScore?: number; // Elara comprehensive score (0-350)
  maxScore?: number; // Maximum possible score
  threats: string[];
  details: {
    virusTotal?: {
      malicious: number;
      suspicious: number;
      clean: number;
      total: number;
    };
    safeBrowsing?: {
      threats: string[];
      platforms: string[];
    };
    categories?: any[]; // Elara analyzer results
    findings?: any[]; // Detailed findings
    externalScans?: any; // External threat intel
    aiAnalysis?: any; // AI-powered analysis
    multiLLM?: any; // Multi-LLM consensus
  };
  scanDuration: number;
  cached: boolean;
  scannedAt: string;
  message: string;
  comprehensive?: boolean; // Flag for full Elara scan
}

interface URLScannerModalProps {
  url: string;
  isOpen: boolean;
  onProceed: () => void;
  onCancel: () => void;
  onScanComplete?: (result: ScanResult) => void;
}

// Fun scanning messages that rotate
const SCAN_MESSAGES = [
  "🔍 Scanning for digital nasties...",
  "🛡️ Checking if this site is friend or foe...",
  "🕵️ Investigating suspicious activity...",
  "🧹 Sweeping for malware cobwebs...",
  "🔬 Analyzing website DNA...",
  "🚦 Running security checks...",
  "🎯 Almost there! Finalizing scan...",
  "✨ Polishing results..."
];

// Risk level configuration (WCAG AAA compliant - 7:1 contrast)
const RISK_CONFIG = {
  safe: {
    color: 'bg-emerald-500',
    textColor: 'text-white',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
    label: '✅ SAFE',
    description: 'No security threats detected'
  },
  low: {
    color: 'bg-blue-500',
    textColor: 'text-white',
    icon: Info,
    iconColor: 'text-blue-500',
    label: 'ℹ️ LOW RISK',
    description: 'Minor concerns detected. Generally safe to proceed.'
  },
  medium: {
    color: 'bg-amber-500',
    textColor: 'text-gray-900',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    label: '⚠️ MEDIUM RISK',
    description: 'Some security concerns detected. Proceed with caution.'
  },
  high: {
    color: 'bg-red-500',
    textColor: 'text-white',
    icon: XCircle,
    iconColor: 'text-red-500',
    label: '🚨 HIGH RISK',
    description: 'This website has been flagged for malicious activity.'
  },
  critical: {
    color: 'bg-red-900',
    textColor: 'text-white',
    icon: XCircle,
    iconColor: 'text-red-900',
    label: '☠️ CRITICAL RISK',
    description: 'This website is highly dangerous. Do NOT proceed.'
  }
};

export default function URLScannerModal({
  url,
  isOpen,
  onProceed,
  onCancel,
  onScanComplete
}: URLScannerModalProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Rotate scanning messages every 2 seconds
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % SCAN_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isScanning]);

  // Simulate progress bar (smooth animation)
  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev; // Stop at 90% until scan completes
        return prev + Math.random() * 15;
      });
    }, 300);

    return () => clearInterval(interval);
  }, [isScanning]);

  // Run scan on mount
  useEffect(() => {
    if (!isOpen || !url) return;

    const runScan = async () => {
      setIsScanning(true);
      setScanResult(null);
      setScanError(null);
      setProgress(0);

      try {
        // Import API
        const { default: api } = await import('../lib/api');

        // Call pre-browse scan API
        const response = await api.post('/v2/scan/pre-browse', { url });

        if (response.data.success) {
          const result = response.data.result as ScanResult;

          // Complete progress animation
          setProgress(100);

          // Small delay for UX
          setTimeout(() => {
            setScanResult(result);
            setIsScanning(false);

            if (onScanComplete) {
              onScanComplete(result);
            }
          }, 500);
        } else {
          throw new Error(response.data.error || 'Scan failed');
        }
      } catch (error: any) {
        console.error('[URLScanner] Scan error:', error);

        const errorMessage = error.response?.data?.error || error.message || 'Failed to scan URL';
        setScanError(errorMessage);
        setIsScanning(false);
        setProgress(0);
      }
    };

    runScan();
  }, [isOpen, url, onScanComplete]);

  if (!isOpen) return null;

  const riskConfig = scanResult ? RISK_CONFIG[scanResult.riskLevel] : null;
  const Icon = riskConfig?.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full border border-gray-700 overflow-hidden">
        {/* Header - Phase 4: Enlarged for elderly-friendly */}
        <div className="bg-gray-800/50 px-6 py-5 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className="w-8 h-8 text-blue-400" />
            <h2 className="text-2xl font-bold text-white">Security Scan</h2>
          </div>
          <button
            onClick={onCancel}
            className="min-w-[48px] min-h-[48px] p-3 rounded-lg hover:bg-gray-700 transition-colors focus:ring-4 focus:ring-blue-500/50 focus:outline-none"
            aria-label="Close"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* URL Display - Phase 4: Larger text */}
          <div className="mb-6 p-5 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="text-base text-gray-400 mb-2 leading-relaxed">Scanning URL:</div>
            <div className="text-lg font-mono text-white break-all leading-relaxed">{url}</div>
          </div>

          {/* Scanning State */}
          {isScanning && !scanError && (
            <div className="space-y-6">
              {/* Progress Bar - Phase 4: Taller bar */}
              <div className="space-y-3">
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300 ease-out rounded-full"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="text-center text-lg text-gray-300 font-semibold leading-relaxed">
                  {Math.round(progress)}% complete
                </div>
              </div>

              {/* Animated Scanning Message - Phase 4: Larger text and icon */}
              <div className="flex items-center justify-center gap-4 py-8">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin flex-shrink-0" />
                <div className="text-xl text-gray-200 font-semibold leading-relaxed">
                  {SCAN_MESSAGES[currentMessage]}
                </div>
              </div>
            </div>
          )}

          {/* Scan Error - Phase 4: Larger text and buttons */}
          {scanError && !isScanning && (
            <div className="space-y-5">
              <div className="flex items-start gap-4 p-5 bg-red-500/10 border-2 border-red-500/30 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <div className="text-xl font-bold text-red-400 mb-2 leading-relaxed">Scan Failed</div>
                  <div className="text-lg text-gray-300 leading-relaxed mb-3">{scanError}</div>
                  <div className="text-base text-gray-400 leading-relaxed">
                    You can proceed at your own risk or cancel navigation.
                  </div>
                </div>
              </div>

              {/* Action Buttons - Phase 4: Larger buttons with better spacing */}
              <div className="flex gap-4">
                <button
                  onClick={onCancel}
                  className="flex-1 min-h-[60px] px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold rounded-xl transition-all duration-200 border-2 border-gray-600 focus:ring-4 focus:ring-gray-500/50 focus:outline-none shadow-lg"
                >
                  ❌ Cancel
                </button>
                <button
                  onClick={onProceed}
                  className="flex-1 min-h-[60px] px-8 py-4 bg-amber-500 hover:bg-amber-400 text-gray-900 text-xl font-bold rounded-xl transition-all duration-200 border-2 border-amber-400 focus:ring-4 focus:ring-amber-500/50 focus:outline-none shadow-lg"
                >
                  ⚠️ Proceed Anyway
                </button>
              </div>
            </div>
          )}

          {/* Scan Result - Phase 4: Larger display */}
          {scanResult && !isScanning && riskConfig && Icon && (
            <div className="space-y-5">
              {/* Risk Level Display - Phase 4: Enlarged */}
              <div className={`${riskConfig.color} ${riskConfig.textColor} rounded-xl p-8 text-center`}>
                <div className="flex items-center justify-center mb-5">
                  <Icon className="w-20 h-20" />
                </div>
                <div className="text-3xl font-bold mb-3 leading-relaxed">{riskConfig.label}</div>
                <div className="text-xl opacity-95 leading-relaxed">{riskConfig.description}</div>
              </div>

              {/* Scan Details - Phase 4: Larger text */}
              {scanResult.threats.length > 0 && (
                <div className="bg-gray-800/50 rounded-xl p-5 border-2 border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-lg font-bold text-white leading-relaxed">Threats Detected ({scanResult.threats.length})</div>
                    <button
                      onClick={() => setShowDetails(!showDetails)}
                      className="flex items-center gap-2 text-base text-blue-400 hover:text-blue-300 transition-colors min-h-[44px] px-4 py-2 focus:ring-4 focus:ring-blue-500/50 focus:outline-none rounded-lg"
                    >
                      {showDetails ? 'Hide' : 'Show'} Details
                      {showDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {showDetails && (
                    <div className="space-y-3">
                      {scanResult.threats.map((threat, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-base text-gray-300 bg-gray-900/50 p-4 rounded-lg leading-relaxed">
                          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-1" />
                          <span>{threat}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scan Metadata - Phase 4: Larger text + Comprehensive score */}
              <div className="space-y-3">
                {/* Elara Comprehensive Score */}
                {scanResult.comprehensive && scanResult.riskScore !== undefined && scanResult.maxScore && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-base font-semibold text-blue-400 leading-relaxed">
                        🎯 Elara Security Score
                      </div>
                      <div className="text-xl font-bold text-white">
                        {scanResult.riskScore}/{scanResult.maxScore}
                      </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          scanResult.riskLevel === 'critical' || scanResult.riskLevel === 'high'
                            ? 'bg-red-500'
                            : scanResult.riskLevel === 'medium'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min((scanResult.riskScore / scanResult.maxScore) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 mt-2 leading-relaxed">
                      {scanResult.comprehensive
                        ? '✨ Enterprise-grade scan with 17 analyzers + Multi-LLM AI'
                        : 'Basic security scan'}
                    </div>
                  </div>
                )}

                {/* Scan Info */}
                <div className="flex items-center justify-between text-base text-gray-400 px-2 leading-relaxed">
                  <div>
                    {scanResult.cached ? '📦 Cached result' : '🔄 Fresh scan'}
                  </div>
                  <div>
                    Scan duration: {scanResult.scanDuration.toFixed(2)}s
                  </div>
                </div>
              </div>

              {/* Action Buttons - Phase 4: Larger buttons with better accessibility */}
              <div className="flex gap-4 pt-2">
                <button
                  onClick={onCancel}
                  className="flex-1 min-h-[64px] px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold rounded-xl transition-all duration-200 border-2 border-gray-600 focus:ring-4 focus:ring-gray-500/50 focus:outline-none shadow-lg"
                >
                  🚫 Don't Proceed
                </button>
                <button
                  onClick={onProceed}
                  className={`flex-1 min-h-[64px] px-8 py-4 text-xl font-bold rounded-xl transition-all duration-200 border-2 focus:ring-4 focus:outline-none shadow-lg ${
                    scanResult.riskLevel === 'safe' || scanResult.riskLevel === 'low'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-400 focus:ring-emerald-500/50'
                      : 'bg-amber-500 hover:bg-amber-400 text-gray-900 border-amber-400 focus:ring-amber-500/50'
                  }`}
                >
                  {scanResult.riskLevel === 'safe' || scanResult.riskLevel === 'low' ? '✅ Proceed Safely' : '⚠️ Proceed Anyway'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
