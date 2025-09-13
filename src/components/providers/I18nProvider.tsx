'use client'

import { Suspense } from 'react'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { getOptions } from '@/lib/i18n/settings'

// Initialize i18next synchronously
i18next
  .use(initReactI18next)
  .use(resourcesToBackend((language: string, namespace: string) =>
    import(`@/lib/i18n/locales/${language}/${namespace}.json`)
  ))
  .init({
    ...getOptions(),
    lng: 'ko',
    fallbackLng: 'ko',
    react: {
      useSuspense: false // Disable suspense to avoid hydration issues
    }
  })

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <I18nextProvider i18n={i18next}>
        {children}
      </I18nextProvider>
    </Suspense>
  )
}