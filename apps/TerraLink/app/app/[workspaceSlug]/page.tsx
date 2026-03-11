import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { StatCard } from "@/components/stat-card";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  MapPin,
  Network,
  AlertTriangle,
  ShieldCheck,
  FileCheck,
  Layers,
  Activity,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  BarChart3,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { DashboardRealtime } from "@/components/dashboard-realtime";

// ── Helper ────────────────────────────────────────────
const VERIFICATION_LABEL: Record<string, string> = {
  inferred: "推定",
  declared: "自己申告",
  verified: "検証済み",
};

const VERIFICATION_COLOR: Record<string, string> = {
  inferred:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  declared: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  verified:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  warning:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "重大",
  warning: "警告",
  info: "情報",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "作成",
  update: "更新",
  delete: "削除",
  status_change: "状態変更",
  share: "共有",
  unshare: "共有解除",
};

const TABLE_LABEL: Record<string, string> = {
  organizations: "組織",
  sites: "サイト",
  workspace_organizations: "WS組織",
  workspace_sites: "WSサイト",
  supply_relationships: "取引関係",
  supply_edges: "供給エッジ",
  evidence_items: "証憑",
  assessments: "アセスメント",
  assessment_scopes: "評価スコープ",
  risk_register: "リスク",
  monitoring_rules: "監視ルール",
  monitoring_events: "監視イベント",
  disclosures: "開示",
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}時間前`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}日前`;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

// ── Page ──────────────────────────────────────────────
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();
  const wsId = ctx.workspace.id;

  // ── Parallel data fetching ────────────────────────
  const [
    orgsResult,
    sitesResult,
    relResult,
    openEventsResult,
    criticalEventsResult,
    wsOrgsData,
    wsSitesData,
    relVerificationData,
    assessmentsResult,
    riskResult,
    riskScoresData,
    evidenceResult,
    dataSourceResult,
    intersectionResult,
    activeRulesResult,
    auditResult,
  ] = await Promise.all([
    // 1. Org count
    admin
      .from("workspace_organizations")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId)
      .eq("status", "active"),
    // 2. Site count
    admin
      .from("workspace_sites")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId),
    // 3. Supply relationship count
    admin
      .from("supply_relationships")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId)
      .is("deleted_at", null),
    // 4. Open monitoring events
    admin
      .from("monitoring_events")
      .select("id, severity, monitoring_rule_id, monitoring_rules!inner(workspace_id)")
      .eq("monitoring_rules.workspace_id", wsId)
      .eq("status", "open"),
    // 5. Critical events
    admin
      .from("monitoring_events")
      .select("id, monitoring_rules!inner(workspace_id)")
      .eq("monitoring_rules.workspace_id", wsId)
      .eq("status", "open")
      .eq("severity", "critical"),
    // 6. WS orgs with verification_status
    admin
      .from("workspace_organizations")
      .select("id, verification_status")
      .eq("workspace_id", wsId)
      .eq("status", "active"),
    // 7. WS sites with verification_status
    admin
      .from("workspace_sites")
      .select("id, verification_status")
      .eq("workspace_id", wsId),
    // 8. Supply relationships with verification_status
    admin
      .from("supply_relationships")
      .select("id, verification_status, tier")
      .eq("workspace_id", wsId)
      .is("deleted_at", null),
    // 9. Active assessments
    admin
      .from("assessments")
      .select("id, status, assessment_cycle")
      .eq("workspace_id", wsId),
    // 10. Risk register
    admin
      .from("risk_register")
      .select("id, risk_type, status, assessment_scope_id, assessment_scopes!inner(assessment_id, assessments!inner(workspace_id))")
      .eq("assessment_scopes.assessments.workspace_id", wsId),
    // 11. Risk scores (top 5 by final_score)
    admin
      .from("risk_scores")
      .select("id, final_score, risk_id, risk_register!inner(title, risk_type, status, assessment_scope_id, assessment_scopes!inner(assessment_id, assessments!inner(workspace_id)))")
      .eq("risk_register.assessment_scopes.assessments.workspace_id", wsId)
      .order("final_score", { ascending: false })
      .limit(5),
    // 12. Evidence count
    admin
      .from("evidence_items")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId)
      .is("deleted_at", null),
    // 13. Data sources
    admin
      .from("data_sources")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    // 14. Spatial intersections count
    admin
      .from("spatial_intersections")
      .select("id, workspace_sites!inner(workspace_id)")
      .eq("workspace_sites.workspace_id", wsId),
    // 15. Active monitoring rules
    admin
      .from("monitoring_rules")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", wsId)
      .eq("is_active", true),
    // 16. Recent audit log
    admin
      .from("change_log")
      .select("id, actor_user_id, target_table, target_id, action, created_at")
      .eq("workspace_id", wsId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // ── Derived metrics ───────────────────────────────
  const orgCount = orgsResult.count ?? 0;
  const siteCount = sitesResult.count ?? 0;
  const relCount = relResult.count ?? 0;
  const openAlertCount = openEventsResult.data?.length ?? 0;
  const criticalCount = criticalEventsResult.data?.length ?? 0;
  const evidenceCount = evidenceResult.count ?? 0;
  const dataSourceCount = dataSourceResult.count ?? 0;
  const intersectionCount = intersectionResult.data?.length ?? 0;
  const activeRuleCount = activeRulesResult.count ?? 0;

  // Verification breakdown — orgs
  const orgVerification = { inferred: 0, declared: 0, verified: 0 };
  (wsOrgsData.data ?? []).forEach((o) => {
    const vs = o.verification_status as keyof typeof orgVerification;
    if (vs in orgVerification) orgVerification[vs]++;
  });

  // Verification breakdown — sites
  const siteVerification = { inferred: 0, declared: 0, verified: 0 };
  (wsSitesData.data ?? []).forEach((s) => {
    const vs = s.verification_status as keyof typeof siteVerification;
    if (vs in siteVerification) siteVerification[vs]++;
  });

  // Verification breakdown — supply relationships
  const relVerification = { inferred: 0, declared: 0, verified: 0 };
  const tierDistribution = new Map<number, number>();
  (relVerificationData.data ?? []).forEach((r) => {
    const vs = r.verification_status as keyof typeof relVerification;
    if (vs in relVerification) relVerification[vs]++;
    const t = r.tier as number;
    tierDistribution.set(t, (tierDistribution.get(t) ?? 0) + 1);
  });
  const sortedTiers = Array.from(tierDistribution.entries()).sort(
    (a, b) => a[0] - b[0]
  );

  // Assessments
  const assessments = assessmentsResult.data ?? [];
  const activeAssessments = assessments.filter((a) => a.status === "active");

  // Risks
  const risks = riskResult.data ?? [];
  const openRisks = risks.filter((r) => r.status === "open" || r.status === "mitigating");
  const riskTypeDistribution = new Map<string, number>();
  risks.forEach((r) => {
    riskTypeDistribution.set(
      r.risk_type,
      (riskTypeDistribution.get(r.risk_type) ?? 0) + 1
    );
  });

  // Top risk scores — flatten nested join arrays
  const topRiskScores = (riskScoresData.data ?? []).map((rs) => {
    const rr = Array.isArray(rs.risk_register)
      ? rs.risk_register[0]
      : rs.risk_register;
    return {
      id: rs.id as string,
      final_score: rs.final_score as number,
      risk_register: {
        title: (rr?.title ?? "") as string,
        risk_type: (rr?.risk_type ?? "") as string,
        status: (rr?.status ?? "") as string,
      },
    };
  });

  // Open events by severity
  const eventsBySeverity = { critical: 0, warning: 0, info: 0 };
  (openEventsResult.data ?? []).forEach((ev) => {
    const s = ev.severity as keyof typeof eventsBySeverity;
    if (s in eventsBySeverity) eventsBySeverity[s]++;
  });

  // Recent audit entries
  const auditEntries = (auditResult.data ?? []) as {
    id: string;
    actor_user_id: string | null;
    target_table: string;
    target_id: string;
    action: string;
    created_at: string;
  }[];

  return (
    <div className="space-y-8">
      <PageHeader
        title="ダッシュボード"
        description={`${ctx.workspace.name} の概要`}
      />

      {/* ── Realtime Feed ─────────────────────────── */}
      <DashboardRealtime
        workspaceId={wsId}
        initialAlertCount={openAlertCount}
      />

      {/* ── Primary KPIs ────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="組織"
          value={orgCount}
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="サイト"
          value={siteCount}
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          label="サプライリンク"
          value={relCount}
          icon={<Network className="h-5 w-5" />}
        />
        <StatCard
          label="未対応アラート"
          value={openAlertCount}
          trend={criticalCount > 0 ? `${criticalCount}件 重大` : undefined}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {/* ── Verification Status ─────────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <VerificationCard
          title="組織の検証状態"
          data={orgVerification}
          total={orgCount}
          link={`/app/${workspaceSlug}/orgs`}
        />
        <VerificationCard
          title="サイトの検証状態"
          data={siteVerification}
          total={siteCount}
          link={`/app/${workspaceSlug}/sites`}
        />
        <VerificationCard
          title="サプライリンクの検証状態"
          data={relVerification}
          total={relCount}
          link={`/app/${workspaceSlug}/supply`}
        />
      </div>

      {/* ── Risk & Assessment Row ───────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Assessment Progress */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                LEAP アセスメント
              </CardTitle>
              <Link
                href={`/app/${workspaceSlug}/leap`}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                詳細 <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {assessments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                アセスメントがまだ作成されていません。
              </p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat
                    label="合計"
                    value={assessments.length}
                    icon={<BarChart3 className="h-3.5 w-3.5" />}
                  />
                  <MiniStat
                    label="アクティブ"
                    value={activeAssessments.length}
                    icon={<Activity className="h-3.5 w-3.5" />}
                  />
                  <MiniStat
                    label="オープンリスク"
                    value={openRisks.length}
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  />
                </div>
                {riskTypeDistribution.size > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      リスク種別分布
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(riskTypeDistribution.entries()).map(
                        ([type, count]) => (
                          <Badge
                            key={type}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {RISK_TYPE_LABEL[type] ?? type}: {count}
                          </Badge>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Risk Scores */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                リスクスコア上位
              </CardTitle>
              <Link
                href={`/app/${workspaceSlug}/leap`}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                詳細 <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {topRiskScores.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                リスクスコアがまだ登録されていません。
              </p>
            ) : (
              <div className="space-y-2">
                {topRiskScores.map((rs) => (
                  <div
                    key={rs.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {rs.risk_register.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {RISK_TYPE_LABEL[rs.risk_register.risk_type] ??
                          rs.risk_register.risk_type}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <RiskScoreBadge score={rs.final_score} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monitoring & Data Coverage Row ──────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="有効ルール"
          value={activeRuleCount}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="データソース"
          value={dataSourceCount}
          icon={<Globe className="h-5 w-5" />}
        />
        <StatCard
          label="空間交差"
          value={intersectionCount}
          icon={<Layers className="h-5 w-5" />}
        />
        <StatCard
          label="証憑ファイル"
          value={evidenceCount}
          icon={<FileCheck className="h-5 w-5" />}
        />
      </div>

      {/* ── Monitoring Alerts Breakdown ─────────────── */}
      {openAlertCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4" />
                未対応アラート内訳
              </CardTitle>
              <Link
                href={`/app/${workspaceSlug}/monitor`}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                モニタリングへ <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {(["critical", "warning", "info"] as const).map((sev) => {
                const count = eventsBySeverity[sev];
                if (count === 0) return null;
                return (
                  <div key={sev} className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`${SEVERITY_COLOR[sev]} text-xs`}
                    >
                      {SEVERITY_LABEL[sev]}
                    </Badge>
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Supply Chain Tiers ──────────────────────── */}
      {sortedTiers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" />
                サプライチェーン ティア分布
              </CardTitle>
              <Link
                href={`/app/${workspaceSlug}/supply`}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              >
                詳細 <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {sortedTiers.map(([tier, count]) => (
                <div
                  key={tier}
                  className="flex flex-col items-center rounded-lg border px-4 py-3 min-w-[80px]"
                >
                  <span className="text-xs text-muted-foreground">
                    Tier {tier}
                  </span>
                  <span className="text-xl font-bold">{count}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {pct(count, relCount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Activity ────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            最近のアクティビティ
          </CardTitle>
          <CardDescription>直近の操作履歴</CardDescription>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              組織、サイト、サプライチェーンデータを追加すると、ここにアクティビティフィードが表示されます。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[140px]">時刻</TableHead>
                  <TableHead>対象</TableHead>
                  <TableHead>アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {TABLE_LABEL[entry.target_table] ??
                          entry.target_table}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {ACTION_LABEL[entry.action] ?? entry.action}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────

const RISK_TYPE_LABEL: Record<string, string> = {
  physical: "物理的",
  transition: "移行",
  systemic: "システミック",
  reputational: "評判",
  legal: "法的",
  market: "市場",
};

function VerificationCard({
  title,
  data,
  total,
  link,
}: {
  title: string;
  data: { inferred: number; declared: number; verified: number };
  total: number;
  link: string;
}) {
  const verifiedPct = total > 0 ? Math.round((data.verified / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Link
            href={link}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
          >
            詳細 <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground">データなし</p>
        ) : (
          <div className="space-y-3">
            {/* Progress bar */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {data.verified > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${pct(data.verified, total)}` }}
                />
              )}
              {data.declared > 0 && (
                <div
                  className="bg-sky-500 transition-all"
                  style={{ width: `${pct(data.declared, total)}` }}
                />
              )}
              {data.inferred > 0 && (
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: `${pct(data.inferred, total)}` }}
                />
              )}
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs">
              {(["verified", "declared", "inferred"] as const).map((vs) => (
                <div key={vs} className="flex items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      vs === "verified"
                        ? "bg-emerald-500"
                        : vs === "declared"
                          ? "bg-sky-500"
                          : "bg-amber-400"
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {VERIFICATION_LABEL[vs]}
                  </span>
                  <span className="font-medium">{data[vs]}</span>
                </div>
              ))}
            </div>

            {/* Summary */}
            <p className="text-xs text-muted-foreground">
              検証率: <span className="font-semibold text-foreground">{verifiedPct}%</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function RiskScoreBadge({ score }: { score: number }) {
  let color = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300";
  if (score >= 70) {
    color = "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
  } else if (score >= 40) {
    color = "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  }
  return (
    <Badge variant="secondary" className={`${color} text-xs font-bold tabular-nums`}>
      {score.toFixed(0)}
    </Badge>
  );
}
