import React from 'react';
import { useTheme, ThemeMode, ColorScheme } from '../contexts/ThemeContext';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';

interface ThemeSettingsProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({
  className = '',
  showLabel = true
}) => {
  const { mode, colorScheme, setMode, setColorScheme, colors } = useTheme();

  const modes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'auto', label: 'Auto', icon: <Monitor className="w-4 h-4" /> }
  ];

  const schemes: { value: ColorScheme; label: string; color: string }[] = [
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'purple', label: 'Purple', color: '#a855f7' },
    { value: 'green', label: 'Green', color: '#10b981' },
    { value: 'orange', label: 'Orange', color: '#f97316' },
    { value: 'red', label: 'Red', color: '#ef4444' }
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Theme Mode Selection */}
      <div>
        {showLabel && (
          <div className="flex items-center gap-2 mb-3">
            <Sun className="w-5 h-5" style={{ color: colors.textSecondary }} />
            <label className="text-sm font-medium" style={{ color: colors.text }}>
              Theme Mode
            </label>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm"
              style={{
                backgroundColor: mode === m.value ? colors.primary : colors.backgroundTertiary,
                color: mode === m.value ? colors.buttonText : colors.text,
                border: `1px solid ${mode === m.value ? colors.primary : colors.border}`
              }}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color Scheme Selection */}
      <div>
        {showLabel && (
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-5 h-5" style={{ color: colors.textSecondary }} />
            <label className="text-sm font-medium" style={{ color: colors.text }}>
              Color Scheme
            </label>
          </div>
        )}
        <div className="grid grid-cols-5 gap-2">
          {schemes.map((s) => (
            <button
              key={s.value}
              onClick={() => setColorScheme(s.value)}
              className="flex flex-col items-center gap-2 p-3 rounded-lg transition-all duration-200"
              style={{
                backgroundColor: colorScheme === s.value ? colors.backgroundTertiary : colors.backgroundSecondary,
                border: `2px solid ${colorScheme === s.value ? s.color : colors.border}`
              }}
              title={s.label}
            >
              <div
                className="w-8 h-8 rounded-full"
                style={{
                  backgroundColor: s.color,
                  boxShadow: colorScheme === s.value ? `0 0 0 3px ${colors.background}, 0 0 0 5px ${s.color}40` : 'none'
                }}
              />
              <span
                className="text-xs font-medium"
                style={{ color: colorScheme === s.value ? colors.text : colors.textSecondary }}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview Card */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: colors.cardBackground,
          border: `1px solid ${colors.cardBorder}`
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold" style={{ color: colors.text }}>
            Theme Preview
          </h4>
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: colors.primary }}
          />
        </div>
        <p className="text-sm mb-3" style={{ color: colors.textSecondary }}>
          This is how your theme will look across the application
        </p>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200"
            style={{
              backgroundColor: colors.primary,
              color: colors.buttonText
            }}
          >
            Primary Button
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200"
            style={{
              backgroundColor: colors.backgroundTertiary,
              color: colors.text,
              border: `1px solid ${colors.border}`
            }}
          >
            Secondary
          </button>
        </div>
      </div>
    </div>
  );
};
