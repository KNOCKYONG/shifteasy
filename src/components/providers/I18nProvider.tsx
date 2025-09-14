'use client'

import { useEffect, useState } from 'react'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { getOptions } from '@/lib/i18n/settings'

// Get stored language preference or default to 'ko'
const getStoredLanguage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('language') || 'ko'
  }
  return 'ko'
}

// Create and initialize i18n instance
const i18nInstance = i18next.createInstance()

// Initialize once
if (!i18nInstance.isInitialized) {
  i18nInstance
    .use(initReactI18next)
    .use(resourcesToBackend((language: string, namespace: string) =>
      import(`@/lib/i18n/locales/${language}/${namespace}.json`)
    ))
    .init({
      ...getOptions(),
      lng: 'ko',
      fallbackLng: 'ko',
      react: {
        useSuspense: false
      }
    })
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const initI18n = async () => {
      // Wait for i18n to be initialized
      if (!i18nInstance.isInitialized) {
        await i18nInstance.init()
      }

      // After mounting, set the correct language from localStorage
      const lng = getStoredLanguage()
      if (lng !== i18nInstance.language) {
        await i18nInstance.changeLanguage(lng)
      }

      setIsReady(true)
    }

    initI18n()
  }, [])

  // Show loading state while i18n is initializing
  if (!isReady) {
    return <div>{children}</div>
  }

  return (
    <I18nextProvider i18n={i18nInstance}>
      {children}
    </I18nextProvider>
  )
}