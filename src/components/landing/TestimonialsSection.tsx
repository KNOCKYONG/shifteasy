'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useInView } from 'react-intersection-observer';
import { useState, useEffect } from 'react';
import { Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const testimonials = ['testimonial1', 'testimonial2', 'testimonial3'];

export default function TestimonialsSection() {
  const { t } = useTranslation('landing');
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentIndex((prevIndex) => {
      let nextIndex = prevIndex + newDirection;
      if (nextIndex < 0) nextIndex = testimonials.length - 1;
      if (nextIndex >= testimonials.length) nextIndex = 0;
      return nextIndex;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => {
      paginate(1);
    }, 5000);
    return () => clearInterval(timer);
  }, [currentIndex]);

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
            {t('testimonials.title')}
          </h2>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
            {t('testimonials.subtitle')}
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="relative max-w-4xl mx-auto">
          <div className="relative h-[500px] sm:h-[400px] overflow-hidden">
            <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={1}
                onDragEnd={(e, { offset, velocity }) => {
                  const swipe = swipePower(offset.x, velocity.x);

                  if (swipe < -swipeConfidenceThreshold) {
                    paginate(1);
                  } else if (swipe > swipeConfidenceThreshold) {
                    paginate(-1);
                  }
                }}
                className="absolute w-full"
              >
                <div className="bg-white rounded-3xl shadow-2xl p-8 sm:p-12">
                  {/* Quote icon */}
                  <div className="mb-6">
                    <Quote className="w-12 h-12 text-blue-500 opacity-50" />
                  </div>

                  {/* Quote */}
                  <blockquote className="text-lg sm:text-xl text-gray-700 leading-relaxed mb-8">
                    &quot;{t(`testimonials.${testimonials[currentIndex]}.quote`)}&quot;
                  </blockquote>

                  {/* Author info */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                      {t(`testimonials.${testimonials[currentIndex]}.author`).charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">
                        {t(`testimonials.${testimonials[currentIndex]}.author`)}
                      </p>
                      <p className="text-gray-600">
                        {t(`testimonials.${testimonials[currentIndex]}.role`)} · {t(`testimonials.${testimonials[currentIndex]}.company`)}
                      </p>
                    </div>
                  </div>

                  {/* Stat badge */}
                  <div className="mt-6 inline-block px-4 py-2 bg-blue-100 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900">
                      📈 {t(`testimonials.${testimonials[currentIndex]}.stat`)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          <button
            onClick={() => paginate(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-12 w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-gray-600 hover:text-blue-600 hover:shadow-2xl transition-all duration-300 hover:scale-110"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <button
            onClick={() => paginate(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-12 w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center text-gray-600 hover:text-blue-600 hover:shadow-2xl transition-all duration-300 hover:scale-110"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentIndex ? 1 : -1);
                  setCurrentIndex(index);
                }}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'bg-blue-600 w-8'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
