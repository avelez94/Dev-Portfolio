import type { Metadata } from "next";
import { getSettings } from "@/lib/data/settings";
import { pageMetadata } from "@/lib/seo";
import { ServicePageView } from "@/components/site/service-page";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  // A service switched off in Website Content stays reachable but is not indexed.
  return pageMetadata("expedited", s.operational, s.services.expedited ? {} : { robots: { index: false, follow: true } });
}

export default function Page() {
  return <ServicePageView slug="expedited" />;
}
