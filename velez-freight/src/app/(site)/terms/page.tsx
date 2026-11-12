import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";
import { companyName, getSettings } from "@/lib/data/settings";
import { site } from "@/config/site";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("terms", (await getSettings()).operational);
}

const UPDATED = "November 11, 2026";

export default async function TermsPage() {
  const settings = await getSettings();
  const name = companyName(settings);
  return (
    <LegalPage title="Terms of Use" updated={UPDATED}>
      <p>These terms govern your use of this website operated by {name}. By using the website you agree to them. If you do not agree, please do not use the website.</p>

      <h2>Operating status</h2>
      {settings.operational ? (
        <p>{name} arranges transportation as a licensed freight broker{settings.mcNumber ? ` (MC ${settings.mcNumber})` : ""}. We are not a motor carrier and do not own or operate trucks.</p>
      ) : (
        <p>{name} is preparing to launch and is not currently arranging transportation, accepting freight orders, or providing quotes. Nothing on this website is an offer to provide transportation services. We are not a motor carrier and do not own or operate trucks.</p>
      )}

      <h2>Inquiries are not orders</h2>
      <p>Submitting a form on this website is a request for information only. It does not create a contract, a booking, a tender of freight, or a carrier agreement. Any price, schedule, or service commitment is valid only when confirmed in a separate written agreement or rate confirmation signed by us. We do not guarantee carrier availability, transit times, or delivery dates through this website.</p>

      <h2>Carrier inquiries</h2>
      <p>A carrier partnership inquiry does not constitute approval or guarantee freight opportunities. Any carrier relationship requires independent verification and a signed broker and carrier agreement.</p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Provide accurate information and only information you are authorized to share.</li>
        <li>Do not submit sensitive personal or financial data through website forms.</li>
        <li>Do not attempt to disrupt, probe, or gain unauthorized access to the website or its systems, including the private administrative area.</li>
        <li>Do not use automated means to submit forms or collect content.</li>
      </ul>

      <h2>Content and trademarks</h2>
      <p>The {site.name} name and logo identify our business. Website content may not be reused without permission. Photographs are used under license from their respective owners.</p>

      <h2>Disclaimers</h2>
      <p>The website is provided &ldquo;as is.&rdquo; We work to keep information accurate, but we do not warrant that it is complete, current, or error free. To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from use of the website.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of Maryland, without regard to conflict of law rules.</p>

      <h2>Changes and contact</h2>
      <p>We may update these terms. Questions can be sent through our <Link href="/contact">contact page</Link>. Please also review our <Link href="/privacy">Privacy Policy</Link>.</p>
    </LegalPage>
  );
}
