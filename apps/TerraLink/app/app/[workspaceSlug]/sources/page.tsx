import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, Layers, CheckCircle2, XCircle, Clock, Play } from "lucide-react";
import { IngestionTriggerButton } from "./ingestion-trigger-button";
import { RUN_STATUS_LABELS, DATA_SOURCE_CATEGORY_LABELS } from "@/lib/labels";

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3.5 w-3.5 text-yellow-500" />,
  running: <Play className="h-3.5 w-3.5 text-blue-500 animate-pulse" />,
  succeeded: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  partial: <CheckCircle2 className="h-3.5 w-3.5 text-yellow-500" />,
};

const CATEGORY_COLOR: Record<string, string> = {
  protected_area: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  kba: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  water: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  forest: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  land_cover: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  species: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  climate: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  custom: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

export default async function SourcesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Get all data sources
  const { data: sources } = await admin
    .from("data_sources")
    .select("*")
    .eq("is_active", true)
    .order("category")
    .order("source_name");

  // Get recent ingestion runs (last 20)
  const { data: runs } = await admin
    .from("ingestion_runs")
    .select(
      `
      id,
      status,
      started_at,
      completed_at,
      stats,
      error_message,
      data_sources (
        source_name,
        category
      )
    `
    )
    .order("created_at", { ascending: false })
    .limit(20);

  // Get intersection counts per source for this workspace
  // Two-step: first get workspace_site IDs, then query intersections
  const { data: wsSiteRows } = await admin
    .from("workspace_sites")
    .select("id")
    .eq("workspace_id", ctx.workspace.id);

  const wsSiteIds = (wsSiteRows ?? []).map((r) => r.id);

  const intersectionsBySource: Record<string, number> = {};

  if (wsSiteIds.length > 0) {
    const { data: intersections } = await admin
      .from("spatial_intersections")
      .select("data_source_id")
      .in("workspace_site_id", wsSiteIds);

    (intersections ?? []).forEach((row) => {
      const dsId = row.data_source_id;
      intersectionsBySource[dsId] = (intersectionsBySource[dsId] || 0) + 1;
    });
  }

  const sourceList = sources ?? [];
  const runList = runs ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="データソース"
        description="外部データソースとインジェスションパイプライン"
      />

      {/* Source Cards */}
      {sourceList.length === 0 ? (
        <EmptyState
          icon={<Database className="h-6 w-6" />}
          title="データソースが設定されていません"
          description="データベースにシードデータを投入すると、ここにデータソースが表示されます。"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sourceList.map((ds) => (
            <Card key={ds.id} className="relative overflow-hidden">
              <div className="absolute right-0 top-0 h-1 w-full">
                <div
                  className={`h-full ${CATEGORY_COLOR[ds.category]?.split(" ")[0] ?? "bg-slate-100"}`}
                />
              </div>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {ds.source_name}
                    </CardTitle>
                    <CardDescription className="mt-0.5 text-xs">
                      {ds.source_key}
                    </CardDescription>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] ${CATEGORY_COLOR[ds.category] ?? ""}`}
                  >
                    {DATA_SOURCE_CATEGORY_LABELS[ds.category] ?? ds.category.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {intersectionsBySource[ds.id] ?? 0} 交差
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {ds.access_mode}
                  </Badge>
                </div>
                <IngestionTriggerButton
                  workspaceSlug={workspaceSlug}
                  dataSourceId={ds.id}
                  sourceName={ds.source_name}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ingestion History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">インジェスション履歴</CardTitle>
          <CardDescription>
            最近のデータインジェスション実行結果
          </CardDescription>
        </CardHeader>
        <CardContent>
          {runList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              インジェスション実行がありません。上のデータソースからインジェスションを実行してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>ソース</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>開始</TableHead>
                  <TableHead>観測値</TableHead>
                  <TableHead>交差</TableHead>
                  <TableHead>エラー</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runList.map((run) => {
                  const ds = run.data_sources as unknown as {
                    source_name: string;
                    category: string;
                  } | null;
                  const stats = (run.stats ?? {}) as Record<string, number>;
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {ds?.source_name ?? "Unknown"}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          {STATUS_ICON[run.status] ?? null}
                          <span className="text-xs">
                            {RUN_STATUS_LABELS[run.status] ?? run.status}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {run.started_at
                          ? new Date(run.started_at).toLocaleString("ja-JP", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {stats.observations_loaded ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {stats.intersections_found ?? "—"}
                      </TableCell>
                      <TableCell>
                        {run.error_message && (
                          <span
                            className="text-xs text-red-600 truncate max-w-[200px] block"
                            title={run.error_message}
                          >
                            {run.error_message}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
