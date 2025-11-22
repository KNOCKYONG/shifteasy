'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { useState } from 'react';
import { Activity, Factory, Store } from 'lucide-react';

const industries = [
  {
    key: 'healthcare',
    icon: Activity,
    color: 'blue',
  },
  {
    key: 'manufacturing',
    icon: Factory,
    color: 'orange',
  },
  {
    key: 'service',
    icon: Store,
    color: 'blueAlt',
  },
];

export default function BenefitsSection() {
  const { t } = useTranslation('landing');
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });
  const [activeIndustry, setActiveIndustry] = useState(0);

  const colorMap: Record<string, { bg: string; text: string; solid: string; border: string }> = {
    blue: {
      bg: 'bg-[#DBEAFE]',
      text: 'text-[#2563EB]',
      solid: 'bg-[#2563EB]',
      border: 'border-[#2563EB]',
    },
    orange: {
      bg: 'bg-[#FED7AA]',
      text: 'text-[#F97316]',
      solid: 'bg-[#F97316]',
      border: 'border-[#F97316]',
    },
    blueAlt: {
      bg: 'bg-[#DBEAFE]',
      text: 'text-[#1D4ED8]',
      solid: 'bg-[#1D4ED8]',
      border: 'border-[#1D4ED8]',
    },
  };

  return (
    <section ref={ref} className="py-20 lg:py-32 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t('benefits.title')}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('benefits.subtitle')}
          </p>
        </motion.div>

        {/* Industry Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          {industries.map((industry, index) => {
            const Icon = industry.icon;
            const colors = colorMap[industry.color];
            const isActive = activeIndustry === index;

            return (
              <button
                key={industry.key}
                onClick={() => setActiveIndustry(index)}
                className={`flex items-center gap-3 px-6 py-4 rounded-xl font-semibold transition-all duration-300 ${
                  isActive
                    ? `${colors.bg} ${colors.text} shadow-lg scale-105`
                    : 'bg-white text-gray-600 hover:bg-gray-50 hover:shadow-md'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span>{t(`benefits.${industry.key}.title`)}</span>
              </button>
            );
          })}
        </motion.div>

        {/* Industry Content */}
        <motion.div
          key={activeIndustry}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Left: Description */}
            <div className="p-8 lg:p-12">
              <div className="mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  {t(`benefits.${industries[activeIndustry].key}.pain`)}
                </h3>
                <div className={`h-1 w-20 ${colorMap[industries[activeIndustry].color].solid} rounded-full mb-6`} />
                <p className="text-lg text-gray-600 leading-relaxed">
                  {t(`benefits.${industries[activeIndustry].key}.solution`)}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 gap-6">
                {['stat1', 'stat2', 'stat3'].map((stat, idx) => (
                  <motion.div
                    key={stat}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                  >
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${colorMap[industries[activeIndustry].color].solid} flex items-center justify-center text-white font-bold text-lg`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        {t(`benefits.${industries[activeIndustry].key}.${stat}`)}
                      </p>
                      <p className="text-xl font-bold text-gray-900">
                        {t(`benefits.${industries[activeIndustry].key}.${stat}Value`)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: Visual */}
            <div className={`relative ${colorMap[industries[activeIndustry].color].solid} p-8 lg:p-12 flex items-center justify-center`}>
              <div className="relative">
                {/* Decorative circles */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-64 h-64 rounded-full bg-white/10 animate-pulse" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 rounded-full bg-white/20 animate-pulse animation-delay-1000" />
                </div>

                {/* Icon */}
                <div className="relative z-10 w-32 h-32 mx-auto bg-white rounded-3xl shadow-2xl flex items-center justify-center">
                  {(() => {
                    const Icon = industries[activeIndustry].icon;
                    return <Icon className={`w-16 h-16 ${colorMap[industries[activeIndustry].color].text}`} />;
                  })()}
                </div>

                {/* Floating stats */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl p-4 hidden sm:block"
                >
                  <p className="text-2xl font-bold text-gray-900">98%</p>
                  <p className="text-xs text-gray-600">Efficiency</p>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-xl p-4 hidden sm:block"
                >
                  <p className="text-2xl font-bold text-gray-900">5min</p>
                  <p className="text-xs text-gray-600">Setup Time</p>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
