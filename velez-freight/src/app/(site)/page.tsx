import { getSettings } from "@/lib/data/settings";
import { QuickInquiry } from "@/components/home/quick-inquiry";
import { CarrierAndFaq, FinalCta, Hero, ProcessSection, ServicesSection, StoryTeaser, WhySection } from "@/components/home/sections";

export default async function HomePage() {
  const settings = await getSettings();
  return (
    <>
      <Hero operational={settings.operational} />
      <QuickInquiry operational={settings.operational} />
      <ServicesSection settings={settings} />
      <ProcessSection />
      <WhySection />
      <StoryTeaser />
      <CarrierAndFaq operational={settings.operational} />
      <FinalCta operational={settings.operational} />
    </>
  );
}
