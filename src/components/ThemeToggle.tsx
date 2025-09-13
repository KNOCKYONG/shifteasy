'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="relative w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse">
        <span className="sr-only">Loading theme toggle</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-700 shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-110 active:scale-95 group overflow-hidden"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Sun icon - visible in light mode */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
          theme === 'dark' ? 'opacity-0 rotate-180 scale-50' : 'opacity-100 rotate-0 scale-100'
        }`}
      >
        <Sun className="w-6 h-6 text-amber-500 drop-shadow-lg" />
        {/* Sun rays animation */}
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-amber-400 rounded-full animate-pulse"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${i * 45}deg) translateX(16px) translate(-50%, -50%)`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Moon icon - visible in dark mode */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
          theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-50'
        }`}
      >
        <Moon className="w-6 h-6 text-slate-300 drop-shadow-lg" />
        {/* Stars animation */}
        <div className="absolute inset-0">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute w-0.5 h-0.5 bg-white rounded-full animate-twinkle"
              style={{
                top: `${20 + i * 15}%`,
                left: `${20 + i * 20}%`,
                animationDelay: `${i * 0.3}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Ripple effect on click */}
      <span className="absolute inset-0 rounded-full bg-white dark:bg-gray-600 opacity-0 animate-ripple-once" />
    </button>
  );
}