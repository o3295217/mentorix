'use client'

import CtaSection from '@/components/landing/CtaSection'
import DayFlowSection from '@/components/landing/DayFlowSection'
import DreamSection from '@/components/landing/DreamSection'
import EvaluationSection from '@/components/landing/EvaluationSection'
import FooterSection from '@/components/landing/FooterSection'
import HeroSection from '@/components/landing/HeroSection'
import PainSection from '@/components/landing/PainSection'
import ToolsSection from '@/components/landing/ToolsSection'
import TrustSection from '@/components/landing/TrustSection'
import useScrollReveal from '@/components/landing/useScrollReveal'

export default function Landing() {
  const revealRef = useScrollReveal()

  return (
    <div
      ref={revealRef}
      className="min-h-screen bg-gray-950 -my-8 w-screen overflow-hidden"
      style={{ marginLeft: 'calc(-50vw + 50%)' }}
    >
      <HeroSection />
      <PainSection />
      <DreamSection />
      <DayFlowSection />
      <EvaluationSection />
      <ToolsSection />
      <TrustSection />
      <CtaSection />
      <FooterSection />
    </div>
  )
}
