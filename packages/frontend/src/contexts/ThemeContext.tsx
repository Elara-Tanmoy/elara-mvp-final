import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorScheme = 'blue' | 'purple' | 'green' | 'orange' | 'red';

interface ThemeColors {
  // Primary colors
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;

  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;

  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;

  // Border colors
  border: string;
  borderLight: string;

  // Status colors
  success: string;
  warning: string;
  danger: string;
  info: string;

  // Component colors
  cardBackground: string;
  cardBorder: string;
  inputBackground: string;
  inputBorder: string;
  buttonText: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  colorScheme: ColorScheme;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Color scheme definitions
const colorSchemes: Record<ColorScheme, { light: ThemeColors; dark: ThemeColors }> = {
  blue: {
    light: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primaryLight: '#dbeafe',
      primaryDark: '#1e40af',
      background: '#ffffff',
      backgroundSecondary: '#f9fafb',
      backgroundTertiary: '#f3f4f6',
      text: '#111827',
      textSecondary: '#6b7280',
      textTertiary: '#9ca3af',
      border: '#e5e7eb',
      borderLight: '#f3f4f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#ffffff',
      cardBorder: '#e5e7eb',
      inputBackground: '#ffffff',
      inputBorder: '#d1d5db',
      buttonText: '#ffffff'
    },
    dark: {
      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primaryLight: '#1e3a8a',
      primaryDark: '#1e40af',
      background: '#0f172a',
      backgroundSecondary: '#1e293b',
      backgroundTertiary: '#334155',
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textTertiary: '#94a3b8',
      border: '#334155',
      borderLight: '#1e293b',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#1e293b',
      cardBorder: '#334155',
      inputBackground: '#0f172a',
      inputBorder: '#475569',
      buttonText: '#ffffff'
    }
  },
  purple: {
    light: {
      primary: '#a855f7',
      primaryHover: '#9333ea',
      primaryLight: '#f3e8ff',
      primaryDark: '#7e22ce',
      background: '#ffffff',
      backgroundSecondary: '#faf5ff',
      backgroundTertiary: '#f3e8ff',
      text: '#111827',
      textSecondary: '#6b7280',
      textTertiary: '#9ca3af',
      border: '#e5e7eb',
      borderLight: '#f3f4f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#a855f7',
      cardBackground: '#ffffff',
      cardBorder: '#e5e7eb',
      inputBackground: '#ffffff',
      inputBorder: '#d1d5db',
      buttonText: '#ffffff'
    },
    dark: {
      primary: '#a855f7',
      primaryHover: '#c084fc',
      primaryLight: '#581c87',
      primaryDark: '#7e22ce',
      background: '#0f0a1f',
      backgroundSecondary: '#1e1534',
      backgroundTertiary: '#2d2049',
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textTertiary: '#94a3b8',
      border: '#2d2049',
      borderLight: '#1e1534',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#a855f7',
      cardBackground: '#1e1534',
      cardBorder: '#2d2049',
      inputBackground: '#0f0a1f',
      inputBorder: '#3c2e5f',
      buttonText: '#ffffff'
    }
  },
  green: {
    light: {
      primary: '#10b981',
      primaryHover: '#059669',
      primaryLight: '#d1fae5',
      primaryDark: '#047857',
      background: '#ffffff',
      backgroundSecondary: '#f0fdf4',
      backgroundTertiary: '#dcfce7',
      text: '#111827',
      textSecondary: '#6b7280',
      textTertiary: '#9ca3af',
      border: '#e5e7eb',
      borderLight: '#f3f4f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#ffffff',
      cardBorder: '#e5e7eb',
      inputBackground: '#ffffff',
      inputBorder: '#d1d5db',
      buttonText: '#ffffff'
    },
    dark: {
      primary: '#10b981',
      primaryHover: '#34d399',
      primaryLight: '#064e3b',
      primaryDark: '#047857',
      background: '#0a1f1a',
      backgroundSecondary: '#14342b',
      backgroundTertiary: '#1e493c',
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textTertiary: '#94a3b8',
      border: '#1e493c',
      borderLight: '#14342b',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#14342b',
      cardBorder: '#1e493c',
      inputBackground: '#0a1f1a',
      inputBorder: '#285e4d',
      buttonText: '#ffffff'
    }
  },
  orange: {
    light: {
      primary: '#f97316',
      primaryHover: '#ea580c',
      primaryLight: '#ffedd5',
      primaryDark: '#c2410c',
      background: '#ffffff',
      backgroundSecondary: '#fff7ed',
      backgroundTertiary: '#ffedd5',
      text: '#111827',
      textSecondary: '#6b7280',
      textTertiary: '#9ca3af',
      border: '#e5e7eb',
      borderLight: '#f3f4f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#ffffff',
      cardBorder: '#e5e7eb',
      inputBackground: '#ffffff',
      inputBorder: '#d1d5db',
      buttonText: '#ffffff'
    },
    dark: {
      primary: '#f97316',
      primaryHover: '#fb923c',
      primaryLight: '#7c2d12',
      primaryDark: '#c2410c',
      background: '#1f0f0a',
      backgroundSecondary: '#341a14',
      backgroundTertiary: '#49251e',
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textTertiary: '#94a3b8',
      border: '#49251e',
      borderLight: '#341a14',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#341a14',
      cardBorder: '#49251e',
      inputBackground: '#1f0f0a',
      inputBorder: '#5e3028',
      buttonText: '#ffffff'
    }
  },
  red: {
    light: {
      primary: '#ef4444',
      primaryHover: '#dc2626',
      primaryLight: '#fee2e2',
      primaryDark: '#b91c1c',
      background: '#ffffff',
      backgroundSecondary: '#fef2f2',
      backgroundTertiary: '#fee2e2',
      text: '#111827',
      textSecondary: '#6b7280',
      textTertiary: '#9ca3af',
      border: '#e5e7eb',
      borderLight: '#f3f4f6',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#ffffff',
      cardBorder: '#e5e7eb',
      inputBackground: '#ffffff',
      inputBorder: '#d1d5db',
      buttonText: '#ffffff'
    },
    dark: {
      primary: '#ef4444',
      primaryHover: '#f87171',
      primaryLight: '#7f1d1d',
      primaryDark: '#b91c1c',
      background: '#1f0a0a',
      backgroundSecondary: '#341414',
      backgroundTertiary: '#491e1e',
      text: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textTertiary: '#94a3b8',
      border: '#491e1e',
      borderLight: '#341414',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      cardBackground: '#341414',
      cardBorder: '#491e1e',
      inputBackground: '#1f0a0a',
      inputBorder: '#5e2828',
      buttonText: '#ffffff'
    }
  }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('elara-theme-mode');
    return (saved as ThemeMode) || 'light';
  });

  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    const saved = localStorage.getItem('elara-color-scheme');
    return (saved as ColorScheme) || 'blue';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Listen to system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Determine if dark mode should be active
  const isDark = mode === 'dark' || (mode === 'auto' && systemPrefersDark);

  // Get current colors based on mode and scheme
  const colors = colorSchemes[colorScheme][isDark ? 'dark' : 'light'];

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Apply CSS custom properties
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Apply dark class to body
    if (isDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }

    // Set background color
    document.body.style.backgroundColor = colors.background;
  }, [colors, isDark]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('elara-theme-mode', newMode);
  };

  const setColorScheme = (newScheme: ColorScheme) => {
    setColorSchemeState(newScheme);
    localStorage.setItem('elara-color-scheme', newScheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colorScheme,
        isDark,
        setMode,
        setColorScheme,
        colors
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
