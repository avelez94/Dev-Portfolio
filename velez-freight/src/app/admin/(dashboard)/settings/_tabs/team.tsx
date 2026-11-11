import { inviteUser, setAccess } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/action-form";
import { AdminField, Panel, adminInput } from "@/components/admin/admin-ui";
import type { TabProps } from "./ui";

const MATRIX: [string, string, string, string][] = [
  ["Shippers, carriers, inquiries, tasks", "Yes", "Yes", "Yes"],
  ["Quotes and shipments (once operating)", "Yes", "Yes", "Yes"],
  ["Upload and open documents (except W9 and compliance evidence)", "Yes", "Yes", "Yes"],
  ["Invoices, payables, expenses, financial reports", "Yes", "Yes", "No"],
  ["Business settings, credentials, website content", "Yes", "Yes", "View only"],
  ["Launch preview, outreach approval and sending", "Yes", "Yes", "No"],
  ["Audit log", "Yes", "Yes", "No"],
  ["Invite people, change roles, remove access", "Yes", "No", "No"],
];

export async function TeamTab({ s }: TabProps) {
  const { data: team } = s.role === "owner" ? await s.db.from("profiles").select("id, email, full_name, role, is_active, created_at").order("created_at") : { data: null };
  return (
    <div className="space-y-6">
      <Panel title="Permissions by role">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-muted"><th scope="col" className="py-2 pr-4">Area</th><th scope="col" className="px-3 py-2">Owner</th><th scope="col" className="px-3 py-2">Admin</th><th scope="col" className="px-3 py-2">Staff</th></tr></thead>
            <tbody className="divide-y divide-line">
              {MATRIX.map(([area, ...cells]) => (
                <tr key={area}><th scope="row" className="py-2 pr-4 text-left font-medium text-navy">{area}</th>{cells.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-muted">Enforced on the server and in the database for every request, not only by hiding menu items.</p>
      </Panel>
      {team ? (
        <Panel title="Team access (owner only)">
          <p className="mb-4 text-sm">There is no public sign up. People can access the dashboard only through an invitation sent from here.</p>
          <ActionForm action={inviteUser} submitLabel="Send invitation" variant="navy" resetOnSuccess trackChanges={false}>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_9rem]">
              <AdminField label="Email" htmlFor="inv-email"><input id="inv-email" name="email" type="email" required className={adminInput} /></AdminField>
              <AdminField label="Name" htmlFor="inv-name"><input id="inv-name" name="full_name" maxLength={120} className={adminInput} /></AdminField>
              <AdminField label="Role" htmlFor="inv-role"><select id="inv-role" name="role" defaultValue="staff" className={adminInput}><option value="staff">Staff</option><option value="admin">Admin</option></select></AdminField>
            </div>
          </ActionForm>
          <ul className="mt-6 divide-y divide-line">
            {team.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="font-medium text-navy">{m.full_name || m.email}</span>
                <span className="text-xs text-slate-muted">{m.email}</span>
                <span className="text-xs capitalize">{m.role}</span>
                <span className={`text-xs font-semibold ${m.is_active ? "text-success" : "text-danger"}`}>{m.is_active ? "Active" : "No access"}</span>
                {m.id !== s.userId && (
                  <form action={setAccess} className="ml-auto flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="role" value={m.role} />
                    <input type="hidden" name="is_active" value={m.is_active ? "false" : "true"} />
                    <button className="rounded border border-line px-2.5 py-1 text-xs font-semibold hover:bg-ivory">{m.is_active ? "Remove access" : "Restore access"}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel title="Team access"><p className="text-sm">Only the owner can invite people or change access.</p></Panel>
      )}
    </div>
  );
}
