'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, LogIn, Zap, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import ConsultingRequestModal from './ConsultingRequestModal';

export default function HeroSection() {
  const { t } = useTranslation('landing');
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      {/* Top Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">S</span>
              </div>
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">ShiftEasy</span>
            </div>

            {/* Login Button */}
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              로그인
            </Link>
          </div>
        </div>
      </nav>

      {/* Sophisticated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1000px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-transparent opacity-70" />
        <div className="absolute -top-[40%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-br from-blue-100/40 to-purple-100/40 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-[20%] -left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-blue-50/40 to-emerald-50/40 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center max-w-5xl mx-auto">
          {/* Unified Premium Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 bg-slate-900/5 border border-slate-200/50 rounded-full backdrop-blur-sm"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-sm font-medium text-slate-600">
              {t('hero.openingSpecial')}
            </span>
            <span className="w-px h-3 bg-slate-300 mx-1" />
            <span className="text-sm font-semibold text-blue-600">
              {t('hero.urgencyBadge')}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 mb-8 leading-[1.1] tracking-tight"
          >
            {t('hero.headline')}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-xl sm:text-2xl text-slate-600 mb-6 max-w-3xl mx-auto leading-relaxed font-medium"
          >
            {t('hero.subheadline')}
          </motion.p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto whitespace-pre-line leading-relaxed"
          >
            {t('hero.description')}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20"
          >
            <Link
              href="/billing?plan=professional"
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-full transition-all duration-300 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 w-full sm:w-auto min-w-[200px]"
            >
              <span className="relative z-10 flex items-center gap-2">
                {t('hero.ctaPrimary')}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>

            <button
              onClick={() => setIsConsultingModalOpen(true)}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-slate-700 bg-white border border-slate-200 rounded-full transition-all duration-300 hover:bg-slate-50 hover:border-slate-300 hover:shadow-md w-full sm:w-auto min-w-[200px]"
            >
              <Sparkles className="w-5 h-5 mr-2 text-blue-500" />
              {t('hero.ctaSecondary')}
            </button>
          </motion.div>

          {/* Premium Stats Strip */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden">
              {/* Stat 1 */}
              <div className="p-6 group hover:bg-white/50 transition-colors">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">{t('hero.stat1Label')}</span>
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">{t('hero.stat1Value')}</p>
              </div>

              {/* Stat 2 */}
              <div className="p-6 group hover:bg-white/50 transition-colors">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="p-2 bg-orange-50 rounded-lg text-orange-600 group-hover:scale-110 transition-transform duration-300">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">{t('hero.stat2Label')}</span>
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">{t('hero.stat2Value')}</p>
              </div>

              {/* Stat 3 */}
              <div className="p-6 group hover:bg-white/50 transition-colors">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-500">{t('hero.stat3Label')}</span>
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">{t('hero.stat3Value')}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Consulting Modal */}
      <ConsultingRequestModal
        isOpen={isConsultingModalOpen}
        onClose={() => setIsConsultingModalOpen(false)}
      />
    </section>
  );
}
