'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, LogIn, Zap, Clock, Users, ChevronRight, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import ConsultingRequestModal from './ConsultingRequestModal';

export default function HeroSection() {
  const { t } = useTranslation('landing');
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  // Mouse move effect for background
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-slate-950 text-white selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated Gradient Orbs */}
        <div
          className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse"
          style={{ animationDuration: '7s' }}
        />
        <div
          className="absolute top-[20%] left-[30%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[100px] mix-blend-screen animate-pulse"
          style={{ animationDuration: '10s' }}
        />

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" style={{ opacity: 0.1 }}></div>
      </div>

      {/* Top Navigation Bar (Transparent) */}
      <nav className="absolute top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
                <span className="text-white font-bold text-xl">S</span>
                <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 hover:opacity-100 transition-opacity" />
              </div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
                ShiftEasy
              </span>
            </div>

            {/* Login Button */}
            <Link
              href="/sign-in"
              className="group inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all duration-300 backdrop-blur-md"
            >
              <LogIn className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              로그인
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pt-48 lg:pb-32 flex flex-col items-center text-center">

        {/* Premium Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-blue-500/10 border border-blue-500/20 backdrop-blur-md cursor-default hover:bg-blue-500/15 transition-colors"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span className="text-sm font-medium text-blue-200">
            {t('hero.openingSpecial')}
          </span>
          <ChevronRight className="w-4 h-4 text-blue-400" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight text-white mb-8 leading-[1.1] whitespace-pre-line break-keep"
        >
          <span className="inline-block bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-slate-400">
            {t('hero.headline')}
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-xl sm:text-2xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed font-medium whitespace-pre-line break-keep"
        >
          {t('hero.subheadline')}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
        >
          <Link
            href="/billing?plan=professional"
            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-full overflow-hidden transition-all duration-300 hover:bg-blue-500 hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
            <span className="relative flex items-center gap-2">
              {t('hero.ctaPrimary')}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>

          <button
            onClick={() => setIsConsultingModalOpen(true)}
            className="group inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-slate-300 bg-white/5 border border-white/10 rounded-full transition-all duration-300 hover:bg-white/10 hover:text-white hover:border-white/20 backdrop-blur-sm"
          >
            <Sparkles className="w-5 h-5 mr-2 text-blue-400 group-hover:text-blue-300 transition-colors" />
            {t('hero.ctaSecondary')}
          </button>
        </motion.div>

        {/* Floating Stats / Dashboard Preview Placeholder */}
        <motion.div
          style={{ y: y1, opacity }}
          className="mt-20 w-full max-w-6xl mx-auto"
        >
          <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-2 sm:p-4 shadow-2xl shadow-blue-900/20">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl -z-10" />

            {/* Mock UI Header */}
            <div className="flex items-center gap-2 mb-4 px-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
              </div>
              <div className="h-6 w-64 bg-white/5 rounded-md ml-4" />
            </div>

            {/* Stats Grid (Replacing the old strip) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:scale-110 transition-transform">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-400">{t('hero.stat1Label')}</span>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight">{t('hero.stat1Value')}</p>
              </div>

              <div className="p-6 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400 group-hover:scale-110 transition-transform">
                    <Zap className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-400">{t('hero.stat2Label')}</span>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight">{t('hero.stat2Value')}</p>
              </div>

              <div className="p-6 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-slate-400">{t('hero.stat3Label')}</span>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight">{t('hero.stat3Value')}</p>
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
