'use client'

import { useEffect, useState } from 'react'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { getOptions } from '@/lib/i18n/settings'

const runsOnServerSide = typeof window === 'undefined'

// Initialize i18next
i18next
  .use(initReactI18next)
  .use(resourcesToBackend((language: string, namespace: string) =>
    import(`@/lib/i18n/locales/${language}/${namespace}.json`)
  ))
  .init({
    ...getOptions(),
    lng: undefined,
    detection: {
      order: ['localStorage', 'cookie', 'navigator'],
      caches: ['localStorage', 'cookie'],
    },
    preload: runsOnServerSide ? ['ko', 'en', 'ja'] : []
  })

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Get saved language from localStorage
    const savedLang = localStorage.getItem('i18nextLng') || 'ko'

    // Change language if needed
    if (i18next.language !== savedLang) {
      i18next.changeLanguage(savedLang).then(() => {
        setIsReady(true)
      })
    } else {
      setIsReady(true)
    }
  }, [])

  if (!isReady) {
    return <div>Loading...</div>
  }

  return (
    <I18nextProvider i18n={i18next}>
      {children}
    </I18nextProvider>
  )
}