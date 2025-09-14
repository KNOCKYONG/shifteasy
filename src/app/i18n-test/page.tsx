'use client'

import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

export default function I18nTestPage() {
  const { t, i18n } = useTranslation(['common'])
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
  }, [])

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('language', lng)
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">i18n Test Page</h1>

      <div className="mb-4">
        <p>Current Language: <strong>{i18n.language}</strong></p>
        <p>Is Ready: <strong>{isReady ? 'Yes' : 'No'}</strong></p>
        <p>Is Initialized: <strong>{i18n.isInitialized ? 'Yes' : 'No'}</strong></p>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => changeLanguage('ko')}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          한국어
        </button>
        <button
          onClick={() => changeLanguage('en')}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          English
        </button>
        <button
          onClick={() => changeLanguage('ja')}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          日本語
        </button>
      </div>

      <div className="border p-4 rounded">
        <h2 className="text-xl mb-2">Translation Tests:</h2>
        <p>app.name: <strong>{t('app.name', { ns: 'common' })}</strong></p>
        <p>nav.dashboard: <strong>{t('nav.dashboard', { ns: 'common' })}</strong></p>
        <p>nav.schedule: <strong>{t('nav.schedule', { ns: 'common' })}</strong></p>
        <p>nav.team: <strong>{t('nav.team', { ns: 'common' })}</strong></p>
        <p>nav.config: <strong>{t('nav.config', { ns: 'common' })}</strong></p>
        <p>buttons.save: <strong>{t('buttons.save', { ns: 'common' })}</strong></p>
        <p>buttons.cancel: <strong>{t('buttons.cancel', { ns: 'common' })}</strong></p>
      </div>

      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold">Debug Info:</h3>
        <pre className="text-xs">{JSON.stringify({
          language: i18n.language,
          languages: i18n.languages,
          isInitialized: i18n.isInitialized,
          options: {
            lng: i18n.options.lng,
            fallbackLng: i18n.options.fallbackLng,
            ns: i18n.options.ns,
            defaultNS: i18n.options.defaultNS
          }
        }, null, 2)}</pre>
      </div>
    </div>
  )
}