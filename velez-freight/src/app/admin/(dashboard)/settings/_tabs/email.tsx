import Link from "next/link";
import { env, isEmailConfigured } from "@/lib/env";
import { Panel } from "@/components/admin/admin-ui";
import { Check, type TabProps } from "./ui";

export function EmailTab({ b }: TabProps) {
  const senderDomain = env.emailFrom.match(/@([^>\s]+)/)?.[1] ?? null;
  return (
    <Panel title="Email configuration">
      <div id="email" className="scroll-mt-24" />
      <ul className="space-y-2">
        <Check ok={Boolean(env.resendApiKey)}>Email provider API key (<code className="rounded bg-ivory px-1">RESEND_API_KEY</code>) {env.resendApiKey ? "is set" : "is not set"}</Check>
        <Check ok={Boolean(env.emailFrom)}>Sender address (<code className="rounded bg-ivory px-1">NOTIFY_EMAIL_FROM</code>) {env.emailFrom ? `is ${env.emailFrom}` : "is not set"}</Check>
        <Check ok={Boolean(env.notifyTo)}>Internal alert recipient (<code className="rounded bg-ivory px-1">NOTIFY_EMAIL_TO</code>) {env.notifyTo ? "is set" : "is not set"}</Check>
        <Check ok={Boolean(b.mailing_address)}>Mailing address for email footers {b.mailing_address ? "is recorded" : "is missing (add it in Company profile)"}</Check>
        <Check ok={isEmailConfigured()}>Internal alerts for new inquiries {isEmailConfigured() ? "can be sent" : "are off until the three settings above are set"}</Check>
      </ul>
      <p className="mt-4 rounded-md bg-ivory p-3 text-xs leading-relaxed">
        {senderDomain ? <>The sender domain <strong>{senderDomain}</strong> must be verified with the email provider (SPF and DKIM records at your domain registrar) before any outreach can be sent. </> : <>Choose a business domain first; outreach must come from an address on a verified domain. </>}
        Keys are set in the hosting environment with your approval, never typed into this page.
      </p>
      <p className="mt-3 text-sm">Outreach sending controls and templates are in <Link href="/admin/outreach" className="font-semibold text-brand-red-dark underline">Outreach</Link>.</p>
    </Panel>
  );
}
