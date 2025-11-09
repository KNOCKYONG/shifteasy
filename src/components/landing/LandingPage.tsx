'use client';

import dynamic from 'next/dynamic';
import HeroSection from './HeroSection';

const FeaturesSection = dynamic(() => import('./FeaturesSection'), {
  loading: () => <div className="py-20 bg-white" />,
});

const BenefitsSection = dynamic(() => import('./BenefitsSection'), {
  loading: () => <div className="py-20 bg-gray-50" />,
});

const HowItWorksSection = dynamic(() => import('./HowItWorksSection'), {
  loading: () => <div className="py-20 bg-white" />,
});

const TestimonialsSection = dynamic(() => import('./TestimonialsSection'), {
  loading: () => <div className="py-20 bg-blue-50" />,
});

const PricingSection = dynamic(() => import('./PricingSection'), {
  loading: () => <div className="py-20 bg-white" />,
});

const CTASection = dynamic(() => import('./CTASection'), {
  loading: () => <div className="py-20 bg-blue-600" />,
});

const Footer = dynamic(() => import('./Footer'), {
  loading: () => <div className="py-16 bg-gray-900" />,
});

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Always visible immediately */}
      <HeroSection />

      {/* Other sections - Lazy loaded */}
      <FeaturesSection />
      <BenefitsSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
