'use client';

import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Calendar, Users, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const mockSchedule = [
  { id: 1, name: '김철수', day: '월', shift: '오전', color: 'bg-blue-100 text-blue-700' },
  { id: 2, name: '이영희', day: '월', shift: '오후', color: 'bg-green-100 text-green-700' },
  { id: 3, name: '박민수', day: '화', shift: '오전', color: 'bg-purple-100 text-purple-700' },
  { id: 4, name: '정수진', day: '화', shift: '야간', color: 'bg-indigo-100 text-indigo-700' },
  { id: 5, name: '최동욱', day: '수', shift: '오전', color: 'bg-pink-100 text-pink-700' },
  { id: 6, name: '강미래', day: '수', shift: '오후', color: 'bg-yellow-100 text-yellow-700' },
];

export default function DemoPreviewSection() {
  const { t } = useTranslation('landing');
  const [selectedShift, setSelectedShift] = useState<number | null>(null);

  return (
    <section className="py-20 bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t('demoPreview.title')}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('demoPreview.subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Interactive Demo */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Demo Container */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Calendar className="w-5 h-5" />
                    <span className="font-semibold">2025년 1월 스케줄</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm">
                    <Users className="w-4 h-4" />
                    <span>6명</span>
                  </div>
                </div>
              </div>

              {/* Schedule Grid */}
              <div className="p-6">
                <div className="text-xs text-gray-500 mb-3 font-medium">
                  {t('demoPreview.clickToInteract')}
                </div>
                <div className="space-y-2">
                  {mockSchedule.map((shift) => (
                    <motion.button
                      key={shift.id}
                      onClick={() => setSelectedShift(shift.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full p-4 rounded-lg transition-all duration-200 text-left ${
                        selectedShift === shift.id
                          ? 'ring-2 ring-blue-500 shadow-lg'
                          : 'hover:shadow-md'
                      } ${shift.color}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center font-semibold">
                            {shift.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold">{shift.name}</div>
                            <div className="text-sm opacity-75 flex items-center gap-2">
                              <Clock className="w-3 h-3" />
                              {shift.day}요일 • {shift.shift}
                            </div>
                          </div>
                        </div>
                        {selectedShift === shift.id && (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <Link
                  href="/billing?plan=professional"
                  className="w-full inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  {t('demoPreview.tryNow')}
                </Link>
              </div>
            </div>

            {/* Floating Feature Cards */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-6 -right-6 bg-white rounded-xl shadow-xl p-4 hidden lg:block"
            >
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">5분</div>
                <div className="text-xs text-gray-500">스케줄 생성</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Features List */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            {[
              {
                icon: '🤖',
                title: t('demoPreview.feature1.title'),
                description: t('demoPreview.feature1.description'),
              },
              {
                icon: '⚡',
                title: t('demoPreview.feature2.title'),
                description: t('demoPreview.feature2.description'),
              },
              {
                icon: '🔄',
                title: t('demoPreview.feature3.title'),
                description: t('demoPreview.feature3.description'),
              },
              {
                icon: '✅',
                title: t('demoPreview.feature4.title'),
                description: t('demoPreview.feature4.description'),
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex gap-4 p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-2xl">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
