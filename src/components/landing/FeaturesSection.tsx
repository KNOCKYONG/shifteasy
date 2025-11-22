'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Brain, Users, ShieldCheck, Globe } from 'lucide-react';
import ScrollReveal from './ScrollReveal';

const features = [
  {
    icon: Brain,
    key: 'feature1',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Users,
    key: 'feature2',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    icon: ShieldCheck,
    key: 'feature3',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Globe,
    key: 'feature4',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
];

export default function FeaturesSection() {
  const { t } = useTranslation('landing');

  return (
    <section className="py-24 lg:py-32 bg-[#0F172A] relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <ScrollReveal width="100%" className="text-center mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            {t('features.title')}
          </h2>
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            {t('features.subtitle')}
          </p>
        </ScrollReveal>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <ScrollReveal key={feature.key} delay={index * 0.1} width="100%">
                <div className="group relative h-full p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-500 hover:-translate-y-2">
                  {/* Hover Glow */}
                  <div className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-b ${feature.bg} to-transparent pointer-events-none`} />

                  {/* Icon */}
                  <div className={`relative w-14 h-14 rounded-2xl ${feature.bg} ${feature.border} border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className={`w-7 h-7 ${feature.color}`} />
                  </div>

                  {/* Content */}
                  <h3 className="relative text-xl font-bold text-white mb-3 group-hover:text-blue-200 transition-colors">
                    {t(`features.${feature.key}.title`)}
                  </h3>
                  <p className="relative text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors">
                    {t(`features.${feature.key}.description`)}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
