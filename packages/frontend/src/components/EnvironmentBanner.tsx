/**
 * ENVIRONMENT BANNER COMPONENT
 * Displays prominent banner for DEV and STAGING environments
 * Prevents accidental modifications in non-production environments
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

const EnvironmentBanner: React.FC = () => {
  // Get environment from Vite environment variables
  const environment = import.meta.env.VITE_ENVIRONMENT || 'production';

  // Only show banner in dev and staging
  if (environment === 'production') {
    return null;
  }

  const config = {
    development: {
      text: 'DEVELOPMENT ENVIRONMENT',
      bgColor: 'bg-gradient-to-r from-orange-500 via-orange-600 to-red-600',
      textColor: 'text-white',
      icon: AlertTriangle,
      pulseColor: 'bg-orange-300',
      message: 'This is the DEVELOPMENT environment. All changes here are for testing purposes only.',
    },
    staging: {
      text: 'STAGING ENVIRONMENT',
      bgColor: 'bg-gradient-to-r from-yellow-500 via-amber-600 to-orange-600',
      textColor: 'text-white',
      icon: AlertTriangle,
      pulseColor: 'bg-yellow-300',
      message: 'This is the STAGING environment. Use this for final testing before production.',
    },
  };

  const envConfig = config[environment as keyof typeof config] || config.development;
  const Icon = envConfig.icon;

  return (
    <>
      {/* Top Banner - Desktop & Mobile */}
      <div
        className={`${envConfig.bgColor} ${envConfig.textColor} sticky top-0 z-50 shadow-lg border-b-4 border-white/30`}
        style={{ WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {/* Animated Icon */}
            <div className="relative">
              <div className={`absolute inset-0 ${envConfig.pulseColor} opacity-75 blur-md animate-pulse`}></div>
              <Icon className="w-6 h-6 relative animate-bounce" />
            </div>

            {/* Environment Label */}
            <div className="flex items-center gap-3">
              <span className="text-lg md:text-xl font-black tracking-wider drop-shadow-lg uppercase">
                {envConfig.text}
              </span>
              <span className="hidden sm:inline-block text-xs md:text-sm font-semibold bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                {envConfig.message}
              </span>
            </div>

            {/* Animated Pulse Indicator */}
            <div className="flex items-center gap-2">
              <div className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${envConfig.pulseColor} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${envConfig.pulseColor}`}></span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest hidden md:inline">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Mobile Message */}
          <div className="sm:hidden text-center mt-2">
            <span className="text-xs font-semibold">
              {envConfig.message}
            </span>
          </div>
        </div>
      </div>

      {/* Watermark Overlay - Always Visible */}
      <div
        className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center"
        style={{ mixBlendMode: 'overlay' }}
      >
        <div className="transform -rotate-45 opacity-5">
          <div className={`text-9xl font-black ${envConfig.textColor} whitespace-nowrap select-none`}>
            {envConfig.text}
          </div>
        </div>
      </div>

      {/* Corner Badge - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
        <div className={`${envConfig.bgColor} ${envConfig.textColor} px-4 py-2 rounded-lg shadow-2xl border-2 border-white/50 backdrop-blur-md`}>
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-wider">
              {environment}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default EnvironmentBanner;
