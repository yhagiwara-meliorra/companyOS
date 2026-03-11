import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { LeapTabs } from "./leap-tabs";

export default async function LeapPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // ── Load assessments ──────────────────────────────────────
  const { data: assessments } = await admin
    .from("assessments")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });

  // ── Load active assessment's scopes + data ────────────────
  const activeAssessment = (assessments ?? []).find(
    (a) => a.status === "active"
  ) ?? (assessments ?? [])[0];

  let scopes: ScopeRow[] = [];
  let dependencies: DependencyRow[] = [];
  let impacts: ImpactRow[] = [];
  let risks: RiskRow[] = [];
  let riskScores: RiskScoreRow[] = [];
  let disclosures: DisclosureRow[] = [];
  let monitoringRules: MonitoringRuleRow[] = [];

  if (activeAssessment) {
    // Scopes
    const { data: scopeData } = await admin
      .from("assessment_scopes")
      .select(
        `
        id,
        scope_type,
        coverage_status,
        workspace_organization_id,
        workspace_site_id,
        material_id,
        relationship_id,
        created_at
      `
      )
      .eq("assessment_id", activeAssessment.id);
    scopes = (scopeData ?? []) as ScopeRow[];

    const scopeIds = scopes.map((s) => s.id);

    if (scopeIds.length > 0) {
      // Dependencies
      const { data: depData } = await admin
        .from("dependencies")
        .select(
          `
          id,
          assessment_scope_id,
          nature_topic_id,
          dependency_level,
          rationale,
          source_type,
          nature_topics ( topic_key, name, topic_group )
        `
        )
        .in("assessment_scope_id", scopeIds);
      dependencies = (depData ?? []) as unknown as DependencyRow[];

      // Impacts
      const { data: impData } = await admin
        .from("impacts")
        .select(
          `
          id,
          assessment_scope_id,
          nature_topic_id,
          impact_direction,
          impact_level,
          rationale,
          source_type,
          nature_topics ( topic_key, name, topic_group )
        `
        )
        .in("assessment_scope_id", scopeIds);
      impacts = (impData ?? []) as unknown as ImpactRow[];

      // Risks
      const { data: riskData } = await admin
        .from("risk_register")
        .select("*")
        .in("assessment_scope_id", scopeIds)
        .order("created_at", { ascending: false });
      risks = (riskData ?? []) as RiskRow[];

      // Risk Scores
      const riskIds = (riskData ?? []).map((r) => r.id);
      if (riskIds.length > 0) {
        const { data: scoreData } = await admin
          .from("risk_scores")
          .select("*")
          .in("risk_id", riskIds)
          .order("scored_at", { ascending: false });
        riskScores = (scoreData ?? []) as RiskScoreRow[];
      }
    }

    // Disclosures
    const { data: discData } = await admin
      .from("disclosures")
      .select("*")
      .eq("assessment_id", activeAssessment.id)
      .order("created_at", { ascending: false });
    disclosures = (discData ?? []) as DisclosureRow[];
  }

  // Monitoring Rules (workspace-level)
  const { data: monData } = await admin
    .from("monitoring_rules")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });
  monitoringRules = (monData ?? []) as MonitoringRuleRow[];

  // ── Load spatial intersections for Locate tab ─────────────
  // Get workspace_site IDs
  const { data: wsSiteRows } = await admin
    .from("workspace_sites")
    .select("id, site_id")
    .eq("workspace_id", ctx.workspace.id);
  const wsSiteIds = (wsSiteRows ?? []).map((r) => r.id);

  let intersections: IntersectionRow[] = [];
  if (wsSiteIds.length > 0) {
    const { data: intData } = await admin
      .from("spatial_intersections")
      .select(
        `
        id,
        workspace_site_id,
        data_source_id,
        source_observation_id,
        distance_m,
        overlap_pct,
        created_at,
        data_sources ( source_name, category )
      `
      )
      .in("workspace_site_id", wsSiteIds)
      .order("created_at", { ascending: false })
      .limit(100);
    intersections = (intData ?? []) as unknown as IntersectionRow[];
  }

  // Load site names for display
  const siteIds = (wsSiteRows ?? []).map((r) => r.site_id);
  const siteMap: Record<string, string> = {};
  if (siteIds.length > 0) {
    const { data: siteData } = await admin
      .from("sites")
      .select("id, site_name")
      .in("id", siteIds);
    (siteData ?? []).forEach((s) => {
      siteMap[s.id] = s.site_name;
    });
  }

  // Build ws_site_id → site_name mapping
  const wsSiteNameMap: Record<string, string> = {};
  (wsSiteRows ?? []).forEach((ws) => {
    wsSiteNameMap[ws.id] = siteMap[ws.site_id] ?? "Unknown site";
  });

  // ── Load nature topics for Evaluate tab ───────────────────
  const { data: natureTopics } = await admin
    .from("nature_topics")
    .select("*")
    .order("topic_group")
    .order("name");

  // ── Load org names for scope display ──────────────────────
  const wsOrgIds = scopes
    .filter((s) => s.workspace_organization_id)
    .map((s) => s.workspace_organization_id!);
  const orgNameMap: Record<string, string> = {};
  if (wsOrgIds.length > 0) {
    const { data: woData } = await admin
      .from("workspace_organizations")
      .select("id, organization_id")
      .in("id", wsOrgIds);
    const orgIds = (woData ?? []).map((w) => w.organization_id);
    if (orgIds.length > 0) {
      const { data: orgData } = await admin
        .from("organizations")
        .select("id, org_name")
        .in("id", orgIds);
      // Map ws_org_id → org_name
      (woData ?? []).forEach((wo) => {
        const org = (orgData ?? []).find((o) => o.id === wo.organization_id);
        if (org) orgNameMap[wo.id] = org.org_name;
      });
    }
  }

  // ── Workspace sites/orgs list for scope creation ──────────
  const { data: wsOrgs } = await admin
    .from("workspace_organizations")
    .select("id, organization_id, organizations ( org_name )")
    .eq("workspace_id", ctx.workspace.id);

  const { data: wsSites } = await admin
    .from("workspace_sites")
    .select("id, site_id, sites ( site_name )")
    .eq("workspace_id", ctx.workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="LEAPアセスメント"
        description="特定・評価・査定・準備 — 構造化された生物多様性リスク評価"
      />

      <LeapTabs
        workspaceSlug={workspaceSlug}
        assessments={(assessments ?? []) as AssessmentRow[]}
        activeAssessment={activeAssessment as AssessmentRow | undefined}
        scopes={scopes}
        dependencies={dependencies}
        impacts={impacts}
        risks={risks}
        riskScores={riskScores}
        disclosures={disclosures}
        monitoringRules={monitoringRules}
        intersections={intersections}
        wsSiteNameMap={wsSiteNameMap}
        natureTopics={(natureTopics ?? []) as NatureTopicRow[]}
        orgNameMap={orgNameMap}
        wsOrgs={
          (wsOrgs ?? []).map((wo) => ({
            id: wo.id,
            name:
              (wo.organizations as unknown as { org_name: string })
                ?.org_name ?? "Unknown",
          }))
        }
        wsSiteOptions={
          (wsSites ?? []).map((ws) => ({
            id: ws.id,
            name:
              (ws.sites as unknown as { site_name: string })?.site_name ??
              "Unknown",
          }))
        }
      />
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────
// These are shared with client components via props.

export type AssessmentRow = {
  id: string;
  workspace_id: string;
  assessment_cycle: string;
  method_version: string;
  status: string;
  started_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type ScopeRow = {
  id: string;
  scope_type: string;
  coverage_status: string;
  workspace_organization_id: string | null;
  workspace_site_id: string | null;
  material_id: string | null;
  relationship_id: string | null;
  created_at: string;
};

export type NatureTopicRow = {
  id: string;
  topic_key: string;
  name: string;
  topic_group: string;
};

export type DependencyRow = {
  id: string;
  assessment_scope_id: string;
  nature_topic_id: string;
  dependency_level: string;
  rationale: Record<string, unknown>;
  source_type: string;
  nature_topics: { topic_key: string; name: string; topic_group: string } | null;
};

export type ImpactRow = {
  id: string;
  assessment_scope_id: string;
  nature_topic_id: string;
  impact_direction: string;
  impact_level: string;
  rationale: Record<string, unknown>;
  source_type: string;
  nature_topics: { topic_key: string; name: string; topic_group: string } | null;
};

export type RiskRow = {
  id: string;
  assessment_scope_id: string;
  risk_type: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
};

export type RiskScoreRow = {
  id: string;
  risk_id: string;
  severity: number;
  likelihood: number;
  velocity: number | null;
  detectability: number | null;
  final_score: number;
  scored_at: string;
};

export type IntersectionRow = {
  id: string;
  workspace_site_id: string;
  data_source_id: string;
  source_observation_id: string | null;
  distance_m: number | null;
  overlap_pct: number | null;
  created_at: string;
  data_sources: { source_name: string; category: string } | null;
};

export type DisclosureRow = {
  id: string;
  framework: string;
  section_key: string;
  content_md: string;
  status: string;
  created_at: string;
};

export type MonitoringRuleRow = {
  id: string;
  target_type: string;
  target_id: string;
  rule_type: string;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};
