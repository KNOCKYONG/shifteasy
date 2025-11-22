'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { Users, ShieldCheck, Globe, Clock } from 'lucide-react';

const features = [
  {
    icon: Clock,
    key: 'feature1',
    gradient: 'from-[#2563EB] to-[#1D4ED8]',
  },
  {
    icon: Users,
    key: 'feature2',
    gradient: 'from-[#F97316] to-[#FB923C]',
  },
  {
    icon: ShieldCheck,
    key: 'feature3',
    gradient: 'from-[#1D4ED8] to-[#2563EB]',
  },
  {
    icon: Globe,
    key: 'feature4',
    gradient: 'from-[#FB923C] to-[#F97316]',
  },
];

export default function FeaturesSection() {
  const { t } = useTranslation('landing');
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const features = [
    {
      icon: Clock,
      key: 'feature1',
    },
    {
      icon: Users,
      key: 'feature2',
    },
    {
      icon: ShieldCheck,
      key: 'feature3',
    },
    {
      icon: Globe,
      key: 'feature4',
    },
  ];

  return (
    <section ref={ref} className="py-24 lg:py-32 bg-slate-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            {t('features.title')}
          </h2>
          <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group"
              >
                <div className="h-full bg-white rounded-2xl p-8 border border-slate-200 transition-all duration-300 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5 hover:-translate-y-1">
                  {/* Icon */}
                  <div className="mb-6 inline-flex p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">
                    {t(`features.${feature.key}.title`)}
                  </h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                    {t(`features.${feature.key}.description`)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
