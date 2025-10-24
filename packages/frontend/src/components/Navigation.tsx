import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Home, ChevronRight } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface NavigationProps {
  breadcrumbs?: Array<{ label: string; path?: string }>;
  showBack?: boolean;
  showHome?: boolean;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  breadcrumbs,
  showBack = true,
  showHome = true,
  className = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { colors } = useTheme();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const handleHome = () => {
    navigate('/dashboard');
  };

  // Auto-generate breadcrumbs from path if not provided
  const autoBreadcrumbs = React.useMemo(() => {
    if (breadcrumbs) return breadcrumbs;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; path?: string }> = [
      { label: 'Home', path: '/dashboard' }
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      crumbs.push({
        label,
        path: index === pathSegments.length - 1 ? undefined : currentPath
      });
    });

    return crumbs;
  }, [location.pathname, breadcrumbs]);

  return (
    <div className={`flex items-center gap-3 mb-6 ${className}`}>
      {/* Back Button */}
      {showBack && (
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: colors.backgroundTertiary,
            color: colors.text,
            border: `1px solid ${colors.border}`
          }}
          title="Go back"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline font-medium text-sm">Back</span>
        </button>
      )}

      {/* Home Button */}
      {showHome && (
        <button
          onClick={handleHome}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 hover:scale-105"
          style={{
            backgroundColor: colors.backgroundTertiary,
            color: colors.text,
            border: `1px solid ${colors.border}`
          }}
          title="Go to home"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline font-medium text-sm">Home</span>
        </button>
      )}

      {/* Breadcrumbs */}
      {autoBreadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 overflow-x-auto">
          {autoBreadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: colors.textTertiary }}
                />
              )}
              {crumb.path ? (
                <Link
                  to={crumb.path}
                  className="text-sm font-medium whitespace-nowrap hover:underline transition-colors duration-200"
                  style={{ color: colors.textSecondary }}
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className="text-sm font-semibold whitespace-nowrap"
                  style={{ color: colors.text }}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
    </div>
  );
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; path?: string }>;
  showBack?: boolean;
  showHome?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  showBack = true,
  showHome = true
}) => {
  const { colors } = useTheme();

  return (
    <div className="mb-6">
      <Navigation
        breadcrumbs={breadcrumbs}
        showBack={showBack}
        showHome={showHome}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
        <div>
          <h1
            className="text-3xl font-bold mb-2"
            style={{ color: colors.text }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-base" style={{ color: colors.textSecondary }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
};
