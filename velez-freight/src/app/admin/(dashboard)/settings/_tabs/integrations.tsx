import { Panel } from "@/components/admin/admin-ui";
import { IntegrationsList } from "@/components/admin/integrations-status";

export function IntegrationsTab() {
  return (
    <Panel title="Integrations">
      <p className="mb-2 text-sm">What this dashboard is connected to. Keys and secrets are stored in the hosting environment, never in this page. Adding a paid service always needs your approval.</p>
      <IntegrationsList />
    </Panel>
  );
}
