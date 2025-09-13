'use client'

import { useState, useEffect } from 'react'
import { Globe } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

const languages = [
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
]

export function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const [currentLang, setCurrentLang] = useState('ko')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    // Get current language from localStorage or default to 'ko'
    const savedLang = localStorage.getItem('i18nextLng') || 'ko'
    setCurrentLang(savedLang)
  }, [])

  const handleLanguageChange = (langCode: string) => {
    // Save to localStorage
    localStorage.setItem('i18nextLng', langCode)
    setCurrentLang(langCode)
    setIsOpen(false)

    // Reload the page to apply the language change
    window.location.reload()
  }

  const currentLanguage = languages.find(lang => lang.code === currentLang) || languages[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Globe className="w-4 h-4" />
        <span>{currentLanguage.flag}</span>
        <span className="hidden sm:inline">{currentLanguage.name}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-3 ${
                  currentLang === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}