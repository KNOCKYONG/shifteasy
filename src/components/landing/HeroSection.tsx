'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, LogIn } from 'lucide-react';
import Link from 'next/link';
import ConsultingRequestModal from './ConsultingRequestModal';

export default function HeroSection() {
  const { t } = useTranslation('landing');
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* Top Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center">
              <span className="text-xl sm:text-2xl font-bold text-blue-600">ShiftEasy</span>
            </div>

            {/* Login Button */}
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              로그인
            </Link>
          </div>
        </div>
      </nav>

      {/* Simplified background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_#E6F2FF_0%,_transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_#E6F2FF_0%,_transparent_50%)]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center">
          {/* Opening Special Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-3 bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-full text-sm font-bold shadow-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            {t('hero.openingSpecial')}
          </motion.div>

          {/* Urgency Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-6 bg-orange-500 text-white rounded-full text-sm font-semibold shadow-md"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            {t('hero.urgencyBadge')}
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-[#0F172A] mb-6 leading-tight"
          >
            {t('hero.headline')}
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="text-xl sm:text-2xl lg:text-3xl text-[#64748B] mb-4"
          >
            {t('hero.subheadline')}
          </motion.p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            className="text-base sm:text-lg lg:text-xl text-[#64748B] mb-12 max-w-3xl mx-auto whitespace-pre-line"
          >
            {t('hero.description')}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              href="/billing?plan=professional"
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-lg transition-all duration-300 hover:bg-blue-700 hover:scale-105 hover:shadow-xl w-full sm:w-auto"
            >
              <span className="relative z-10 flex items-center gap-2">
                {t('hero.ctaPrimary')}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>

            <button
              onClick={() => setIsConsultingModalOpen(true)}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-lg transition-all duration-300 hover:bg-[#DBEAFE] hover:shadow-lg w-full sm:w-auto"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              {t('hero.ctaSecondary')}
            </button>
          </motion.div>

          {/* Consulting Modal */}
          <ConsultingRequestModal
            isOpen={isConsultingModalOpen}
            onClose={() => setIsConsultingModalOpen(false)}
          />
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.5 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center pt-2"
        >
          <div className="w-1 h-3 bg-gray-400 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
}
