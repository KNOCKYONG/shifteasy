'use client';

import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function HelpContent() {
  const { t } = useTranslation('help');
  const searchParams = useSearchParams();
  const section = searchParams.get('section') || 'help-center';

  const renderSection = () => {
    switch (section) {
      case 'features':
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('features.title')}</h1>
            <div dangerouslySetInnerHTML={{ __html: t('features.content') }} />
          </div>
        );

      case 'pricing':
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('pricing.title')}</h1>
            <div dangerouslySetInnerHTML={{ __html: t('pricing.content') }} />
          </div>
        );

      case 'about':
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('about.title')}</h1>
            <div dangerouslySetInnerHTML={{ __html: t('about.content') }} />
          </div>
        );

      case 'careers':
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('careers.title')}</h1>
            <div dangerouslySetInnerHTML={{ __html: t('careers.content') }} />
          </div>
        );

      case 'contact':
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('contact.title')}</h1>
            <div dangerouslySetInnerHTML={{ __html: t('contact.content') }} />
          </div>
        );

      case 'privacy':
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('privacy.title')}</h1>
            <div className="text-sm text-gray-600 mb-6">
              {t('privacy.effectiveDate')}: 2025-01-01
            </div>
            <div dangerouslySetInnerHTML={{ __html: t('privacy.content') }} />
          </div>
        );

      case 'terms':
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('terms.title')}</h1>
            <div className="text-sm text-gray-600 mb-6">
              {t('terms.effectiveDate')}: 2025-01-01
            </div>
            <div dangerouslySetInnerHTML={{ __html: t('terms.content') }} />
          </div>
        );

      case 'help-center':
      default:
        return (
          <div className="prose prose-lg max-w-none">
            <h1>{t('helpCenter.title')}</h1>
            <div dangerouslySetInnerHTML={{ __html: t('helpCenter.content') }} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {renderSection()}
        </div>
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <HelpContent />
    </Suspense>
  );
}
