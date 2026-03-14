import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { MonitorDashboard } from "./monitor-dashboard";
import { canEdit } from "@/lib/auth/roles";

export default async function MonitorPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const hasEditAccess = canEdit(ctx.membership.role);

  const admin = createAdminClient();

  // Load monitoring rules
  const { data: rules } = await admin
    .from("monitoring_rules")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });

  // Load monitoring events for all rules
  const ruleIds = (rules ?? []).map((r) => r.id);
  let events: MonitoringEventRow[] = [];
  if (ruleIds.length > 0) {
    const { data } = await admin
      .from("monitoring_events")
      .select("*")
      .in("monitoring_rule_id", ruleIds)
      .order("triggered_at", { ascending: false })
      .limit(100);
    events = (data ?? []) as MonitoringEventRow[];
  }

  // Load orgs and sites for creating rules with context
  const { data: wsOrgs } = await admin
    .from("workspace_organizations")
    .select("organization_id, organizations ( id, display_name )")
    .eq("workspace_id", ctx.workspace.id);

  const { data: wsSites } = await admin
    .from("workspace_sites")
    .select("site_id, sites ( id, site_name )")
    .eq("workspace_id", ctx.workspace.id);

  const orgOptions = (wsOrgs ?? [])
    .map((wo) => {
      const org = wo.organizations as unknown as {
        id: string;
        display_name: string;
      };
      return { id: org?.id ?? "", name: org?.display_name ?? "Unknown" };
    })
    .filter((o) => o.id);

  const siteOptions = (wsSites ?? [])
    .map((ws) => {
      const site = ws.sites as unknown as {
        id: string;
        site_name: string;
      };
      return { id: site?.id ?? "", name: site?.site_name ?? "Unknown" };
    })
    .filter((s) => s.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="モニタリング"
        description="データ鮮度、リスク閾値、レビューサイクルの自動アラート"
      />
      <MonitorDashboard
        workspaceSlug={workspaceSlug}
        rules={(rules ?? []) as MonitoringRuleRow[]}
        events={events}
        orgOptions={orgOptions}
        siteOptions={siteOptions}
        canEdit={hasEditAccess}
      />
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────

export type MonitoringRuleRow = {
  id: string;
  workspace_id: string;
  target_type: string;
  target_id: string;
  rule_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MonitoringEventRow = {
  id: string;
  monitoring_rule_id: string;
  status: string;
  severity: string;
  title: string;
  payload: Record<string, unknown>;
  triggered_at: string;
  resolved_at: string | null;
  created_at: string;
};
