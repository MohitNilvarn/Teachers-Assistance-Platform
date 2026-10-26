import { Navigation } from "../components/landing/Navigation";
import { HeroSection } from "../components/landing/HeroSection";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { HowItWorksSection } from "../components/landing/HowItWorksSection";
import { InfrastructureSection } from "../components/landing/InfrastructureSection";
import { SecuritySection } from "../components/landing/SecuritySection";
import { CtaSection } from "../components/landing/CtaSection";
import { FooterSection } from "../components/landing/FooterSection";

export default function LandingPage() {
    return (
        <main className="optimus-landing relative min-h-screen overflow-x-hidden noise-overlay bg-background text-foreground font-sans">
            <Navigation />
            <HeroSection />
            <FeaturesSection />
            <HowItWorksSection />
            <InfrastructureSection />
            <SecuritySection />
            <CtaSection />
            <FooterSection />
        </main>
    )
}
