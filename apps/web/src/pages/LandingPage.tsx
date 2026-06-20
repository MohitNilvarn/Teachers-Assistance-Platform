import { Navigation } from "../components/landing/navigation";
import { HeroSection } from "../components/landing/hero-section";
import { FeaturesSection } from "../components/landing/features-section";
import { HowItWorksSection } from "../components/landing/how-it-works-section";
import { InfrastructureSection } from "../components/landing/infrastructure-section";
import { SecuritySection } from "../components/landing/security-section";
import { CtaSection } from "../components/landing/cta-section";
import { FooterSection } from "../components/landing/footer-section";

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
