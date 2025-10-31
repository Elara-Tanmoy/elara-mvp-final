/**
 * ENTERPRISE-GRADE RESPONSIVE LAYOUT - VERTICAL SIDEBAR DESIGN
 * Professional vertical sidebar navigation for desktop
 * Fully responsive for desktop, tablet, and mobile
 * Optimized for accessibility and modern UI standards
 */

import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Shield,
  Home,
  Link as LinkIcon,
  History,
  LogOut,
  Menu,
  X,
  Mail,
  FileText,
  Settings,
  ChevronDown,
  Video,
  CheckCircle,
  BookOpen,
  HeartHandshake,
  GitBranch,
  Database,
  BarChart3,
  MessageSquare,
  Palette,
  Globe,
  TestTube
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ChatbotWidget from './ChatbotWidget';
import { ThemeSettings } from './ThemeSettings';
import EnvironmentBanner from './EnvironmentBanner';

const LayoutAccessible: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      logout();
      navigate('/login');
    }
  };

  const isActivePage = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Environment Banner - Only shown in DEV and STAGING */}
      <EnvironmentBanner />

      {/* Vertical Sidebar - Desktop Only */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow border-r border-gray-200 bg-white shadow-xl overflow-y-auto">
          {/* Logo Section */}
          <div className="flex items-center flex-shrink-0 px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="relative">
                <Shield className="w-10 h-10 text-blue-600 group-hover:text-blue-700 transition-colors" />
                <div className="absolute inset-0 bg-blue-400 opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Elara
                </span>
                <span className="text-xs text-gray-600 font-medium">Threat Intel Platform</span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1">
            {/* Core Features */}
            <div className="mb-6">
              <h3 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Core Features
              </h3>

              <Link
                to="/"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/') && location.pathname === '/'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <Home className="w-5 h-5" />
                <span>Home</span>
              </Link>

              <Link
                to="/scan/url"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/scan/url')
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <LinkIcon className="w-5 h-5" />
                <span>URL Scanner</span>
              </Link>

              <Link
                to="/scan/message"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/scan/message')
                    ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <Mail className="w-5 h-5" />
                <span>Message Scanner</span>
              </Link>

              <Link
                to="/scan/file"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/scan/file')
                    ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <FileText className="w-5 h-5" />
                <span>File Scanner</span>
              </Link>

              <Link
                to="/history"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/history')
                    ? 'bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100'}`}
              >
                <History className="w-5 h-5" />
                <span>Scan History</span>
              </Link>
            </div>

            {/* AI Features */}
            <div className="mb-6">
              <h3 className="px-3 text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">
                AI Features
              </h3>

              <Link
                to="/analyze/profile"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/analyze/profile')
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-purple-50'}`}
              >
                <Video className="w-5 h-5" />
                <span>Deepfake Detector</span>
              </Link>

              <Link
                to="/analyze/fact"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/analyze/fact')
                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-fuchsia-50'}`}
              >
                <CheckCircle className="w-5 h-5" />
                <span>Fact Checker</span>
              </Link>
            </div>

            {/* Education & Support */}
            <div className="mb-6">
              <h3 className="px-3 text-xs font-bold text-green-600 uppercase tracking-wider mb-2">
                Education & Support
              </h3>

              <Link
                to="/literacy"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/literacy')
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-green-50'}`}
              >
                <BookOpen className="w-5 h-5" />
                <span>Digital Literacy</span>
              </Link>

              <Link
                to="/recovery"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/recovery')
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-emerald-50'}`}
              >
                <HeartHandshake className="w-5 h-5" />
                <span>Recovery Support</span>
              </Link>
            </div>

            {/* Advanced Tools */}
            <div className="mb-6">
              <h3 className="px-3 text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">
                Advanced Tools
              </h3>

              <Link
                to="/proxy-browser"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/proxy-browser')
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-cyan-50'}`}
              >
                <Globe className="w-5 h-5" />
                <span>Secure Web Proxy</span>
              </Link>

              <Link
                to="/trust-graph"
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                  ${isActivePage('/trust-graph')
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                    : 'text-gray-700 hover:bg-orange-50'}`}
              >
                <GitBranch className="w-5 h-5" />
                <span>Trust Network</span>
              </Link>
            </div>

            {/* Admin Features */}
            {user?.role === 'admin' && (
              <div className="mb-6 pt-4 border-t border-gray-200">
                <h3 className="px-3 text-xs font-bold text-red-600 uppercase tracking-wider mb-2">
                  Admin Controls
                </h3>

                <Link
                  to="/admin"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin') && location.pathname === '/admin'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-red-50'}`}
                >
                  <Shield className="w-5 h-5" />
                  <span>Admin Panel</span>
                </Link>

                <Link
                  to="/admin/threat-intelligence"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin/threat-intelligence')
                      ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-rose-50'}`}
                >
                  <Database className="w-5 h-5" />
                  <span>Threat Intelligence</span>
                </Link>

                <Link
                  to="/admin/scan-analytics"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin/scan-analytics')
                      ? 'bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-pink-50'}`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Scan Analytics</span>
                </Link>

                <Link
                  to="/admin/whatsapp"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin/whatsapp')
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-green-50'}`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>WhatsApp Admin</span>
                </Link>

                <Link
                  to="/chatbot/admin"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/chatbot/admin')
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-violet-50'}`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Chatbot Admin</span>
                </Link>

                <Link
                  to="/admin/scan-engine"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin/scan-engine')
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-indigo-50'}`}
                >
                  <Shield className="w-5 h-5" />
                  <span>Scan Engine Admin</span>
                </Link>

                <Link
                  to="/admin/v2-test"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin/v2-test')
                      ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-purple-50'}`}
                >
                  <TestTube className="w-5 h-5" />
                  <span>V2 Scanner Test Lab</span>
                </Link>

                                <Link
                  to="/admin/global-settings"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin/global-settings')
                      ? 'bg-gradient-to-r from-slate-600 to-gray-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-slate-50'}`}
                >
                  <Settings className="w-5 h-5" />
                  <span>Global Settings</span>
                </Link>
              </div>
            )}
          </nav>

          {/* User Profile - Sidebar Bottom */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-gray-50 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-bold text-gray-900 truncate">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <div className="text-xs text-gray-600 truncate">{organization?.name}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenuOpen(false)}
                  ></div>
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-2xl border border-gray-200 py-2 z-20">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="text-sm font-bold text-gray-900">{user?.email}</div>
                      {user?.role === 'admin' && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold rounded-full">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        setSettingsModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Palette className="w-4 h-4" />
                      Theme Settings
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="lg:hidden bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex justify-between items-center">
            {/* Mobile Logo */}
            <Link to="/" className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-600" />
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Elara
              </span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white shadow-2xl max-h-[calc(100vh-5rem)] overflow-y-auto">
            <div className="px-4 py-4 space-y-2">
              {/* User Info - Mobile */}
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <div className="text-xs text-gray-600">{organization?.name}</div>
                    {user?.role === 'admin' && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold rounded-full">
                        ADMIN
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mobile Navigation Links */}
              <div className="space-y-1">
                <p className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Core Features</p>

                <Link
                  to="/"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/') && location.pathname === '/'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={closeMobileMenu}
                >
                  <Home className="w-5 h-5" />
                  <span>Home</span>
                </Link>

                <Link
                  to="/scan/url"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/scan/url')
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={closeMobileMenu}
                >
                  <LinkIcon className="w-5 h-5" />
                  <span>URL Scanner</span>
                </Link>

                <Link
                  to="/scan/message"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/scan/message')
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={closeMobileMenu}
                >
                  <Mail className="w-5 h-5" />
                  <span>Message Scanner</span>
                </Link>

                <Link
                  to="/scan/file"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/scan/file')
                      ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={closeMobileMenu}
                >
                  <FileText className="w-5 h-5" />
                  <span>File Scanner</span>
                </Link>

                <Link
                  to="/history"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/history')
                      ? 'bg-gradient-to-r from-slate-600 to-gray-700 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-50'}`}
                  onClick={closeMobileMenu}
                >
                  <History className="w-5 h-5" />
                  <span>Scan History</span>
                </Link>

                <div className="my-3 border-t border-gray-200"></div>
                <p className="px-3 text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">AI Features</p>

                <Link
                  to="/analyze/profile"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/analyze/profile')
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-purple-50'}`}
                  onClick={closeMobileMenu}
                >
                  <Video className="w-5 h-5" />
                  <span>Deepfake Detector</span>
                </Link>

                <Link
                  to="/analyze/fact"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/analyze/fact')
                      ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-fuchsia-50'}`}
                  onClick={closeMobileMenu}
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Fact Checker</span>
                </Link>

                <div className="my-3 border-t border-gray-200"></div>
                <p className="px-3 text-xs font-bold text-green-600 uppercase tracking-wider mb-2">Education & Support</p>

                <Link
                  to="/literacy"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/literacy')
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-green-50'}`}
                  onClick={closeMobileMenu}
                >
                  <BookOpen className="w-5 h-5" />
                  <span>Digital Literacy</span>
                </Link>

                <Link
                  to="/recovery"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/recovery')
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-emerald-50'}`}
                  onClick={closeMobileMenu}
                >
                  <HeartHandshake className="w-5 h-5" />
                  <span>Recovery Support</span>
                </Link>

                <div className="my-3 border-t border-gray-200"></div>
                <p className="px-3 text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">Advanced Tools</p>

                <Link
                  to="/proxy-browser"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/proxy-browser')
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-cyan-50'}`}
                  onClick={closeMobileMenu}
                >
                  <Globe className="w-5 h-5" />
                  <span>Secure Web Proxy</span>
                </Link>

                <Link
                  to="/trust-graph"
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/trust-graph')
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-orange-50'}`}
                  onClick={closeMobileMenu}
                >
                  <GitBranch className="w-5 h-5" />
                  <span>Trust Network</span>
                </Link>

                {/* Admin Features - Mobile */}
                {user?.role === 'admin' && (
                  <>
                    <div className="my-3 border-t-2 border-red-200"></div>
                    <p className="px-3 text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Admin Controls</p>

                    <Link
                      to="/admin"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/admin') && location.pathname === '/admin'
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-red-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <Shield className="w-5 h-5" />
                      <span>Admin Panel</span>
                    </Link>

                    <Link
                      to="/admin/threat-intelligence"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/admin/threat-intelligence')
                          ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-rose-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <Database className="w-5 h-5" />
                      <span>Threat Intelligence</span>
                    </Link>

                    <Link
                      to="/admin/scan-analytics"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/admin/scan-analytics')
                          ? 'bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-pink-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <BarChart3 className="w-5 h-5" />
                      <span>Scan Analytics</span>
                    </Link>

                    <Link
                      to="/admin/whatsapp"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/admin/whatsapp')
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-green-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>WhatsApp Admin</span>
                    </Link>

                    <Link
                      to="/chatbot/admin"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/chatbot/admin')
                          ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-violet-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <Settings className="w-5 h-5" />
                      <span>Chatbot Admin</span>
                    </Link>

                    <Link
                      to="/admin/scan-engine"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/admin/scan-engine')
                          ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-indigo-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <Shield className="w-5 h-5" />
                      <span>Scan Engine Admin</span>
                    </Link>

                <Link
                  to="/admin/v2-test"
                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
                    ${isActivePage('/admin/v2-test')
                      ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-md'
                      : 'text-gray-700 hover:bg-purple-50'}`}
                >
                  <TestTube className="w-5 h-5" />
                  <span>V2 Scanner Test Lab</span>
                </Link>

                    <Link
                      to="/admin/v2-test"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/admin/v2-test')
                          ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-purple-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <TestTube className="w-5 h-5" />
                      <span>V2 Scanner Test Lab</span>
                    </Link>

                                        <Link
                      to="/admin/global-settings"
                      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all
                        ${isActivePage('/admin/global-settings')
                          ? 'bg-gradient-to-r from-slate-600 to-gray-600 text-white shadow-md'
                          : 'text-gray-700 hover:bg-slate-50'}`}
                      onClick={closeMobileMenu}
                    >
                      <Settings className="w-5 h-5" />
                      <span>Global Settings</span>
                    </Link>
                  </>
                )}

                {/* Theme Settings & Logout - Mobile */}
                <div className="mt-4 pt-4 border-t-2 border-gray-200 space-y-2">
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      setSettingsModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg border-2 border-gray-200 transition-all"
                  >
                    <Palette className="w-5 h-5" />
                    <span>Theme Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      closeMobileMenu();
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 rounded-lg shadow-lg transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Adjusted for sidebar */}
      <main className="lg:pl-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>

      {/* Chatbot Widget - Hide on home page to avoid duplicate */}
      {location.pathname !== '/' && <ChatbotWidget />}

      {/* Skip to content link for screen readers */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Theme Settings Modal */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
              onClick={() => setSettingsModalOpen(false)}
            ></div>

            {/* Modal */}
            <div
              className="relative w-full max-w-2xl rounded-xl shadow-2xl transform transition-all"
              style={{ backgroundColor: colors.cardBackground, border: `1px solid ${colors.cardBorder}` }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: colors.border }}
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-6 h-6" style={{ color: colors.primary }} />
                  <h2 className="text-xl font-bold" style={{ color: colors.text }}>
                    Theme Settings
                  </h2>
                </div>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: colors.backgroundTertiary,
                    color: colors.textSecondary
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6">
                <ThemeSettings showLabel={true} />
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-end gap-3 px-6 py-4 border-t"
                style={{ borderColor: colors.border }}
              >
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-all"
                  style={{
                    backgroundColor: colors.primary,
                    color: colors.buttonText
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutAccessible;
