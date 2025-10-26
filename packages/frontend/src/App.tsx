import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LayoutAccessible from './components/LayoutAccessible';
import Login from './pages/Login';
import Register from './pages/Register';
import URLScannerAccessible from './pages/URLScannerAccessible';
import MessageScanner from './pages/MessageScanner';
import FileScanner from './pages/FileScanner';
import ScanHistory from './pages/ScanHistory';
import ProfileAnalyzerEnhanced from './pages/ProfileAnalyzerEnhanced';
import FactChecker from './pages/FactChecker';
import LiteracyCoach from './pages/LiteracyCoach';
import RecoverySupport from './pages/RecoverySupport';
import ChatbotAdmin from './pages/ChatbotAdmin';
import AdminPanel from './pages/AdminPanel';
import ProxyBrowser from './pages/ProxyBrowser';
import TrustGraph from './pages/TrustGraph';
import DataIntelligence from './pages/admin/DataIntelligence';
import ScanAnalytics from './pages/admin/ScanAnalytics';
import ThreatIntelligence from './pages/admin/ThreatIntelligence';
import ThreatIntelConfig from './pages/admin/ThreatIntelConfig';
import WhatsAppDashboard from './pages/admin/WhatsAppDashboard';
import ScanEngineAdmin from './pages/admin/ScanEngineAdmin';
import V2ScannerConfig from './pages/admin/V2ScannerConfig';
import V2ConfigPage from './pages/admin/V2ConfigPage';
import V2TestPage from './pages/admin/V2TestPage';
import GlobalSettings from './pages/admin/GlobalSettings';
import { Dashboard } from './pages/Dashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/proxy-browser"
        element={
          <ProtectedRoute>
            <ProxyBrowser />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <LayoutAccessible />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="scan/url" element={<URLScannerAccessible />} />
        <Route path="scan/message" element={<MessageScanner />} />
        <Route path="scan/file" element={<FileScanner />} />
        <Route path="history" element={<ScanHistory />} />
        <Route path="analyze/profile" element={<ProfileAnalyzerEnhanced />} />
        <Route path="analyze/fact" element={<FactChecker />} />
        <Route path="literacy" element={<LiteracyCoach />} />
        <Route path="recovery" element={<RecoverySupport />} />
        <Route path="trust-graph" element={<TrustGraph />} />
        <Route path="admin" element={<AdminPanel />} />
        <Route path="admin/intelligence" element={<DataIntelligence />} />
        <Route path="admin/scan-analytics" element={<ScanAnalytics />} />
        <Route path="admin/threat-intelligence" element={<ThreatIntelligence />} />
        <Route path="admin/threat-intel-config" element={<ThreatIntelConfig />} />
        <Route path="admin/whatsapp" element={<WhatsAppDashboard />} />
        <Route path="admin/scan-engine" element={<ScanEngineAdmin />} />
        <Route path="admin/v2-scanner" element={<V2ScannerConfig />} />
        <Route path="admin/v2-config" element={<V2ConfigPage />} />
        <Route path="admin/v2-test" element={<V2TestPage />} />
        <Route path="admin/global-settings" element={<GlobalSettings />} />
        <Route path="chatbot/admin" element={<ChatbotAdmin />} />
        {/* Catch-all 404 route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
      {/* Catch-all for routes outside LayoutAccessible */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
