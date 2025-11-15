'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const footerLinks = {
  product: [
    { key: 'features', href: '/help?section=features' },
    { key: 'pricing', href: '/help?section=pricing' },
  ],
  company: [
    { key: 'about', href: '/help?section=about' },
    { key: 'careers', href: '/help?section=careers' },
  ],
  support: [
    { key: 'helpCenter', href: '/help?section=help-center' },
    { key: 'contact', href: '/help?section=contact' },
  ],
  legal: [
    { key: 'privacy', href: '/help?section=privacy' },
    { key: 'terms', href: '/help?section=terms' },
  ],
};

const socialLinks = [
  { icon: Mail, href: 'mailto:knockroom.help@gmail.com', label: 'Email' },
];

export default function Footer() {
  const { t } = useTranslation('landing');

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500" />
              <span className="text-xl font-bold text-white">ShiftEasy</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {t('footer.brand.description')}
            </p>
            {/* Language Switcher */}
            <div className="mb-4">
              <LanguageSwitcher />
            </div>
            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-blue-600 transition-colors duration-300"
                    aria-label={social.label}
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Product Section */}
          <div>
            <h3 className="font-semibold text-white mb-4">
              {t('footer.product.title')}
            </h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors duration-300"
                  >
                    {t(`footer.product.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Section */}
          <div>
            <h3 className="font-semibold text-white mb-4">
              {t('footer.company.title')}
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors duration-300"
                  >
                    {t(`footer.company.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="font-semibold text-white mb-4">
              {t('footer.support.title')}
            </h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors duration-300"
                  >
                    {t(`footer.support.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Section */}
          <div>
            <h3 className="font-semibold text-white mb-4">
              {t('footer.legal.title')}
            </h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm hover:text-white transition-colors duration-300"
                  >
                    {t(`footer.legal.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar with company info */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Company Information */}
            <div className="text-xs text-gray-500">
              <p>{t('footer.companyInfo.basic')}</p>
            </div>

            {/* Copyright */}
            <p className="text-sm text-gray-400">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
