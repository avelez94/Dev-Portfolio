import Link from "next/link";
import { isAdminRole, requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { ProfileTab } from "./_tabs/profile";
import { ComplianceTab } from "./_tabs/compliance";
import { ContactTab } from "./_tabs/contact";
import { WebsiteTab } from "./_tabs/website";
import { EmailTab } from "./_tabs/email";
import { IntegrationsTab } from "./_tabs/integrations";
import { TeamTab } from "./_tabs/team";
import { ActivityTab } from "./_tabs/activity";
import { cn } from "@/lib/utils";

export const metadata = { title: "Business Settings" };

const TABS = [
  { key: "profile", label: "Company Profile" },
  { key: "compliance", label: "Regulatory & Compliance" },
  { key: "contact", label: "Contact & Support" },
  { key: "website", label: "Public Website" },
  { key: "email", label: "Email Configuration" },
  { key: "integrations", label: "Integrations" },
  { key: "team", label: "Team & Permissions" },
  { key: "activity", label: "Activity & Audit" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const s = await requireStaff();
  const canEdit = isAdminRole(s.role);
  const { tab: raw } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : "profile";
  const { data: b } = await s.db.from("business_settings").select("*").eq("id", 1).single();
  if (!b) return <p>Settings unavailable.</p>;
  const props = { s, b, canEdit };
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <>
      <PageHeader title="Business Settings" crumbs={[{ label: "Business Settings" }]} description="Company profile, regulatory credentials, contact details, website display, email, integrations and team access, in one place." />
      <nav aria-label="Settings sections" className="-mx-1 mb-6 overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b border-line px-1">
          {TABS.map((t) => (
            <li key={t.key}>
              <Link
                href={`/admin/settings?tab=${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn("-mb-px inline-block border-b-2 px-3 py-2.5 text-sm font-semibold whitespace-nowrap", t.key === tab ? "border-brand-red text-navy" : "border-transparent text-slate-muted hover:text-navy")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <h2 className="sr-only">{current.label}</h2>
      {tab === "profile" && <ProfileTab {...props} />}
      {tab === "compliance" && <ComplianceTab {...props} />}
      {tab === "contact" && <ContactTab {...props} />}
      {tab === "website" && <WebsiteTab {...props} />}
      {tab === "email" && <EmailTab {...props} />}
      {tab === "integrations" && <IntegrationsTab />}
      {tab === "team" && <TeamTab {...props} />}
      {tab === "activity" && <ActivityTab {...props} />}
    </>
  );
}
