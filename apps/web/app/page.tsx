import type { Metadata } from "next";
import { APP_NAME } from "@askwell/shared";
import { Footer, Hero, HowItWorks, InstallSnippet, LiveDemo, PricingSection } from "../components/landing";

export const metadata: Metadata = {
  title: `${APP_NAME} — Un chat d'assistance IA pour votre site`,
  description:
    "Ajoutez à votre site un chat qui répond à vos visiteurs à partir de vos propres documents. Une seule balise à installer.",
};

export default function Home() {
  return (
    <div data-theme="dark" className="min-h-screen overflow-x-clip bg-bg text-fg">
      <main>
        <Hero />
        <HowItWorks />
        <LiveDemo />
        <PricingSection />
        <InstallSnippet />
      </main>
      <Footer />
    </div>
  );
}
