import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal-page";
import { companyName, getSettings } from "@/lib/data/settings";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("privacy", (await getSettings()).operational);
}

// Update this date whenever the policy text changes.
const UPDATED = "November 12, 2026";

export default async function PrivacyPage() {
  const settings = await getSettings();
  const name = companyName(settings);
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <p>This policy explains how {name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) handles information collected through this website. We collect only what we need to respond to you, and we do not sell personal information.</p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Information you submit.</strong> When you use a form, we collect what you enter, such as your name, company, business email, phone number, and message. Freight inquiry forms may also collect shipment details such as locations, dates, commodity, weight, and equipment needs. Carrier inquiries may include MC and USDOT numbers, equipment types, and operating regions.</li>
        <li><strong>Technical information.</strong> To protect our forms from abuse, we create a one way, salted hash of your IP address when you submit a form. We do not store your raw IP address with your inquiry. Our hosting provider may keep standard server logs.</li>
        <li><strong>How you found us.</strong> When you submit a form, we also record the first page you visited on this site and a general category for how you arrived (for example, a search engine, a link on another site, or typing our address), including the search engine’s name if you came from search. We do not record your search terms, the full address of the page you came from, or use cookies for this; the information stays in your browser tab until you submit a form.</li>
        {process.env.NEXT_PUBLIC_WEB_ANALYTICS === "vercel" && (
          <li><strong>Page view statistics.</strong> We use Vercel Web Analytics to count visits to public pages. It does not use cookies, does not identify you, and reports only totals such as page views, the page address without any query details, the referring website, country, browser, and device type.</li>
        )}
        <li><strong>Administrative accounts.</strong> If you are invited to our private dashboard, we store your email address and the actions you take there for security and audit purposes.</li>
      </ul>
      <p>Please do not submit Social Security numbers, bank or payment details, tax forms, or identity documents through this website. We do not request them here.</p>

      <h2>How we use information</h2>
      <ul>
        <li>To read and respond to your inquiry and follow up about your request.</li>
        <li>To evaluate freight inquiries and carrier partnership interest.</li>
        <li>To notify you about our launch, if you asked us to.</li>
        <li>To protect the website from spam, fraud, and abuse.</li>
        <li>To meet legal, tax, and recordkeeping obligations.</li>
      </ul>
      <p>We do not use automated decision making that produces legal or similarly significant effects about you.</p>

      <h2>How information is shared</h2>
      <p>We share information only with service providers that help us operate this website and respond to you, and only as needed for that purpose. These currently include our website hosting provider, our database provider, and our email delivery provider. If we arrange a shipment for you in the future, we will share the shipment details a carrier needs to perform it. We may disclose information when required by law or to protect our rights and the safety of others.</p>

      <h2>Retention</h2>
      <p>We keep inquiries for as long as needed to respond and maintain a record of our business relationships, and then delete or anonymize them. Rate limiting records are deleted automatically within two days.</p>

      <h2>Security</h2>
      <p>Submissions are sent over encrypted connections and stored in a database that is not publicly accessible. Access is limited to invited staff accounts and every administrative action is logged. No system is perfectly secure, but we take reasonable measures appropriate to the information we hold.</p>

      <h2>Your choices</h2>
      <p>You may ask us to access, correct, or delete the information you submitted, or to stop sending you launch updates, by contacting us through our <Link href="/contact">contact page</Link>{settings.publicEmail ? <> or at <a href={`mailto:${settings.publicEmail}`}>{settings.publicEmail}</a></> : null}. We will respond within a reasonable time and as required by applicable law, including the Maryland Online Data Privacy Act where it applies.</p>

      <h2>Children</h2>
      <p>This website is intended for businesses and is not directed to children under 13. We do not knowingly collect information from children.</p>

      <h2>Changes</h2>
      <p>We may update this policy. The date at the top shows when it was last changed.</p>
    </LegalPage>
  );
}
