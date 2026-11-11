import Link from "next/link";
import { saveDisplayPrefs } from "@/app/admin/settings-actions";
import { DEFAULT_DISPLAY, DISPLAY_PREFS } from "@/config/credentials";
import { getSettings } from "@/lib/data/settings";
import { ActionForm } from "@/components/admin/action-form";
import { Panel } from "@/components/admin/admin-ui";
import { ReadOnlyNote, Toggle, type TabProps } from "./ui";

export async function WebsiteTab({ b, canEdit }: TabProps) {
  const prefs = { ...DEFAULT_DISPLAY, ...(b.display_prefs ?? {}) };
  const settings = await getSettings();
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <Panel title="What the website displays">
        <ReadOnlyNote canEdit={canEdit} />
        <ActionForm action={saveDisplayPrefs} submitLabel="Save display preferences" confirm="These choices change what visitors see on the public website within a minute. Save them?">
          <fieldset disabled={!canEdit} className="grid gap-2">
            {DISPLAY_PREFS.map((p) => <Toggle key={p.key} name={p.key} label={p.label} checked={prefs[p.key]} />)}
          </fieldset>
        </ActionForm>
        <p className="mt-4 text-sm">
          Edit page text, service toggles and the prelaunch message in <Link href="/admin/content" className="font-semibold text-brand-red-dark underline">Website Content</Link>, or see the launch version of every page in the{" "}
          <Link href="/admin/preview" className="font-semibold text-brand-red-dark underline">launch preview</Link>.
        </p>
      </Panel>
      <Panel title="Visitors see now">
        <ul className="space-y-2 text-sm" data-testid="public-preview">
          <li><span className="font-semibold text-navy">Mode:</span> {settings.operational ? "Active brokerage" : "Prelaunch"}</li>
          <li><span className="font-semibold text-navy">Email:</span> {settings.publicEmail ?? "Hidden"}</li>
          <li><span className="font-semibold text-navy">Phone:</span> {settings.publicPhone ?? "Hidden"}</li>
          <li><span className="font-semibold text-navy">Business hours:</span> {settings.hours ? "Shown on Contact page" : "Hidden"}</li>
          <li><span className="font-semibold text-navy">After hours:</span> {settings.afterHours ?? "Not mentioned"}</li>
          <li>
            <span className="font-semibold text-navy">Credentials in footer:</span>{" "}
            {settings.credentials.length ? settings.credentials.map((c) => `${c.label} ${c.value}`).join(", ") : "None verified and selected"}
            {settings.credentials.length > 0 && !settings.operational ? " (appear once operating)" : ""}
          </li>
          <li><span className="font-semibold text-navy">Social links:</span> {settings.social.length ? settings.social.map((x) => x.label).join(", ") : "None"}</li>
        </ul>
      </Panel>
    </div>
  );
}
