'use client'

import { useState, useEffect } from 'react'
import { Settings, Globe, Moon, Sun, Check } from 'lucide-react'
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
  const { theme, setTheme } = useTheme()
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

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  if (!mounted) {
    return null
  }

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
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* 언어 선택 섹션 */}
            <div className="p-3 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Globe className="w-4 h-4" />
                <span>언어 / Language</span>
              </div>
              {/* 드롭다운 선택 */}
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

            {/* 다크모드 토글 섹션 */}
            <div className="p-3">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Moon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    다크모드
                  </span>
                </div>
                <div className={`relative w-12 h-6 rounded-full transition-colors ${
                  theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'
                }`}>
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}