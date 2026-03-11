"use client";

import { useState, useTransition } from "react";
import { addAssessmentScope } from "@/lib/domain/leap-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MapPin,
  Plus,
  Loader2,
  Layers,
  Target,
  Building2,
} from "lucide-react";
import type { ScopeRow, IntersectionRow } from "./page";
import { DATA_SOURCE_CATEGORY_LABELS } from "@/lib/labels";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const CATEGORY_COLOR: Record<string, string> = {
  protected_area:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  kba: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  water: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  forest:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  species:
    "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  climate:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

type Props = {
  workspaceSlug: string;
  assessmentId: string;
  scopes: ScopeRow[];
  intersections: IntersectionRow[];
  wsSiteNameMap: Record<string, string>;
  orgNameMap: Record<string, string>;
  wsOrgs: { id: string; name: string }[];
  wsSiteOptions: { id: string; name: string }[];
};

export function LocateTab({
  workspaceSlug,
  assessmentId,
  scopes,
  intersections,
  wsSiteNameMap,
  orgNameMap,
  wsOrgs,
  wsSiteOptions,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [scopeType, setScopeType] = useState("site");
  const [targetId, setTargetId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAddScope() {
    if (!targetId) return;
    setError(null);
    startTransition(async () => {
      const res = await addAssessmentScope(
        workspaceSlug,
        assessmentId,
        scopeType,
        targetId
      );
      if (res.error) {
        setError(res.error);
      } else {
        setDialogOpen(false);
        setTargetId("");
      }
    });
  }

  // Group intersections by site
  const bySite = new Map<string, IntersectionRow[]>();
  intersections.forEach((int) => {
    const list = bySite.get(int.workspace_site_id) ?? [];
    list.push(int);
    bySite.set(int.workspace_site_id, list);
  });

  function scopeLabel(scope: ScopeRow): string {
    if (scope.workspace_site_id) {
      return wsSiteNameMap[scope.workspace_site_id] ?? "不明なサイト";
    }
    if (scope.workspace_organization_id) {
      return orgNameMap[scope.workspace_organization_id] ?? "不明な組織";
    }
    return scope.scope_type;
  }

  const targetOptions =
    scopeType === "site"
      ? wsSiteOptions
      : scopeType === "organization"
        ? wsOrgs
        : [];

  return (
    <div className="space-y-6">
      {/* Scopes Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" />
                アセスメント対象範囲
              </CardTitle>
              <CardDescription>
                このアセスメントに含まれるサイトと組織
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  スコープを追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>アセスメント対象を追加</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">対象種別</label>
                    <select
                      className={selectCn}
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value)}
                    >
                      <option value="site">サイト</option>
                      <option value="organization">組織</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {scopeType === "site" ? "サイト" : "組織"}
                    </label>
                    <select
                      className={selectCn}
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                    >
                      <option value="">選択...</option>
                      {targetOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                  <Button
                    onClick={handleAddScope}
                    disabled={isPending || !targetId}
                    className="w-full"
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    アセスメントに追加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {scopes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              対象範囲が定義されていません。サイトまたは組織を追加してアセスメントを開始してください。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scopes.map((scope) => (
                <Badge
                  key={scope.id}
                  variant="outline"
                  className="flex items-center gap-1.5 px-3 py-1.5"
                >
                  {scope.scope_type === "site" ? (
                    <MapPin className="h-3 w-3" />
                  ) : (
                    <Building2 className="h-3 w-3" />
                  )}
                  {scopeLabel(scope)}
                  <Badge variant="secondary" className="ml-1 text-[9px]">
                    {scope.coverage_status}
                  </Badge>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spatial Intersections */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4" />
            空間交差分析
          </CardTitle>
          <CardDescription>
            サイトが外部生物多様性データソースと重なる箇所
          </CardDescription>
        </CardHeader>
        <CardContent>
          {intersections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              空間交差が見つかりません。データソースのインジェスションを実行して、サイトとの重なりを検出してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>サイト</TableHead>
                  <TableHead>データソース</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead className="text-right">距離 (km)</TableHead>
                  <TableHead className="text-right">重複率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intersections.map((int) => (
                  <TableRow key={int.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {wsSiteNameMap[int.workspace_site_id] ?? "不明"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {int.data_sources?.source_name ?? "不明"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${CATEGORY_COLOR[int.data_sources?.category ?? ""] ?? ""}`}
                      >
                        {DATA_SOURCE_CATEGORY_LABELS[int.data_sources?.category ?? ""] ?? (int.data_sources?.category ?? "").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {int.distance_m != null
                        ? (int.distance_m / 1000).toFixed(1)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {int.overlap_pct != null
                        ? `${(int.overlap_pct * 100).toFixed(0)}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Summary cards */}
          {bySite.size > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from(bySite.entries()).map(([siteId, ints]) => (
                <div
                  key={siteId}
                  className="rounded-lg border p-3 space-y-1"
                >
                  <p className="text-sm font-medium">
                    {wsSiteNameMap[siteId] ?? "不明なサイト"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ints.length} 件の交差
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(
                      new Set(
                        ints.map((i) => i.data_sources?.category ?? "unknown")
                      )
                    ).map((cat) => (
                      <Badge
                        key={cat}
                        variant="secondary"
                        className={`text-[9px] ${CATEGORY_COLOR[cat] ?? ""}`}
                      >
                        {DATA_SOURCE_CATEGORY_LABELS[cat] ?? cat.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
