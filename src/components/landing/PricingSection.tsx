'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import ContactModal from './ContactModal';

const plans = ['starter', 'professional', 'enterprise'];

export default function PricingSection() {
  const { t } = useTranslation('landing');
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

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
            {t('pricing.title')}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => {
            const isPopular = t(`pricing.${plan}.popular`) === 'true';
            const features = t(`pricing.${plan}.features`, { returnObjects: true }) as string[];

            return (
              <motion.div
                key={plan}
                initial={{ opacity: 0, y: 50 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className={`relative ${isPopular ? 'lg:scale-105 lg:z-10' : ''}`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1 shadow-lg">
                      <Star className="w-4 h-4" fill="currentColor" />
                      인기
                    </div>
                  </div>
                )}

                <div
                  className={`h-full bg-white rounded-2xl p-8 transition-all duration-300 ${
                    isPopular
                      ? 'border-2 border-blue-600 shadow-2xl'
                      : 'border border-gray-200 shadow-lg hover:shadow-xl hover:border-blue-300'
                  }`}
                >
                  {/* Plan name */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {t(`pricing.${plan}.name`)}
                  </h3>

                  {/* Plan description */}
                  <p className="text-gray-600 mb-6">
                    {t(`pricing.${plan}.description`)}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-gray-900">
                        {t(`pricing.${plan}.price`)}
                      </span>
                      {t(`pricing.${plan}.priceUnit`, { defaultValue: '' }) &&
                       t(`pricing.${plan}.priceUnit`, { defaultValue: '' }) !== `pricing.${plan}.priceUnit` && (
                        <span className="text-gray-600">
                          {t(`pricing.${plan}.priceUnit`)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {Array.isArray(features) && features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                          <Check className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  {plan === 'enterprise' ? (
                    <button
                      onClick={() => setIsContactModalOpen(true)}
                      className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                        isPopular
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:scale-105'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {t(`pricing.${plan}.cta`)}
                    </button>
                  ) : (
                    <Link
                      href="/sign-up"
                      className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                        isPopular
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:scale-105'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      {t(`pricing.${plan}.cta`)}
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom note */}
        {/* Contact Modal */}
        <ContactModal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
        />
      </div>
    </section>
  );
}
