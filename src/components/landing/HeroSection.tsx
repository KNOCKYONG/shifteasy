'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, LogIn, CheckCircle, Zap, Clock, Users, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import ConsultingRequestModal from './ConsultingRequestModal';

export default function HeroSection() {
  const { t } = useTranslation('landing');
  const [isConsultingModalOpen, setIsConsultingModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse parallax effect
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: e.clientX / window.innerWidth - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);

  const springConfig = { stiffness: 100, damping: 30, mass: 0.5 };
  const mouseX = useSpring(useTransform(scrollY, () => mousePosition.x * 50), springConfig);
  const mouseY = useSpring(useTransform(scrollY, () => mousePosition.y * 50), springConfig);

  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0F172A] text-white selection:bg-blue-500/30">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1E293B] via-[#0F172A] to-[#020617]" />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />

        {/* Floating Orbs with Parallax */}
        <motion.div
          style={{ x: mouseX, y: mouseY }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] mix-blend-screen"
        />
        <motion.div
          style={{ x: useSpring(mousePosition.x * -30), y: useSpring(mousePosition.y * -30) }}
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[150px] mix-blend-screen"
        />
      </div>

      {/* Top Navigation */}
      <nav className="absolute top-0 left-0 right-0 z-50 border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="font-bold text-white">S</span>
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                ShiftEasy
              </span>
            </div>
            <Link
              href="/sign-in"
              className="group relative px-5 py-2 text-sm font-medium text-white overflow-hidden rounded-full"
            >
              <span className="absolute inset-0 w-full h-full bg-white/5 group-hover:bg-white/10 transition-colors" />
              <span className="relative flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                로그인
              </span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center max-w-5xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-md"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-sm font-medium text-blue-200">{t('hero.openingSpecial')}</span>
          </motion.div>

          {/* Hero Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight mb-8"
          >
            <span className="block text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-400 pb-2">
              {t('hero.headline')}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-xl sm:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            {t('hero.subheadline')}
            <br className="hidden sm:block" />
            <span className="text-gray-500 text-lg mt-4 block">{t('hero.description')}</span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-20"
          >
            <Link
              href="/billing?plan=professional"
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-full overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative flex items-center gap-2">
                {t('hero.ctaPrimary')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>

            <button
              onClick={() => setIsConsultingModalOpen(true)}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white rounded-full overflow-hidden transition-all hover:scale-105"
            >
              <div className="absolute inset-0 bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors" />
              <span className="relative flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                {t('hero.ctaSecondary')}
              </span>
            </button>
          </motion.div>

          {/* Floating Cards (Stats) */}
          <div className="relative h-40 sm:h-48 max-w-5xl mx-auto perspective-1000">
            <motion.div
              style={{ y: y1 }}
              className="absolute left-0 sm:left-10 top-0 glass-card p-4 rounded-2xl flex items-center gap-4 max-w-[200px] sm:max-w-xs"
            >
              <div className="p-3 bg-blue-500/20 rounded-xl">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400">{t('hero.stat1Label')}</p>
                <p className="text-lg font-bold text-white">{t('hero.stat1Value')}</p>
              </div>
            </motion.div>

            <motion.div
              style={{ y: y2 }}
              className="absolute right-0 sm:right-10 top-10 glass-card p-4 rounded-2xl flex items-center gap-4 max-w-[200px] sm:max-w-xs"
            >
              <div className="p-3 bg-purple-500/20 rounded-xl">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400">{t('hero.stat2Label')}</p>
                <p className="text-lg font-bold text-white">{t('hero.stat2Value')}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-gray-500 uppercase tracking-widest">Scroll</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-blue-500 to-transparent" />
      </motion.div>

      <ConsultingRequestModal
        isOpen={isConsultingModalOpen}
        onClose={() => setIsConsultingModalOpen(false)}
      />
    </section>
  );
}
