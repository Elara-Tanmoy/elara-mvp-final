import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Shield, Home, Link as LinkIcon, Mail, FileText, History, LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ChatbotWidget from './ChatbotWidget';

const Layout: React.FC = () => {
  const { user, organization, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-primary-600" />
                <span className="text-xl font-bold text-gray-900">Elara</span>
              </Link>

              <div className="hidden md:flex ml-10 space-x-4">
                <Link to="/" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 rounded-md">
                  <Home className="w-4 h-4" />
                  Home
                </Link>
                <Link to="/scan/url" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 rounded-md">
                  <LinkIcon className="w-4 h-4" />
                  URL Scanner
                </Link>
                <Link to="/scan/message" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 rounded-md">
                  <Mail className="w-4 h-4" />
                  Message Scanner
                </Link>
                <Link to="/scan/file" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 rounded-md">
                  <FileText className="w-4 h-4" />
                  File Scanner
                </Link>
                <Link to="/history" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 rounded-md">
                  <History className="w-4 h-4" />
                  History
                </Link>
                {user?.role === 'admin' && (
                  <>
                    <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 rounded-md">
                      <Shield className="w-4 h-4" />
                      Admin Panel
                    </Link>
                    <Link to="/chatbot/admin" className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 rounded-md">
                      <Settings className="w-4 h-4" />
                      Chatbot Admin
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-600" />
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</div>
                  <div className="text-gray-500 text-xs">{organization?.name}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-red-600 rounded-md"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Chatbot Widget - Available on all pages */}
      <ChatbotWidget />
    </div>
  );
};

export default Layout;
