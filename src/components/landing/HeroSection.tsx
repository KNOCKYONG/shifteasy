"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, Zap, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import ConsultingRequestModal from './ConsultingRequestModal';

export default function HeroSection() {
  const { t } = useTranslation('landing');
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);

  // Countdown timer for urgency
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          return 15 * 60; // Reset to 15 minutes
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-white">
      {/* Subtle Background (no gradients) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[10%] w-[800px] h-[800px] bg-blue-100/30 rounded-full blur-3xl opacity-50" />
        <div className="absolute top-[20%] -left-[10%] w-[600px] h-[600px] bg-purple-100/30 rounded-full blur-3xl opacity-40" />
      </div>

      {/* Top Navigation removed: global NavigationHeader now displays logo & actions */}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pt-48 lg:pb-32 flex flex-col items-center text-center">

        {/* Premium Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-blue-50 border border-blue-200 cursor-default hover:bg-blue-100 transition-colors"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
          <span className="text-sm font-medium text-blue-700">
            {t('hero.openingSpecial')}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 mb-8 leading-[1.1] whitespace-pre-line break-keep"
        >
          {t('hero.headline')}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed font-medium whitespace-pre-line break-keep"
        >
          {t('hero.subheadline')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-20"
        >
          <Link
            href="/billing?plan=professional"
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-full overflow-hidden transition-all duration-300 hover:bg-blue-700 hover:scale-105 hover:shadow-xl hover:shadow-blue-600/25"
          >
            {/* Shimmer removed (no gradients) */}
            <span className="relative flex items-center gap-2">
              {t('hero.ctaPrimary')}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <button
            onClick={() => setIsConsultingModalOpen(true)}
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-full transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-lg"
          >
            {/* Single Countdown Badge */}
            <span className="absolute -top-3 -right-3 px-3 py-1 text-xs font-bold text-white bg-red-600 rounded-full shadow-lg animate-pulse whitespace-nowrap">
              무료 마감 {formatTime(timeLeft)}
            </span>
            <Sparkles className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors" />
            {t('hero.ctaSecondary')}
          </button>
        </motion.div>

        {/* Stats Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 w-full max-w-6xl mx-auto"
        >
          <div className="relative rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm p-2 sm:p-4 shadow-2xl shadow-gray-200/50">
            {/* Highlight removed (no gradient) */}

            {/* Mock UI Header */}
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/60 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/60 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-400/60 border border-green-500/50" />
              </div>
              <div className="h-6 w-64 bg-gray-100 rounded-md ml-4" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-xl bg-white border border-gray-200 hover:border-blue-300 transition-all group hover:shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{t('hero.stat1Label')}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">{t('hero.stat1Value')}</p>
              </div>

              <div className="p-6 rounded-xl bg-white border border-gray-200 hover:border-orange-300 transition-all group hover:shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-100 rounded-lg text-orange-600 group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{t('hero.stat2Label')}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">{t('hero.stat2Value')}</p>
              </div>

              <div className="p-6 rounded-xl bg-white border border-gray-200 hover:border-emerald-300 transition-all group hover:shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">{t('hero.stat3Label')}</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 tracking-tight">{t('hero.stat3Value')}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Consulting Modal */}
      <ConsultingRequestModal
        isOpen={isConsultingModalOpen}
        onClose={() => setIsConsultingModalOpen(false)}
      />
    </section>
  );
}
