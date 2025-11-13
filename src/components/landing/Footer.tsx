'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const footerSections = ['product', 'company', 'support', 'legal'];

const socialLinks = [
  { icon: Github, href: 'https://github.com', label: 'GitHub' },
  { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
  { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
  { icon: Mail, href: 'mailto:contact@shifteasy.app', label: 'Email' },
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
              AI 기반 스마트 스케줄링 솔루션
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

          {/* Footer Links */}
          {footerSections.map((section) => (
            <div key={section}>
              <h3 className="font-semibold text-white mb-4">
                {t(`footer.${section}.title`)}
              </h3>
              <ul className="space-y-3">
                {['features', 'pricing', 'demo', 'updates'].map((link) => {
                  const linkKey = `footer.${section}.${link}`;
                  const linkText = t(linkKey);

                  if (linkText === linkKey) return null;

                  return (
                    <li key={link}>
                      <Link
                        href={`/${link}`}
                        className="text-sm hover:text-white transition-colors duration-300"
                      >
                        {linkText}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">
              {t('footer.copyright')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
