import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { enablePreviewMode } from "@/lib/preview-mode";
import HomePage from "@/app/(site)/page";
import ShippersPage from "@/app/(site)/shippers/page";
import CarriersPage from "@/app/(site)/carriers/page";
import ServicesPage from "@/app/(site)/services/page";
import OurStoryPage from "@/app/(site)/our-story/page";
import ContactPage from "@/app/(site)/contact/page";
import RequestQuotePage from "@/app/(site)/request-quote/page";
import PrivacyPage from "@/app/(site)/privacy/page";
import TermsPage from "@/app/(site)/terms/page";
import ExpeditedPage from "@/app/(site)/services/expedited-freight/page";
import DedicatedPage from "@/app/(site)/services/dedicated-transportation/page";
import GeneralPage from "@/app/(site)/services/general-freight-coordination/page";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type PageComponent = (props: { searchParams: SearchParams }) => Promise<React.ReactNode> | React.ReactNode;

/** The public pages, rendered unchanged inside the launch preview. */
const pages: Record<string, { title: string; Page: PageComponent }> = {
  "": { title: "Home", Page: HomePage },
  shippers: { title: "For Shippers", Page: ShippersPage },
  carriers: { title: "For Carriers", Page: CarriersPage },
  services: { title: "Services", Page: ServicesPage },
  "services/expedited-freight": { title: "Expedited Freight", Page: ExpeditedPage },
  "services/dedicated-transportation": { title: "Dedicated Transportation", Page: DedicatedPage },
  "services/general-freight-coordination": { title: "General Freight Coordination", Page: GeneralPage },
  "our-story": { title: "Our Story", Page: OurStoryPage },
  contact: { title: "Contact", Page: ContactPage },
  "request-quote": { title: "Request a Freight Quote", Page: RequestQuotePage as PageComponent },
  privacy: { title: "Privacy Policy", Page: PrivacyPage },
  terms: { title: "Terms of Use", Page: TermsPage },
};

type Props = { params: Promise<{ slug?: string[] }>; searchParams: SearchParams };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: pages[(slug ?? []).join("/")]?.title ?? "Not found" };
}

export default async function PreviewPage({ params, searchParams }: Props) {
  // Checked on every page render, not only in the layout, because layouts are not re-run on
  // client side navigation.
  await requireAdmin();
  enablePreviewMode();
  const { slug } = await params;
  const entry = pages[(slug ?? []).join("/")];
  if (!entry) notFound();
  const { Page } = entry;
  return <Page searchParams={searchParams} />;
}
