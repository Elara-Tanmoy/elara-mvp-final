import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Lock, X, Plus, ArrowLeft, ArrowRight, RotateCw, Home,
  Star, Clock, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Printer, Bookmark, History as HistoryIcon,
  AlertCircle, Loader, CheckCircle, Shield
} from 'lucide-react';
import api from '../lib/api';
import URLScannerModal from '../components/URLScannerModal';

interface Tab {
  id: string;
  url: string;
  title: string;
  content: string | null;
  loading: boolean;
  error: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionToken: string | null;
  favicon: string | null;
  loadingProgress: number;
  canGoBack: boolean;
  canGoForward: boolean;
  history: string[];
  historyIndex: number;
  zoom: number;
  iframeError: boolean; // Track iframe loading errors
  errorType: 'network' | 'xframe' | 'cors' | 'timeout' | null; // Type of error
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon: string | null;
  createdAt: Date;
}

interface HistoryItem {
  id: string;
  url: string;
  title: string;
  visitedAt: Date;
  favicon: string | null;
}

const INITIAL_URL = 'https://www.google.com';

export default function ProxyBrowser() {
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Phase 3 & 5: URL Scanner state with localStorage persistence
  const [showScanner, setShowScanner] = useState(false);
  const [scannerUrl, setScannerUrl] = useState('');
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [scanningEnabled, setScanningEnabled] = useState(() => {
    // Phase 5: Load from localStorage, default to true
    const stored = localStorage.getItem('elara_secure_browser_scanning_enabled');
    return stored !== null ? stored === 'true' : true;
  });

  const iframeRefs = useRef<{ [key: string]: HTMLIFrameElement | null }>({});

  // Initialize with one tab
  useEffect(() => {
    // CRITICAL FIX: Initialize localStorage if it doesn't exist
    const currentValue = localStorage.getItem('elara_secure_browser_scanning_enabled');
    if (currentValue === null) {
      console.log('[ProxyBrowser] 🚨 localStorage is NULL - initializing to "true"');
      localStorage.setItem('elara_secure_browser_scanning_enabled', 'true');
    }

    // Log initial scanning state
    console.log(`[ProxyBrowser] 🚀 Initializing - scanningEnabled state: ${scanningEnabled}`);
    console.log(`[ProxyBrowser] 📦 localStorage value after init: ${localStorage.getItem('elara_secure_browser_scanning_enabled')}`);

    const initialTab = createNewTab(INITIAL_URL);
    setTabs([initialTab]);
    setActiveTabId(initialTab.id);
    setUrlInput(INITIAL_URL);

    // Load bookmarks and history from localStorage
    loadBookmarks();
    loadHistory();

    // Cleanup all sessions on mount
    const cleanup = async () => {
      try {
        await api.post('/v2/proxy/disconnect-all');
        console.log('[ProxyBrowser] Cleaned up all old sessions');
      } catch (error) {
        console.error('[ProxyBrowser] Cleanup error:', error);
      }
    };
    cleanup();

    // Cleanup on unmount
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Active tab
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Update URL input when active tab changes
  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTabId, activeTab?.url]);

  // Helper functions - MUST be defined before performNavigation
  const generateId = () => Math.random().toString(36).substring(2, 11);

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, ...updates } : tab
    ));
  }, []);

  const addToHistory = useCallback((url: string, title: string) => {
    const historyItem: HistoryItem = {
      id: generateId(),
      url,
      title,
      visitedAt: new Date(),
      favicon: null
    };
    setHistory(prev => {
      const newHistory = [historyItem, ...prev];
      const trimmed = newHistory.slice(0, 1000);
      try {
        localStorage.setItem('elara_history', JSON.stringify(trimmed));
      } catch (error) {
        console.error('Failed to save history:', error);
      }
      return trimmed;
    });
  }, []);

  // Actual navigation logic (separated for scanner integration) - MUST be defined before handleNavigate
  const performNavigation = useCallback(async (url: string) => {
    if (!activeTab) return;

    try {
      // Update tab state
      updateTab(activeTab.id, {
        url,
        loading: true,
        error: null,
        loadingProgress: 10,
        status: 'connecting'
      });

      // Create session
      const sessionResponse = await api.post('/v2/proxy/session', { url });
      const sessionToken = sessionResponse.data.data.sessionToken;
      const normalizedUrl = sessionResponse.data.data.targetUrl;

      updateTab(activeTab.id, {
        sessionToken,
        url: normalizedUrl,
        loadingProgress: 30,
        status: 'connected'
      });

      // Make proxy request
      const proxyResponse = await api.post('/v2/proxy/request', {
        sessionToken,
        url: normalizedUrl
      });

      if (proxyResponse.data.success) {
        const { content, finalUrl } = proxyResponse.data.data;

        // Extract title from content
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : finalUrl;

        // Extract favicon
        const faviconMatch = content.match(/<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
        const favicon = faviconMatch ? faviconMatch[1] : null;

        // Update tab with content
        updateTab(activeTab.id, {
          content,
          url: finalUrl,
          title,
          favicon,
          loading: false,
          loadingProgress: 100,
          error: null,
          status: 'connected',
          // Update history
          history: [...activeTab.history.slice(0, activeTab.historyIndex + 1), finalUrl],
          historyIndex: activeTab.historyIndex + 1,
          canGoBack: true,
          canGoForward: false
        });

        // Add to global history
        addToHistory(finalUrl, title);

        setUrlInput(finalUrl);
      }
    } catch (error: any) {
      console.error('[ProxyBrowser] Navigation error:', error);

      let errorMessage = 'Failed to load page';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      updateTab(activeTab.id, {
        loading: false,
        loadingProgress: 0,
        error: errorMessage,
        status: 'error'
      });
    }
  }, [activeTab, addToHistory, updateTab]);

  // Navigation with pre-browse scanning - REDESIGNED: Read directly from localStorage for bulletproof reliability
  const handleNavigate = async (url: string) => {
    if (!activeTab) return;

    // CRITICAL FIX: Read DIRECTLY from localStorage to always get the current value
    // This avoids ALL state/ref/closure issues
    const storedValue = localStorage.getItem('elara_secure_browser_scanning_enabled');
    const isScanningEnabled = storedValue !== null ? storedValue === 'true' : true;

    console.log(`[ProxyBrowser] ⚡ handleNavigate called`);
    console.log(`[ProxyBrowser] 📍 URL: ${url}`);
    console.log(`[ProxyBrowser] 🔍 localStorage value: "${storedValue}"`);
    console.log(`[ProxyBrowser] ✨ isScanningEnabled: ${isScanningEnabled}`);

    // If scanning is enabled, show scanner modal first
    if (isScanningEnabled) {
      console.log('[ProxyBrowser] ✅✅✅ Scanning ENABLED - SHOWING SCANNER MODAL');
      setScannerUrl(url);
      setPendingNavigation(url);
      setShowScanner(true);
      return; // Wait for user decision
    }

    // Direct navigation (scanning disabled)
    console.log('[ProxyBrowser] ❌❌❌ Scanning DISABLED - NAVIGATING DIRECTLY WITHOUT SCAN MODAL');
    await performNavigation(url);
  };

  // PostMessage listener for navigation from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'navigate' && event.data.url) {
        console.log('[ProxyBrowser] 📬 PostMessage navigation:', event.data.url);
        handleNavigate(event.data.url);
      } else if (event.data && event.data.type === 'form_submit') {
        console.log('[ProxyBrowser] 📝 Form submission:', event.data);
        // Handle form submissions
        handleNavigate(event.data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleNavigate]); // Dependency: handleNavigate (which includes scanningEnabled via useCallback)

  // Render iframe content when activeTab content changes
  useEffect(() => {
    if (activeTab && activeTab.content && iframeRefs.current[activeTab.id]) {
      const iframe = iframeRefs.current[activeTab.id];
      if (iframe) {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          try {
            doc.open();
            doc.write(activeTab.content);
            doc.close();
            console.log('[ProxyBrowser] Content written to iframe:', activeTab.content.length, 'chars');

            // Performance: Add image lazy loading and error handling
            const images = doc.querySelectorAll('img');
            images.forEach((img: any) => {
              img.loading = 'lazy';
              img.onerror = function() {
                this.style.display = 'none'; // Hide broken images
              };
            });

            // Performance: Apply zoom if set
            if (activeTab.zoom !== 100) {
              doc.body.style.zoom = `${activeTab.zoom}%`;
            }
          } catch (error) {
            console.error('[ProxyBrowser] Error writing to iframe:', error);
          }
        }
      }
    }
  }, [activeTab?.content, activeTabId, activeTab?.zoom]);

  // Detect iframe loading errors (X-Frame-Options, CORS, etc.)
  useEffect(() => {
    if (!activeTab || !activeTab.content || !iframeRefs.current[activeTab.id]) return;

    const iframe = iframeRefs.current[activeTab.id];
    if (!iframe) return;

    let loadTimeout: number;
    let hasLoaded = false;

    const handleLoad = () => {
      hasLoaded = true;
      clearTimeout(loadTimeout);
      console.log('[ProxyBrowser] ✅ Iframe loaded successfully');
      // Clear any previous errors
      updateTab(activeTab.id, {
        iframeError: false,
        errorType: null
      });
    };

    const handleError = () => {
      console.error('[ProxyBrowser] ❌ Iframe failed to load (error event)');
      updateTab(activeTab.id, {
        iframeError: true,
        errorType: 'network'
      });
    };

    // X-Frame-Options blocking doesn't trigger error event, but iframe never loads
    // Set a timeout to detect this
    loadTimeout = window.setTimeout(() => {
      if (!hasLoaded) {
        console.error('[ProxyBrowser] ⚠️ Iframe load timeout - likely X-Frame-Options blocking');
        updateTab(activeTab.id, {
          iframeError: true,
          errorType: 'xframe'
        });
      }
    }, 5000) as unknown as number; // 5 second timeout

    iframe.addEventListener('load', handleLoad);
    iframe.addEventListener('error', handleError);

    return () => {
      clearTimeout(loadTimeout);
      iframe.removeEventListener('load', handleLoad);
      iframe.removeEventListener('error', handleError);
    };
  }, [activeTab?.content, activeTabId, updateTab, activeTab?.id]);

  // Helper functions
  const createNewTab = (url: string = ''): Tab => {
    return {
      id: generateId(),
      url: url || '',
      title: 'New Tab',
      content: null,
      loading: false,
      error: null,
      status: 'disconnected',
      sessionToken: null,
      favicon: null,
      loadingProgress: 0,
      canGoBack: false,
      canGoForward: false,
      history: [],
      historyIndex: -1,
      zoom: 100,
      iframeError: false,
      errorType: null
    };
  };

  const loadBookmarks = () => {
    try {
      const saved = localStorage.getItem('elara_bookmarks');
      if (saved) {
        setBookmarks(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    }
  };

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem('elara_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert string dates back to Date objects
        setHistory(parsed.map((item: any) => ({
          ...item,
          visitedAt: new Date(item.visitedAt)
        })));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const saveBookmarks = (newBookmarks: Bookmark[]) => {
    try {
      localStorage.setItem('elara_bookmarks', JSON.stringify(newBookmarks));
      setBookmarks(newBookmarks);
    } catch (error) {
      console.error('Failed to save bookmarks:', error);
    }
  };

  const handleAddBookmark = () => {
    if (!activeTab) return;

    const bookmark: Bookmark = {
      id: generateId(),
      title: activeTab.title || activeTab.url,
      url: activeTab.url,
      favicon: activeTab.favicon,
      createdAt: new Date()
    };

    const newBookmarks = [bookmark, ...bookmarks];
    saveBookmarks(newBookmarks);
    alert('Bookmark added!');
  };

  const handleRemoveBookmark = (id: string) => {
    const newBookmarks = bookmarks.filter(b => b.id !== id);
    saveBookmarks(newBookmarks);
  };

  const handleClearHistory = () => {
    if (confirm('Clear all browsing history?')) {
      setHistory([]);
      try {
        localStorage.setItem('elara_history', JSON.stringify([]));
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  // Tab management
  const handleNewTab = () => {
    const newTab = createNewTab();
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput('');
  };

  const handleCloseTab = (tabId: string) => {
    // Don't close if it's the last tab
    if (tabs.length === 1) {
      return;
    }

    // Disconnect the session for this tab
    const tab = tabs.find(t => t.id === tabId);
    if (tab && tab.sessionToken) {
      api.post(`/v2/proxy/session/${tab.sessionToken}/disconnect`).catch(console.error);
    }

    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);

    // If closing active tab, switch to another
    if (tabId === activeTabId) {
      const currentIndex = tabs.findIndex(t => t.id === tabId);
      const newActiveTab = newTabs[Math.max(0, currentIndex - 1)];
      setActiveTabId(newActiveTab.id);
    }
  };

  // Phase 3: Scanner modal handlers
  const handleScanProceed = async () => {
    setShowScanner(false);
    if (pendingNavigation) {
      await performNavigation(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const handleScanCancel = () => {
    setShowScanner(false);
    setPendingNavigation(null);
    console.log('[ProxyBrowser] User cancelled navigation after scan');
  };

  // Phase 5: Toggle scanning setting - REDESIGNED with localStorage-first approach
  const handleToggleScanning = () => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[ProxyBrowser] 🔄🔄🔄 TOGGLE BUTTON CLICKED!!!`);
    console.log(`[ProxyBrowser] 📊 Current scanningEnabled state: ${scanningEnabled}`);
    console.log(`[ProxyBrowser] 📦 Current localStorage BEFORE toggle: "${localStorage.getItem('elara_secure_browser_scanning_enabled')}"`);

    const newValue = !scanningEnabled;
    console.log(`[ProxyBrowser] 🎯 New value will be: ${newValue}`);

    // Update React state for UI
    setScanningEnabled(newValue);
    console.log(`[ProxyBrowser] ✅ React state updated to: ${newValue}`);

    // CRITICAL: Update localStorage immediately
    try {
      localStorage.setItem('elara_secure_browser_scanning_enabled', String(newValue));
      console.log(`[ProxyBrowser] ✅ localStorage.setItem() called successfully`);
    } catch (error) {
      console.error(`[ProxyBrowser] ❌ ERROR setting localStorage:`, error);
    }

    // Verify it was saved
    const verification = localStorage.getItem('elara_secure_browser_scanning_enabled');
    console.log(`[ProxyBrowser] 📦 localStorage value AFTER toggle: "${verification}"`);
    console.log(`[ProxyBrowser] ✅ Verification: ${verification === String(newValue) ? '✅ SUCCESS ✅' : '❌ FAILED ❌'}`);

    const message = newValue
      ? '🛡️ SECURITY SCANNING ENABLED - All URLs will be scanned before opening'
      : '⚠️ SECURITY SCANNING DISABLED - URLs will open directly without scanning';

    console.log(`[ProxyBrowser] ${message}`);
    console.log(`${'='.repeat(80)}\n`);

    // Alert user for immediate feedback
    alert(message);
  };

  // URL validation and normalization
  const validateAndNormalizeUrl = (input: string): string | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if it's a search query (no dots, spaces, or looks like a search)
    if (!trimmed.includes('.') || trimmed.includes(' ')) {
      // Convert to Google search
      return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    }

    // Try to parse as URL
    try {
      // Add protocol if missing
      let urlString = trimmed;
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        urlString = 'https://' + trimmed;
      }

      // Validate URL format
      const url = new URL(urlString);

      // Basic domain validation
      if (!url.hostname || url.hostname.length < 3) {
        return null;
      }

      return urlString;
    } catch (error) {
      console.error('[ProxyBrowser] Invalid URL:', error);
      return null;
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = urlInput.trim();

    if (!input) {
      alert('Please enter a URL or search term');
      return;
    }

    const validatedUrl = validateAndNormalizeUrl(input);

    if (!validatedUrl) {
      alert('Invalid URL format. Please enter a valid website address (e.g., google.com) or search term.');
      return;
    }

    handleNavigate(validatedUrl);
  };

  const handleGoBack = () => {
    if (!activeTab || !activeTab.canGoBack) return;
    const previousUrl = activeTab.history[activeTab.historyIndex - 1];
    if (previousUrl) {
      updateTab(activeTab.id, {
        historyIndex: activeTab.historyIndex - 1,
        canGoBack: activeTab.historyIndex - 1 > 0,
        canGoForward: true
      });
      handleNavigate(previousUrl);
    }
  };

  const handleGoForward = () => {
    if (!activeTab || !activeTab.canGoForward) return;
    const nextUrl = activeTab.history[activeTab.historyIndex + 1];
    if (nextUrl) {
      updateTab(activeTab.id, {
        historyIndex: activeTab.historyIndex + 1,
        canGoForward: activeTab.historyIndex + 1 < activeTab.history.length - 1,
        canGoBack: true
      });
      handleNavigate(nextUrl);
    }
  };

  const handleReload = () => {
    if (activeTab && activeTab.url) {
      handleNavigate(activeTab.url);
    }
  };

  const handleHome = () => {
    handleNavigate(INITIAL_URL);
  };

  // Advanced features
  const handleZoomIn = () => {
    if (!activeTab) return;
    const newZoom = Math.min(activeTab.zoom + 10, 200);
    updateTab(activeTab.id, { zoom: newZoom });

    const iframe = iframeRefs.current[activeTab.id];
    if (iframe && iframe.contentDocument) {
      iframe.contentDocument.body.style.zoom = `${newZoom}%`;
    }
  };

  const handleZoomOut = () => {
    if (!activeTab) return;
    const newZoom = Math.max(activeTab.zoom - 10, 50);
    updateTab(activeTab.id, { zoom: newZoom });

    const iframe = iframeRefs.current[activeTab.id];
    if (iframe && iframe.contentDocument) {
      iframe.contentDocument.body.style.zoom = `${newZoom}%`;
    }
  };

  const handlePrint = () => {
    if (!activeTab) return;

    const iframe = iframeRefs.current[activeTab.id];
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDisconnectAll = async () => {
    try {
      await api.post('/v2/proxy/disconnect-all');

      // Reset all tabs
      setTabs(prev => prev.map(tab => ({
        ...tab,
        status: 'disconnected',
        sessionToken: null
      })));

      alert('All sessions disconnected');
    } catch (error) {
      console.error('Failed to disconnect sessions:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white flex flex-col">
      {/* Top Bar */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Secure Browser
          </h1>
          <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-md font-medium border border-cyan-500/30">
            Enterprise Edition
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'} open
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all text-sm font-medium"
          >
            Exit Browser
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 px-2 py-2 flex items-center gap-2 overflow-x-auto">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all min-w-[200px] max-w-[250px] group
              ${tab.id === activeTabId
                ? 'bg-gray-700 border border-cyan-500/30'
                : 'bg-gray-800/50 hover:bg-gray-700/50 border border-transparent'
              }
            `}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.loading ? (
              <Loader className="w-4 h-4 text-cyan-400 animate-spin flex-shrink-0" />
            ) : tab.error ? (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : tab.status === 'connected' ? (
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            ) : (
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}

            <span className="text-sm flex-1 truncate">
              {tab.title || 'New Tab'}
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:bg-gray-600 rounded p-1 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <button
          onClick={handleNewTab}
          className="p-2 hover:bg-gray-700 rounded-lg transition-all"
          title="New Tab"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Toolbar - Responsive design for mobile */}
      <div className="bg-gray-800/30 backdrop-blur-sm border-b border-gray-700/50 px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Top Row: URL Bar and Go button (full width on mobile) */}
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 flex-1 order-1 sm:order-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {activeTab?.status === 'connected' && (
                  <Lock className="w-4 h-4 text-green-400" />
                )}
                {activeTab?.loading && (
                  <Loader className="w-4 h-4 text-cyan-400 animate-spin" />
                )}
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter website or search..."
                className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-10 py-2.5 text-sm sm:text-base focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-4 sm:px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-all text-sm sm:text-base font-medium"
            >
              Go
            </button>
          </form>

          {/* Bottom Row: Navigation + Security + Tools */}
          <div className="flex items-center justify-between gap-2 order-2 sm:order-1 w-full sm:w-auto">
            {/* Navigation Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleGoBack}
                disabled={!activeTab?.canGoBack}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleGoForward}
                disabled={!activeTab?.canGoForward}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                title="Forward"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleReload}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all"
                title="Reload"
              >
                <RotateCw className={`w-5 h-5 ${activeTab?.loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleHome}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all"
                title="Home"
              >
                <Home className="w-5 h-5" />
              </button>
            </div>

            {/* SIMPLIFIED: Compact Elara Scan toggle */}
            <button
              onClick={handleToggleScanning}
              className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 font-semibold text-sm border-2 shadow-lg ${
                scanningEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/30'
                  : 'bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-red-500/30'
              }`}
              title={`Click to ${scanningEnabled ? 'DISABLE' : 'ENABLE'} Elara Scan - Currently ${scanningEnabled ? 'ON' : 'OFF'}`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline text-xs sm:text-sm">Elara:</span>
              <span className="font-bold text-xs sm:text-sm">{scanningEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Simplified Controls - Only essential features for elderly users */}
          <div className="flex items-center gap-1">
            {/* Always visible: Bookmarks & History */}
            <button
              onClick={() => setShowBookmarks(!showBookmarks)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
              title="Bookmarks"
            >
              <Bookmark className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all"
              title="History"
            >
              <HistoryIcon className="w-5 h-5" />
            </button>
            <button
              onClick={handleAddBookmark}
              disabled={!activeTab?.url}
              className="p-2 hover:bg-gray-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Add Bookmark"
            >
              <Star className="w-5 h-5" />
            </button>

            {/* Desktop only: Zoom controls */}
            <div className="hidden lg:flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-xs text-gray-400 min-w-[45px] text-center">
                {activeTab?.zoom || 100}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>

            {/* Desktop only: Advanced features */}
            <div className="hidden xl:flex items-center gap-1">
              <button
                onClick={handlePrint}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all"
                title="Print"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-gray-700 rounded-lg transition-all"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Loading Progress Bar */}
        {activeTab?.loading && (
          <div className="mt-2 w-full h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
              style={{ width: `${activeTab.loadingProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Bookmarks Sidebar */}
        {showBookmarks && (
          <div className="w-80 bg-gray-800/50 backdrop-blur-sm border-r border-gray-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Bookmarks</h3>
              <button onClick={() => setShowBookmarks(false)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            {bookmarks.length === 0 ? (
              <p className="text-gray-400 text-sm">No bookmarks yet</p>
            ) : (
              <div className="space-y-2">
                {bookmarks.map(bookmark => (
                  <div
                    key={bookmark.id}
                    className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900 cursor-pointer group transition-all"
                    onClick={() => handleNavigate(bookmark.url)}
                  >
                    <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{bookmark.title}</div>
                      <div className="text-xs text-gray-400 truncate">{bookmark.url}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveBookmark(bookmark.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Sidebar */}
        {showHistory && (
          <div className="w-80 bg-gray-800/50 backdrop-blur-sm border-r border-gray-700 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">History</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-red-400 hover:text-red-300 transition-all"
                >
                  Clear All
                </button>
                <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-gray-700 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-gray-400 text-sm">No history yet</p>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900 cursor-pointer transition-all"
                    onClick={() => handleNavigate(item.url)}
                  >
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-gray-400 truncate">{item.url}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {item.visitedAt.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Browser View */}
        <div className="flex-1 relative bg-white">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${tab.id === activeTabId ? 'block' : 'hidden'}`}
            >
              {tab.error ? (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center max-w-md mx-auto p-6">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to load page</h2>
                    <p className="text-gray-600 mb-4">{tab.error}</p>
                    <button
                      onClick={handleReload}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-all"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : tab.iframeError ? (
                <div className="h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
                  <div className="text-center max-w-2xl mx-auto p-8">
                    <Shield className="w-24 h-24 text-amber-600 mx-auto mb-6" />
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                      {tab.errorType === 'xframe' ? 'Website Blocks Iframe Display' : 'Unable to Display in Secure Browser'}
                    </h2>
                    <div className="bg-white rounded-lg p-6 mb-6 shadow-md border-2 border-amber-200">
                      <p className="text-lg text-gray-700 mb-4 leading-relaxed">
                        {tab.errorType === 'xframe' ? (
                          <>
                            <strong className="text-amber-700">{tab.url}</strong> has security settings (X-Frame-Options)
                            that prevent it from being displayed inside a secure browser iframe.
                          </>
                        ) : (
                          <>
                            <strong className="text-amber-700">{tab.url}</strong> cannot be displayed in the secure browser
                            due to security restrictions or network errors.
                          </>
                        )}
                      </p>
                      <div className="text-left space-y-2 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                        <p><strong>Why this happens:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          {tab.errorType === 'xframe' ? (
                            <>
                              <li>Modern websites like Google, Facebook, and banking sites block iframe embedding to prevent clickjacking attacks</li>
                              <li>This is a security feature to protect users from malicious websites</li>
                              <li>The website's server specifically rejects iframe display requests</li>
                            </>
                          ) : (
                            <>
                              <li>The website may have network connectivity issues</li>
                              <li>The content may be blocked by CORS policies</li>
                              <li>The website may not be accessible from the proxy server</li>
                            </>
                          )}
                        </ul>
                      </div>
                    </div>
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={handleReload}
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all font-semibold"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => window.open(tab.url, '_blank', 'noopener,noreferrer')}
                        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-all font-semibold flex items-center gap-2"
                      >
                        <Globe className="w-5 h-5" />
                        Open in New Tab
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">
                      Opening in a new tab will bypass the secure browser but the site will still be subject to your browser's security settings.
                    </p>
                  </div>
                </div>
              ) : tab.content ? (
                <iframe
                  ref={el => { iframeRefs.current[tab.id] = el; }}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads"
                  loading="lazy"
                  title={tab.title}
                />
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  {tab.loading ? (
                    <div className="text-center">
                      <Loader className="w-12 h-12 text-cyan-600 animate-spin mx-auto mb-4" />
                      <p className="text-gray-600">Loading...</p>
                    </div>
                  ) : (
                    <div className="text-center max-w-md mx-auto p-6">
                      <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Secure Browser</h2>
                      <p className="text-gray-600">Enter a URL to start browsing securely</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <span>
            Status: {activeTab?.status === 'connected' ? (
              <span className="text-green-400">● Connected</span>
            ) : activeTab?.status === 'connecting' ? (
              <span className="text-yellow-400">● Connecting</span>
            ) : activeTab?.status === 'error' ? (
              <span className="text-red-400">● Error</span>
            ) : (
              <span className="text-gray-400">● Disconnected</span>
            )}
          </span>
          {activeTab?.sessionToken && (
            <span className="text-gray-500">Session: {activeTab.sessionToken.substring(0, 8)}...</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>{bookmarks.length} bookmarks</span>
          <span>{history.length} history items</span>
          {tabs.filter(t => t.status === 'connected').length > 0 && (
            <button
              onClick={handleDisconnectAll}
              className="text-red-400 hover:text-red-300 transition-all"
            >
              Disconnect All
            </button>
          )}
        </div>
      </div>

      {/* Phase 3: URL Scanner Modal */}
      <URLScannerModal
        url={scannerUrl}
        isOpen={showScanner}
        onProceed={handleScanProceed}
        onCancel={handleScanCancel}
      />
    </div>
  );
}
