import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import {
  DDS_STATUS_LABELS,
  label,
} from "@/lib/labels";
import {
  FileText,
  MapPin,
  ShieldCheck,
  Package,
} from "lucide-react";

export default async function EudrDashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Fetch DDS stats
  const { data: allDds } = await admin
    .from("eudr_dds_statements")
    .select("id, status, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .is("deleted_at", null);

  const ddsList = allDds ?? [];
  const ddsCount = ddsList.length;
  const draftCount = ddsList.filter((d) => d.status === "draft").length;
  const readyCount = ddsList.filter((d) => d.status === "ready").length;
  const submittedCount = ddsList.filter((d) => d.status === "submitted").length;

  // Fetch risk assessment stats
  const ddsIds = ddsList.map((d) => d.id);
  const { data: assessments } = await admin
    .from("eudr_risk_assessments")
    .select("id, overall_result, dds_id")
    .in("dds_id", ddsIds.length > 0 ? ddsIds : ["_none_"]);

  const assessmentList = assessments ?? [];
  const negligibleCount = assessmentList.filter(
    (a) => a.overall_result === "negligible"
  ).length;
  const nonNegligibleCount = assessmentList.filter(
    (a) => a.overall_result === "non_negligible"
  ).length;
  const pendingCount = assessmentList.filter(
    (a) => a.overall_result === "pending"
  ).length;

  // Fetch plot count
  const { count: plotCount } = await admin
    .from("eudr_dds_plots")
    .select("id", { count: "exact", head: true })
    .in(
      "product_line_id",
      ddsIds.length > 0 ? ddsIds : ["_none_"]
    );

  // Recent DDS
  const { data: recentDds } = await admin
    .from("eudr_dds_statements")
    .select(
      `
      id, internal_reference, status, operator_type, created_at,
      operator_org:organizations!operator_org_id (display_name)
    `
    )
    .eq("workspace_id", ctx.workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const base = `/app/${workspaceSlug}/eudr`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">EUDR</h1>
        <p className="text-sm text-muted-foreground">
          EU森林破壊規制 — デューデリジェンスステートメント管理
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={FileText}
          label="DDS 合計"
          value={ddsCount}
          sub={`下書き ${draftCount} / 準備完了 ${readyCount} / 提出済み ${submittedCount}`}
          href={`${base}/dds`}
        />
        <KpiCard
          icon={ShieldCheck}
          label="リスク評価"
          value={assessmentList.length}
          sub={`無視可能 ${negligibleCount} / 無視不可 ${nonNegligibleCount} / 未評価 ${pendingCount}`}
          href={`${base}/assessments`}
        />
        <KpiCard
          icon={MapPin}
          label="生産区画"
          value={plotCount ?? 0}
          sub="登録済み区画数"
          href={`${base}/plots`}
        />
        <KpiCard
          icon={Package}
          label="コモディティ"
          value={7}
          sub="cattle, cocoa, coffee, palm, rubber, soya, wood"
          href={`${base}/commodities`}
        />
      </div>

      {/* Recent DDS */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">最近の DDS</h2>
          <Link
            href={`${base}/dds/new`}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            新規 DDS 作成
          </Link>
        </div>

        {(recentDds ?? []).length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              DDS がまだ作成されていません
            </p>
            <Link
              href={`${base}/dds/new`}
              className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              最初の DDS を作成
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">参照番号</th>
                  <th className="px-4 py-2 text-left font-medium">
                    オペレーター
                  </th>
                  <th className="px-4 py-2 text-left font-medium">ステータス</th>
                  <th className="px-4 py-2 text-left font-medium">作成日</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(recentDds ?? []).map((d) => {
                  const org = d.operator_org as unknown as {
                    display_name: string;
                  } | null;
                  return (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <Link
                          href={`${base}/dds/${d.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {d.internal_reference}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {org?.display_name ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(d.created_at).toLocaleDateString("ja-JP")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLinkCard
          href={`${base}/commodities`}
          title="コモディティコード"
          description="EUDR 対象の CN/HS コード一覧"
        />
        <QuickLinkCard
          href={`${base}/benchmarks`}
          title="国別リスク分類"
          description="国別の low/standard/high リスク分類"
        />
        <QuickLinkCard
          href={`${base}/assessments`}
          title="リスク評価"
          description="DDS ごとの 14 基準リスク評価"
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label: labelText,
  value,
  sub,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-background p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{labelText}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}

function QuickLinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-background p-4 transition-colors hover:bg-accent/50"
    >
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    ready: "bg-blue-100 text-blue-700",
    submitted: "bg-yellow-100 text-yellow-700",
    validated: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    withdrawn: "bg-gray-100 text-gray-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {label(DDS_STATUS_LABELS, status)}
    </span>
  );
}
