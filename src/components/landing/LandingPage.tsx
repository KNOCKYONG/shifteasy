'use client';

import dynamic from 'next/dynamic';
import HeroSection from './HeroSection';

const FeaturesSection = dynamic(() => import('./FeaturesSection'), {
  loading: () => <div className="py-20 bg-[#0F172A]" />,
});

const BenefitsSection = dynamic(() => import('./BenefitsSection'), {
  loading: () => <div className="py-20 bg-[#0F172A]" />,
});

const HowItWorksSection = dynamic(() => import('./HowItWorksSection'), {
  loading: () => <div className="py-20 bg-[#0F172A]" />,
});

const DemoPreviewSection = dynamic(() => import('./DemoPreviewSection'), {
  loading: () => <div className="py-20 bg-[#0F172A]" />,
});

const TestimonialsSection = dynamic(() => import('./TestimonialsSection'), {
  loading: () => <div className="py-20 bg-[#0F172A]" />,
});

const PricingSection = dynamic(() => import('./PricingSection'), {
  loading: () => <div className="py-20 bg-[#0F172A]" />,
});

const CTASection = dynamic(() => import('./CTASection'), {
  loading: () => <div className="py-20 bg-blue-900" />,
});

const Footer = dynamic(() => import('./Footer'), {
  loading: () => <div className="py-16 bg-[#020617]" />,
});

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Hero Section - Always visible immediately */}
      <HeroSection />

      {/* Demo Preview Section - Right after hero */}
      <DemoPreviewSection />

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
