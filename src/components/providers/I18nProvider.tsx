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

// Initialize i18next
const initI18n = async () => {
  const lng = getStoredLanguage()

  if (!i18next.isInitialized) {
    await i18next
      .use(initReactI18next)
      .use(resourcesToBackend((language: string, namespace: string) =>
        import(`@/lib/i18n/locales/${language}/${namespace}.json`)
      ))
      .init({
        ...getOptions(),
        lng,
        fallbackLng: 'ko',
        react: {
          useSuspense: false
        }
      })
  }

  return i18next
}

// Initialize i18n immediately
const i18nPromise = initI18n()

// Create a pre-initialized instance for SSR
const preInitI18n = i18next.createInstance()
preInitI18n
  .use(initReactI18next)
  .use(resourcesToBackend((language: string, namespace: string) =>
    import(`@/lib/i18n/locales/${language}/${namespace}.json`)
  ))
  .init({
    ...getOptions(),
    lng: 'ko', // Always start with Korean for SSR
    fallbackLng: 'ko',
    react: {
      useSuspense: false
    }
  })

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [i18n, setI18n] = useState<typeof i18next>(preInitI18n)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    // After mounting, initialize with the correct language from localStorage
    const initClientI18n = async () => {
      const lng = getStoredLanguage()
      if (lng !== 'ko') {
        await i18n.changeLanguage(lng)
      }
    }
    initClientI18n()
  }, [i18n])

  return (
    <I18nextProvider i18n={i18n}>
      {children}
    </I18nextProvider>
  )
}