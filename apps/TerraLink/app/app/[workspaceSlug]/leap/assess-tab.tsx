"use client";

import { useState, useTransition } from "react";
import { addRisk, scoreRisk, updateRiskStatus } from "@/lib/domain/leap-actions";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Loader2,
  ShieldAlert,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Timer,
  XCircle,
} from "lucide-react";
import type { ScopeRow, RiskRow, RiskScoreRow } from "./page";
import { RISK_STATUS_LABELS, RISK_TYPE_LABELS } from "@/lib/labels";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const RISK_TYPE_COLOR: Record<string, string> = {
  physical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  transition: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  systemic: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  reputational: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  legal: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  market: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  open: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
  accepted: <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />,
  mitigating: <Timer className="h-3.5 w-3.5 text-violet-500" />,
  closed: <XCircle className="h-3.5 w-3.5 text-slate-400" />,
};

function scoreColor(score: number): string {
  if (score >= 50) return "text-red-600 font-bold";
  if (score >= 25) return "text-amber-600 font-semibold";
  if (score >= 10) return "text-yellow-600";
  return "text-green-600";
}

type Props = {
  canEdit?: boolean;
  workspaceSlug: string;
  scopes: ScopeRow[];
  risks: RiskRow[];
  riskScores: RiskScoreRow[];
  wsSiteNameMap: Record<string, string>;
  orgNameMap: Record<string, string>;
};

export function AssessTab({
  canEdit = false,
  workspaceSlug,
  scopes,
  risks,
  riskScores,
  wsSiteNameMap,
  orgNameMap,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [riskOpen, setRiskOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAddRisk(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addRisk(workspaceSlug, formData);
      if (res.error) setError(res.error);
      else setRiskOpen(false);
    });
  }

  function handleScoreRisk(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await scoreRisk(workspaceSlug, formData);
      if (res.error) setError(res.error);
      else {
        setScoreOpen(false);
        setSelectedRiskId(null);
      }
    });
  }

  function handleStatusChange(riskId: string, status: string) {
    startTransition(async () => {
      await updateRiskStatus(workspaceSlug, riskId, status);
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

  // Get latest score for each risk
  const latestScoreMap = new Map<string, RiskScoreRow>();
  riskScores.forEach((s) => {
    if (!latestScoreMap.has(s.risk_id)) {
      latestScoreMap.set(s.risk_id, s);
    }
  });

  // Summary stats
  const openRisks = risks.filter((r) => r.status === "open").length;
  const highRisks = risks.filter((r) => {
    const score = latestScoreMap.get(r.id);
    return score && score.final_score >= 50;
  }).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openRisks}</p>
              <p className="text-xs text-muted-foreground">未対応リスク</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{highRisks}</p>
              <p className="text-xs text-muted-foreground">高リスク項目</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900">
              <BarChart3 className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{risks.length}</p>
              <p className="text-xs text-muted-foreground">リスク総数</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Register */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4" />
                リスク台帳
              </CardTitle>
              <CardDescription>
                評価を通じて特定された自然関連リスク
              </CardDescription>
            </div>
            {canEdit && (
              <Dialog open={riskOpen} onOpenChange={setRiskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={scopes.length === 0}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    リスクを追加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>リスクを追加</DialogTitle>
                  </DialogHeader>
                  <form action={handleAddRisk} className="space-y-4">
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
                      <Label>リスク種別</Label>
                      <select name="riskType" required className={selectCn}>
                        <option value="">種別を選択...</option>
                        <option value="physical">物理的</option>
                        <option value="transition">移行</option>
                        <option value="systemic">システミック</option>
                        <option value="reputational">レピュテーション</option>
                        <option value="legal">法的</option>
                        <option value="market">市場</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>タイトル</Label>
                      <Input name="title" placeholder="リスクのタイトル" required />
                    </div>
                    <div className="space-y-2">
                      <Label>説明</Label>
                      <Textarea name="description" placeholder="リスクの詳細を記載..." required />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" disabled={isPending} className="w-full">
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      リスクを追加
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {risks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              リスクが特定されていません。依存関係・影響分析に基づいてリスクを追加してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>ステータス</TableHead>
                  <TableHead>タイトル</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>スコープ</TableHead>
                  <TableHead className="text-right">スコア</TableHead>
                  {canEdit && <TableHead>操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map((risk) => {
                  const score = latestScoreMap.get(risk.id);
                  return (
                    <TableRow key={risk.id}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          {STATUS_ICON[risk.status] ?? null}
                          <span className="text-xs">{RISK_STATUS_LABELS[risk.status] ?? risk.status}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{risk.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {risk.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${RISK_TYPE_COLOR[risk.risk_type] ?? ""}`}
                        >
                          {RISK_TYPE_LABELS[risk.risk_type] ?? risk.risk_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {scopeName(risk.assessment_scope_id)}
                      </TableCell>
                      <TableCell className="text-right">
                        {score ? (
                          <span className={`text-sm tabular-nums ${scoreColor(score.final_score)}`}>
                            {score.final_score.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setSelectedRiskId(risk.id);
                                setScoreOpen(true);
                              }}
                            >
                              スコア
                            </Button>
                            {risk.status === "open" && (
                              <select
                                className="h-7 w-[100px] rounded-md border border-input bg-transparent px-2 text-xs"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) handleStatusChange(risk.id, e.target.value);
                                }}
                              >
                                <option value="">状態変更...</option>
                                <option value="accepted">受容</option>
                                <option value="mitigating">緩和中</option>
                                <option value="closed">完了</option>
                              </select>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Score Dialog */}
      {canEdit && (
        <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>リスクスコアリング</DialogTitle>
            </DialogHeader>
            <form action={handleScoreRisk} className="space-y-4">
              <input type="hidden" name="riskId" value={selectedRiskId ?? ""} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    重大度 <span className="text-muted-foreground">(0-10)</span>
                  </Label>
                  <Input name="severity" type="number" min="0" max="10" step="0.5" required placeholder="0-10" />
                </div>
                <div className="space-y-2">
                  <Label>
                    発生可能性 <span className="text-muted-foreground">(0-10)</span>
                  </Label>
                  <Input name="likelihood" type="number" min="0" max="10" step="0.5" required placeholder="0-10" />
                </div>
                <div className="space-y-2">
                  <Label>
                    速度 <span className="text-muted-foreground">(任意)</span>
                  </Label>
                  <Input name="velocity" type="number" min="0" max="10" step="0.5" placeholder="0-10" />
                </div>
                <div className="space-y-2">
                  <Label>
                    検出可能性 <span className="text-muted-foreground">(任意)</span>
                  </Label>
                  <Input name="detectability" type="number" min="0" max="10" step="0.5" placeholder="0-10" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                最終スコア = 重大度 × 発生可能性 (0-100)
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                スコアを保存
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Risk Score Heatmap */}
      {riskScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              リスクスコア分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {risks.map((risk) => {
                const score = latestScoreMap.get(risk.id);
                const val = score?.final_score ?? 0;
                const heightPct = Math.max((val / 100) * 100, 4);
                return (
                  <div key={risk.id} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">{val.toFixed(0)}</span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        val >= 50
                          ? "bg-red-500"
                          : val >= 25
                            ? "bg-amber-500"
                            : val >= 10
                              ? "bg-yellow-400"
                              : "bg-green-400"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span
                      className="text-[8px] text-muted-foreground truncate max-w-full text-center"
                      title={risk.title}
                    >
                      {risk.title.length > 8 ? risk.title.slice(0, 8) + "\u2026" : risk.title}
                    </span>
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
