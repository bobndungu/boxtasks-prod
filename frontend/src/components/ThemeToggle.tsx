import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore } from '../lib/stores/theme';

interface ThemeToggleProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'light';
}

export function ThemeToggle({ showLabel = false, size = 'md', variant = 'default' }: ThemeToggleProps) {
  const { mode, toggleTheme } = useThemeStore();

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const variantClasses = {
    default: 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
    light: 'text-white hover:bg-white/20',
  };

  return (
    <button
      onClick={toggleTheme}
      className={`${sizeClasses[size]} rounded-lg ${variantClasses[variant]} transition-colors flex items-center gap-2`}
      aria-label={`Toggle theme (currently ${mode})`}
      title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}
    >
      {mode === 'dark' ? (
        <Moon className={iconSizes[size]} />
      ) : (
        <Sun className={iconSizes[size]} />
      )}
      {showLabel && (
        <span className="text-sm">
          {mode === 'dark' ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}

// Theme selector with all three options
interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className = '' }: ThemeSelectorProps) {
  const { mode, setMode } = useThemeStore();

  const options = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className={`flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setMode(option.value)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Dropdown version for mobile/compact spaces
export function ThemeDropdown() {
  const { mode, setMode, resolvedTheme } = useThemeStore();

  return (
    <div className="relative">
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')}
        className="appearance-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Select theme"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System ({resolvedTheme})</option>
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        {resolvedTheme === 'dark' ? (
          <Moon className="h-4 w-4 text-gray-400" />
        ) : (
          <Sun className="h-4 w-4 text-gray-400" />
        )}
      </div>
    </div>
  );
}
