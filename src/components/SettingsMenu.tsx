"use client"

import { useState, useEffect } from 'react'
import { Settings, Globe, Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
]

export function SettingsMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme()
  const { i18n } = useTranslation()
  const [currentLang, setCurrentLang] = useState('ko')

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('i18nextLng') || 'ko'
      setCurrentLang(savedLang)
    }
  }, [])

  const handleLanguageChange = (langCode: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('i18nextLng', langCode)
      setCurrentLang(langCode)
      i18n.changeLanguage(langCode)
      window.location.reload()
    }
  }

  if (!mounted) return null

  const isSystem = theme === 'system'
  const effectiveTheme = (resolvedTheme || systemTheme || theme) as 'light' | 'dark'

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Settings"
      >
        <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* 언어 선택 섹션 */}
            <div className="p-3 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Globe className="w-4 h-4" />
                <span>언어 / Language</span>
              </div>
              <select
                value={currentLang}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 테마 모드 선택 (System / Light / Dark) */}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span>테마</span>
                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">(
                  {isSystem ? '시스템 따름' : effectiveTheme === 'dark' ? '다크' : '라이트'}
                )</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme('system')}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    theme === 'system'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Monitor className="w-4 h-4" /> 시스템
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    theme === 'light'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Sun className="w-4 h-4" /> 라이트
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    theme === 'dark'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <Moon className="w-4 h-4" /> 다크
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
