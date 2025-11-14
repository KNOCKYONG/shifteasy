'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { ArrowRight, Shield, Zap, Users, Globe } from 'lucide-react';
import Link from 'next/link';
import ContactModal from './ContactModal';

const trustBadges = [
  { key: 'trustBadge1', icon: Users },
  { key: 'trustBadge2', icon: Shield },
  { key: 'trustBadge3', icon: Zap },
  { key: 'trustBadge4', icon: Globe },
];

export default function CTASection() {
  const { t } = useTranslation('landing');
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <section ref={ref} className="relative py-20 lg:py-32 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600" />

      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-blob" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-white rounded-full filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="mb-6"
          >
            <div className="inline-block mb-4 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
              <span className="text-white font-semibold">⚡ 한정 특별 혜택</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-4">
              {t('cta.headline')}
            </h2>
          </motion.div>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl sm:text-2xl text-white/90 mb-3"
          >
            {t('cta.subheadline')}
          </motion.p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-lg text-white/80 mb-12 max-w-2xl mx-auto"
          >
            {t('cta.description')}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <Link
              href="/billing?plan=professional"
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-blue-600 bg-white rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl w-full sm:w-auto"
            >
              <span className="relative z-10 flex items-center gap-2">
                {t('cta.ctaPrimary')}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>

            <button
              onClick={() => setIsContactModalOpen(true)}
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white border-2 border-white/50 rounded-lg backdrop-blur-sm transition-all duration-300 hover:border-white hover:bg-white/10 hover:shadow-lg w-full sm:w-auto"
            >
              {t('cta.ctaSecondary')}
            </button>
          </motion.div>

          {/* Contact Modal */}
          <ContactModal
            isOpen={isContactModalOpen}
            onClose={() => setIsContactModalOpen(false)}
          />

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {trustBadges.map((badge, index) => {
              const Icon = badge.icon;
              return (
                <motion.div
                  key={badge.key}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={inView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.5, delay: 0.8 + index * 0.1 }}
                  className="flex flex-col items-center gap-2 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20"
                >
                  <Icon className="w-8 h-8 text-white" />
                  <span className="text-sm font-semibold text-white text-center">
                    {t(`cta.${badge.key}`)}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Decorative glow effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 0.3, scale: 1 } : {}}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white rounded-full filter blur-3xl -z-10"
          />
        </div>
      </div>
    </section>
  );
}
