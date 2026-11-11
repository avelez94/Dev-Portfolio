import { getSettings } from "@/lib/data/settings";
import { QuickInquiry } from "@/components/home/quick-inquiry";
import { CarrierAndFaq, FinalCta, Hero, ProcessSection, ServicesSection, StoryTeaser, WhySection } from "@/components/home/sections";

export default async function HomePage() {
  const settings = await getSettings();
  return (
    <>
      <Hero operational={settings.operational} content={settings.content} />
      <QuickInquiry operational={settings.operational} stayConnectedBody={settings.content["stayConnected.body"]} />
      <ServicesSection settings={settings} />
      <ProcessSection />
      <WhySection content={settings.content} />
      <StoryTeaser />
      <CarrierAndFaq operational={settings.operational} />
      <FinalCta operational={settings.operational} content={settings.content} />
    </>
  );
}
