/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client'

import i18next from 'i18next'
import { initReactI18next, useTranslation as useTranslationOrg } from 'react-i18next'
import { useMemo } from 'react'
import { getOptions } from './settings'
import resourcesToBackend from 'i18next-resources-to-backend'

const runsOnServerSide = typeof window === 'undefined'

i18next
  .use(initReactI18next)
  .use(resourcesToBackend((language: string, namespace: string) =>
    import(`@/lib/i18n/locales/${language}/${namespace}.json`)
  ))
  .init({
    ...getOptions(),
    lng: undefined,
    detection: {
      order: ['path', 'htmlTag', 'cookie', 'navigator'],
    },
    preload: runsOnServerSide ? ['ko', 'en', 'ja'] : []
  })

export function useTranslation(lng: string, ns?: string, options?: any) {
  const translator = useTranslationOrg(ns, options)
  const { i18n } = translator

  if (runsOnServerSide && lng && i18n.resolvedLanguage !== lng) {
    i18n.changeLanguage(lng)
  } else {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMemo(() => {
      if (lng && i18n.resolvedLanguage !== lng) {
        i18n.changeLanguage(lng)
      }
    }, [lng, i18n])
  }

  return translator
}