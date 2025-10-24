/**
 * Real-time Scan Console Component
 *
 * WebSocket-based real-time log viewer for URL scans
 * Shows debug-level logs for admin calibration and debugging
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Pause, Download, X, ChevronDown, ChevronUp } from 'lucide-react';

interface ScanLogEntry {
  timestamp: string;
  scanId: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'success';
  category: string;
  message: string;
  data?: any;
  duration?: number;
  phase?: string;
}

interface ScanConsoleProps {
  scanId: string | null;
  onClose?: () => void;
  className?: string;
}

const ScanConsole: React.FC<ScanConsoleProps> = ({ scanId, onClose, className = '' }) => {
  const [logs, setLogs] = useState<ScanLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const consoleRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (!scanId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Connect to WebSocket
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_API_URL?.replace('http://', '').replace('https://', '').replace('/api', '') || window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/scan-logs?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[ScanConsole] WebSocket connected');

      // Subscribe to this scan
      ws.send(JSON.stringify({
        type: 'subscribe',
        scanId
      }));
    };

    ws.onmessage = (event) => {
      if (isPaused) return;

      const message = JSON.parse(event.data);

      if (message.type === 'log') {
        setLogs((prev) => [...prev, message.log]);
      } else if (message.type === 'historical-logs') {
        setLogs(message.logs);
      }
    };

    ws.onerror = (error) => {
      console.error('[ScanConsole] WebSocket error:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('[ScanConsole] WebSocket closed');
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'unsubscribe',
          scanId
        }));
        ws.close();
      }
    };
  }, [scanId, isPaused]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600';
      case 'warn': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      case 'debug': return 'text-gray-500';
      default: return 'text-blue-600';
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'success': return '✅';
      case 'debug': return '🔍';
      default: return 'ℹ️';
    }
  };

  const filteredLogs = filterLevel === 'all'
    ? logs
    : logs.filter(log => log.level === filterLevel);

  const downloadLogs = () => {
    const logText = filteredLogs.map(log =>
      `[${log.timestamp}] [${log.category}] ${log.level.toUpperCase()}: ${log.message}${log.data ? '\n  Data: ' + JSON.stringify(log.data, null, 2) : ''}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scan-${scanId}-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!scanId) return null;

  return (
    <div className={`bg-gray-900 rounded-lg shadow-2xl overflow-hidden ${className}`}>
      {/* Console Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h3 className="text-white font-semibold">Real-time Scan Logs</h3>
          {isConnected ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
              Disconnected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
            <option value="success">Success</option>
          </select>

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded ${autoScroll ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'} hover:bg-blue-700 transition-colors`}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Pause/Resume */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>

          {/* Download */}
          <button
            onClick={downloadLogs}
            className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Minimize/Maximize */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {/* Clear */}
          <button
            onClick={clearLogs}
            className="p-1 bg-gray-700 text-white rounded hover:bg-red-600 transition-colors"
            title="Clear logs"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Close */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              title="Close console"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Console Body - ENHANCED: Larger with debug trace style */}
      {!isMinimized && (
        <div
          ref={consoleRef}
          className="bg-black p-4 font-mono text-xs leading-relaxed h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              {isPaused ? (
                <p>Console paused. Click play to resume.</p>
              ) : (
                <p>Waiting for scan logs...</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log, index) => (
                <div key={index} className="border-l-2 border-gray-800 hover:border-blue-600 hover:bg-gray-900 px-3 py-2 rounded transition-all">
                  {/* Timestamp and Level Header */}
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-gray-600 text-[10px] font-bold">
                      {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}.{new Date(log.timestamp).getMilliseconds().toString().padStart(3, '0')}
                    </span>
                    <span className="shrink-0 text-xs">{getLogIcon(log.level)}</span>
                    <span className={`${getLogColor(log.level)} shrink-0 font-bold text-xs uppercase tracking-wider`}>
                      {log.level}
                    </span>
                    <span className="text-cyan-400 text-xs font-semibold">
                      [{log.category}]
                    </span>
                    {log.phase && (
                      <span className="text-purple-400 text-xs">
                        Phase: {log.phase}
                      </span>
                    )}
                    {log.duration && (
                      <span className="text-yellow-400 text-xs ml-auto">
                        ⏱ {log.duration}ms
                      </span>
                    )}
                  </div>

                  {/* Message with curl-style prefix */}
                  <div className="flex gap-2 items-start">
                    <span className="text-green-500 font-bold shrink-0">{'>'}</span>
                    <span className="text-gray-200 leading-relaxed">
                      {log.message}
                    </span>
                  </div>

                  {/* Data section with curl-style formatting */}
                  {log.data && (
                    <div className="mt-2 border-t border-gray-800 pt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-blue-500 font-bold">{'<'}</span>
                        <span className="text-blue-400 text-[10px] uppercase tracking-wide">Response Data:</span>
                      </div>
                      <pre className="text-[10px] text-gray-400 ml-4 p-2 bg-gray-950 rounded overflow-x-auto border border-gray-800">
{JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Console Footer */}
      <div className="bg-gray-800 px-4 py-2 text-xs text-gray-400 flex items-center justify-between border-t border-gray-700">
        <span>{filteredLogs.length} log entries{isPaused && ' (paused)'}</span>
        <span>Scan ID: {scanId}</span>
      </div>
    </div>
  );
};

export default ScanConsole;
