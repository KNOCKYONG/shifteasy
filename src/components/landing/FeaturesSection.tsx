'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { Brain, Users, ShieldCheck, Globe } from 'lucide-react';

const features = [
  {
    icon: Brain,
    key: 'feature1',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Users,
    key: 'feature2',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: ShieldCheck,
    key: 'feature3',
    gradient: 'from-orange-500 to-red-500',
  },
  {
    icon: Globe,
    key: 'feature4',
    gradient: 'from-green-500 to-emerald-500',
  },
];

export default function FeaturesSection() {
  const { t } = useTranslation('landing');
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });


  return (
    <section ref={ref} className="py-20 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t('features.title')}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('features.subtitle')}
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, y: 50 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="group relative"
              >
                <div className="relative h-full bg-white rounded-2xl p-8 border border-gray-200 transition-all duration-300 hover:shadow-2xl hover:border-transparent hover:-translate-y-2">
                  {/* Gradient border on hover */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-xl"
                    style={{
                      background: `linear-gradient(to bottom right, var(--tw-gradient-stops))`,
                    }}
                  />

                  {/* Icon */}
                  <div className="mb-6">
                    <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${feature.gradient} shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {t(`features.${feature.key}.title`)}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {t(`features.${feature.key}.description`)}
                  </p>

                  {/* Decorative element */}
                  <div className={`absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-b-2xl`} />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom decoration */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full max-w-md mx-auto"
        />
      </div>
    </section>
  );
}
