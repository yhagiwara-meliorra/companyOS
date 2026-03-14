"use client";

import { useState, useTransition } from "react";
import {
  addDependency,
  addImpact,
  applyManufacturingTemplate,
} from "@/lib/domain/leap-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Loader2,
  Zap,
  TrendingDown,
  TrendingUp,
  Minus,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import type {
  ScopeRow,
  DependencyRow,
  ImpactRow,
  NatureTopicRow,
} from "./page";
import {
  IMPACT_DIRECTION_LABELS,
  LEVEL_LABELS,
  SOURCE_TYPE_LABELS,
  TOPIC_GROUP_LABELS,
} from "@/lib/labels";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const LEVEL_COLOR: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  unknown: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const DIRECTION_ICON: Record<string, React.ReactNode> = {
  negative: <TrendingDown className="h-3.5 w-3.5 text-red-500" />,
  positive: <TrendingUp className="h-3.5 w-3.5 text-green-500" />,
  mixed: <Minus className="h-3.5 w-3.5 text-amber-500" />,
  unknown: <HelpCircle className="h-3.5 w-3.5 text-slate-400" />,
};

const TOPIC_GROUP_COLOR: Record<string, string> = {
  land: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  freshwater: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  marine: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  species: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  pollution: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  climate_interaction: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

type Props = {
  canEdit?: boolean;
  workspaceSlug: string;
  scopes: ScopeRow[];
  dependencies: DependencyRow[];
  impacts: ImpactRow[];
  natureTopics: NatureTopicRow[];
  wsSiteNameMap: Record<string, string>;
  orgNameMap: Record<string, string>;
};

export function EvaluateTab({
  canEdit = false,
  workspaceSlug,
  scopes,
  dependencies,
  impacts,
  natureTopics,
  wsSiteNameMap,
  orgNameMap,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [depOpen, setDepOpen] = useState(false);
  const [impOpen, setImpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateResult, setTemplateResult] = useState<string | null>(null);

  function handleAddDep(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addDependency(workspaceSlug, formData);
      if (res.error) setError(res.error);
      else setDepOpen(false);
    });
  }

  function handleAddImpact(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addImpact(workspaceSlug, formData);
      if (res.error) setError(res.error);
      else setImpOpen(false);
    });
  }

  function handleApplyTemplate(scopeId: string) {
    setTemplateResult(null);
    startTransition(async () => {
      const res = await applyManufacturingTemplate(workspaceSlug, scopeId);
      if (res.error) setTemplateResult(`Error: ${res.error}`);
      else setTemplateResult(`テンプレート ${res.count} 件を適用しました`);
    });
  }

  function scopeName(scopeId: string): string {
    const scope = scopes.find((s) => s.id === scopeId);
    if (!scope) return "Unknown";
    if (scope.workspace_site_id)
      return wsSiteNameMap[scope.workspace_site_id] ?? "Site";
    if (scope.workspace_organization_id)
      return orgNameMap[scope.workspace_organization_id] ?? "Organization";
    return scope.scope_type;
  }

  return (
    <div className="space-y-6">
      {/* Template Action */}
      {canEdit && scopes.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium">
                  製造業テンプレート
                </p>
                <p className="text-xs text-muted-foreground">
                  製造業向けの依存関係・影響仮説を自動生成します
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                className={`${selectCn} w-[200px]`}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) handleApplyTemplate(e.target.value);
                }}
                disabled={isPending}
              >
                <option value="">適用するスコープを選択...</option>
                {scopes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {scopeName(s.id)}
                  </option>
                ))}
              </select>
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </CardContent>
          {templateResult && (
            <CardContent className="pt-0">
              <p
                className={`text-xs ${templateResult.startsWith("Error") ? "text-red-600" : "text-green-600"}`}
              >
                {templateResult}
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Dependencies */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4" />
                自然への依存関係
              </CardTitle>
              <CardDescription>
                事業プロセスが生態系サービスにどう依存しているか
              </CardDescription>
            </div>
            {canEdit && (
              <Dialog open={depOpen} onOpenChange={setDepOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={scopes.length === 0}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    追加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>依存関係を追加</DialogTitle>
                  </DialogHeader>
                  <form action={handleAddDep} className="space-y-4">
                    <div className="space-y-2">
                      <Label>スコープ</Label>
                      <select name="assessmentScopeId" required className={selectCn}>
                        <option value="">スコープを選択...</option>
                        {scopes.map((s) => (
                          <option key={s.id} value={s.id}>{scopeName(s.id)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>自然トピック</Label>
                      <select name="natureTopicId" required className={selectCn}>
                        <option value="">トピックを選択...</option>
                        {natureTopics.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>依存度</Label>
                      <select name="dependencyLevel" defaultValue="unknown" className={selectCn}>
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                        <option value="unknown">不明</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>根拠</Label>
                      <Input name="rationale" placeholder="簡潔な理由を記載" />
                    </div>
                    <input type="hidden" name="sourceType" value="manual" />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" disabled={isPending} className="w-full">
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      依存関係を追加
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {dependencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              依存関係が定義されていません。製造業テンプレートを使用するか、手動で追加してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>トピック</TableHead>
                  <TableHead>グループ</TableHead>
                  <TableHead>レベル</TableHead>
                  <TableHead>ソース</TableHead>
                  <TableHead>スコープ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependencies.map((dep) => (
                  <TableRow key={dep.id}>
                    <TableCell className="font-medium text-sm">
                      {dep.nature_topics?.name ?? "不明"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${TOPIC_GROUP_COLOR[dep.nature_topics?.topic_group ?? ""] ?? ""}`}>
                        {TOPIC_GROUP_LABELS[dep.nature_topics?.topic_group ?? ""] ?? (dep.nature_topics?.topic_group ?? "").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${LEVEL_COLOR[dep.dependency_level] ?? ""}`}>
                        {LEVEL_LABELS[dep.dependency_level] ?? dep.dependency_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{SOURCE_TYPE_LABELS[dep.source_type] ?? dep.source_type}</TableCell>
                    <TableCell className="text-xs">{scopeName(dep.assessment_scope_id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Impacts */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingDown className="h-4 w-4" />
                自然への影響
              </CardTitle>
              <CardDescription>
                事業活動が生態系と生物多様性に与える影響
              </CardDescription>
            </div>
            {canEdit && (
              <Dialog open={impOpen} onOpenChange={setImpOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={scopes.length === 0}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    追加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>影響を追加</DialogTitle>
                  </DialogHeader>
                  <form action={handleAddImpact} className="space-y-4">
                    <div className="space-y-2">
                      <Label>スコープ</Label>
                      <select name="assessmentScopeId" required className={selectCn}>
                        <option value="">スコープを選択...</option>
                        {scopes.map((s) => (
                          <option key={s.id} value={s.id}>{scopeName(s.id)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>自然トピック</Label>
                      <select name="natureTopicId" required className={selectCn}>
                        <option value="">トピックを選択...</option>
                        {natureTopics.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>方向性</Label>
                        <select name="impactDirection" defaultValue="unknown" className={selectCn}>
                          <option value="negative">ネガティブ</option>
                          <option value="positive">ポジティブ</option>
                          <option value="mixed">混合</option>
                          <option value="unknown">不明</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>レベル</Label>
                        <select name="impactLevel" defaultValue="unknown" className={selectCn}>
                          <option value="high">高</option>
                          <option value="medium">中</option>
                          <option value="low">低</option>
                          <option value="unknown">不明</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>根拠</Label>
                      <Input name="rationale" placeholder="簡潔な理由を記載" />
                    </div>
                    <input type="hidden" name="sourceType" value="manual" />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" disabled={isPending} className="w-full">
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      影響を追加
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {impacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              影響が定義されていません。製造業テンプレートを使用するか、手動で追加してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>トピック</TableHead>
                  <TableHead>グループ</TableHead>
                  <TableHead>方向性</TableHead>
                  <TableHead>レベル</TableHead>
                  <TableHead>ソース</TableHead>
                  <TableHead>スコープ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {impacts.map((imp) => (
                  <TableRow key={imp.id}>
                    <TableCell className="font-medium text-sm">
                      {imp.nature_topics?.name ?? "不明"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${TOPIC_GROUP_COLOR[imp.nature_topics?.topic_group ?? ""] ?? ""}`}>
                        {TOPIC_GROUP_LABELS[imp.nature_topics?.topic_group ?? ""] ?? (imp.nature_topics?.topic_group ?? "").replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        {DIRECTION_ICON[imp.impact_direction] ?? null}
                        <span className="text-xs">{IMPACT_DIRECTION_LABELS[imp.impact_direction] ?? imp.impact_direction}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${LEVEL_COLOR[imp.impact_level] ?? ""}`}>
                        {LEVEL_LABELS[imp.impact_level] ?? imp.impact_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{SOURCE_TYPE_LABELS[imp.source_type] ?? imp.source_type}</TableCell>
                    <TableCell className="text-xs">{scopeName(imp.assessment_scope_id)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Visual Summary */}
      {(dependencies.length > 0 || impacts.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">依存関係・影響サマリー</CardTitle>
            <CardDescription>自然トピックグループ別の概要</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from(
                new Set([
                  ...dependencies.map((d) => d.nature_topics?.topic_group ?? "unknown"),
                  ...impacts.map((i) => i.nature_topics?.topic_group ?? "unknown"),
                ])
              ).map((group) => {
                const groupDeps = dependencies.filter((d) => d.nature_topics?.topic_group === group);
                const groupImps = impacts.filter((i) => i.nature_topics?.topic_group === group);
                const highDeps = groupDeps.filter((d) => d.dependency_level === "high").length;
                const highImps = groupImps.filter((i) => i.impact_level === "high").length;

                return (
                  <div key={group} className="rounded-lg border p-3 space-y-2">
                    <Badge variant="secondary" className={`text-[10px] ${TOPIC_GROUP_COLOR[group] ?? ""}`}>
                      {TOPIC_GROUP_LABELS[group] ?? group.replace(/_/g, " ")}
                    </Badge>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">依存関係: {groupDeps.length}</span>
                      {highDeps > 0 && (
                        <Badge variant="secondary" className="text-[9px] bg-red-100 text-red-700">
                          {highDeps} 高
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">影響: {groupImps.length}</span>
                      {highImps > 0 && (
                        <Badge variant="secondary" className="text-[9px] bg-red-100 text-red-700">
                          {highImps} 高
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
