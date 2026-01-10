import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#1f2937' : '#ffffff');
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolvedTheme: getSystemTheme(),

      setMode: (mode: ThemeMode) => {
        const resolvedTheme = mode === 'system' ? getSystemTheme() : mode;
        applyTheme(resolvedTheme);
        set({ mode, resolvedTheme });
      },

      toggleTheme: () => {
        const currentMode = get().mode;
        // Cycle: light -> dark -> system -> light
        let newMode: ThemeMode;
        if (currentMode === 'light') {
          newMode = 'dark';
        } else if (currentMode === 'dark') {
          newMode = 'system';
        } else {
          newMode = 'light';
        }
        const resolvedTheme = newMode === 'system' ? getSystemTheme() : newMode;
        applyTheme(resolvedTheme);
        set({ mode: newMode, resolvedTheme });
      },
    }),
    {
      name: 'boxtasks-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolvedTheme = state.mode === 'system' ? getSystemTheme() : state.mode;
          applyTheme(resolvedTheme);
          state.resolvedTheme = resolvedTheme;
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = () => {
    const state = useThemeStore.getState();
    if (state.mode === 'system') {
      const resolvedTheme = getSystemTheme();
      applyTheme(resolvedTheme);
      useThemeStore.setState({ resolvedTheme });
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else {
    mediaQuery.addListener(handleChange);
  }
}
