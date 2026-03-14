"use client";

import { useState, useTransition } from "react";
import {
  createMonitoringRule,
  toggleMonitoringRule,
  updateEventStatus,
  deleteMonitoringRule,
} from "@/lib/domain/monitor-actions";
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
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  EyeOff,
  XCircle,
  Activity,
  RefreshCw,
  Shield,
  Trash2,
  Power,
  PowerOff,
  Globe,
  TreePine,
} from "lucide-react";
import type { MonitoringRuleRow, MonitoringEventRow } from "./page";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const SEVERITY_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  critical: {
    icon: <AlertCircle className="h-4 w-4" />,
    color: "text-red-600",
    bg: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    color: "text-amber-600",
    bg: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    color: "text-blue-600",
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
};

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string }> =
  {
    open: {
      icon: <Bell className="h-3.5 w-3.5" />,
      color:
        "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    },
    acknowledged: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    },
    resolved: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      color:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    },
    ignored: {
      icon: <EyeOff className="h-3.5 w-3.5" />,
      color:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
  };

const RULE_TYPE_LABEL: Record<string, string> = {
  source_refresh: "ソース更新",
  threshold: "閾値アラート",
  missing_evidence: "証憑欠損",
  review_due: "レビュー期限",
  benchmark_change: "国ベンチマーク変更",
  eudr_risk_review: "EUDR リスクレビュー",
};

const RULE_TYPE_ICON: Record<string, React.ReactNode> = {
  source_refresh: <RefreshCw className="h-3.5 w-3.5" />,
  threshold: <Shield className="h-3.5 w-3.5" />,
  missing_evidence: <AlertTriangle className="h-3.5 w-3.5" />,
  review_due: <Activity className="h-3.5 w-3.5" />,
  benchmark_change: <Globe className="h-3.5 w-3.5" />,
  eudr_risk_review: <TreePine className="h-3.5 w-3.5" />,
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

type Props = {
  workspaceSlug: string;
  rules: MonitoringRuleRow[];
  events: MonitoringEventRow[];
  orgOptions: { id: string; name: string }[];
  siteOptions: { id: string; name: string }[];
  canEdit?: boolean;
};

export function MonitorDashboard({
  workspaceSlug,
  rules,
  events,
  orgOptions,
  siteOptions,
  canEdit = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [ruleOpen, setRuleOpen] = useState(false);
  const [selectedRuleType, setSelectedRuleType] = useState("source_refresh");
  const [error, setError] = useState<string | null>(null);

  // Summary stats
  const openEvents = events.filter((e) => e.status === "open").length;
  const criticalEvents = events.filter(
    (e) => e.severity === "critical" && e.status === "open"
  ).length;
  const activeRules = rules.filter((r) => r.is_active).length;

  function handleCreateRule(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createMonitoringRule(workspaceSlug, formData);
      if (res.error) setError(res.error);
      else setRuleOpen(false);
    });
  }

  function handleToggleRule(ruleId: string, isActive: boolean) {
    startTransition(async () => {
      await toggleMonitoringRule(workspaceSlug, ruleId, isActive);
    });
  }

  function handleDeleteRule(ruleId: string) {
    startTransition(async () => {
      await deleteMonitoringRule(workspaceSlug, ruleId);
    });
  }

  function handleEventStatus(eventId: string, status: string) {
    startTransition(async () => {
      await updateEventStatus(workspaceSlug, eventId, status);
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900">
              <Bell className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openEvents}</p>
              <p className="text-xs text-muted-foreground">未対応アラート</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{criticalEvents}</p>
              <p className="text-xs text-muted-foreground">重大</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeRules}</p>
              <p className="text-xs text-muted-foreground">有効ルール</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" />
            モニタリングイベント
          </CardTitle>
          <CardDescription>
            モニタリングルールによってトリガーされたアラート
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              モニタリングイベントがまだありません。定期チェック時にルールが問題を検出するとここに表示されます。
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const severity =
                  SEVERITY_CONFIG[event.severity] ?? SEVERITY_CONFIG.info;
                const status =
                  STATUS_CONFIG[event.status] ?? STATUS_CONFIG.open;

                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 rounded-md border p-3"
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${severity.bg}`}
                    >
                      {severity.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${severity.bg}`}
                        >
                          {event.severity}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${status.color}`}
                        >
                          <span className="mr-1">{status.icon}</span>
                          {event.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(event.triggered_at)}
                        </span>
                      </div>
                    </div>
                    {canEdit && event.status === "open" && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={isPending}
                          onClick={() =>
                            handleEventStatus(event.id, "acknowledged")
                          }
                        >
                          確認
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          disabled={isPending}
                          onClick={() =>
                            handleEventStatus(event.id, "resolved")
                          }
                        >
                          解決
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground"
                          disabled={isPending}
                          onClick={() =>
                            handleEventStatus(event.id, "ignored")
                          }
                        >
                          無視
                        </Button>
                      </div>
                    )}
                    {canEdit && event.status === "acknowledged" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs shrink-0"
                        disabled={isPending}
                        onClick={() =>
                          handleEventStatus(event.id, "resolved")
                        }
                      >
                        解決
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4" />
                モニタリングルール
              </CardTitle>
              <CardDescription>
                定期的に実行される自動チェック
              </CardDescription>
            </div>
            {canEdit && (
              <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    ルール追加
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>モニタリングルールを作成</DialogTitle>
                  </DialogHeader>
                  <form action={handleCreateRule} className="space-y-4">
                    <div className="space-y-2">
                      <Label>ルール種別</Label>
                      <select
                        name="ruleType"
                        required
                        className={selectCn}
                        value={selectedRuleType}
                        onChange={(e) => setSelectedRuleType(e.target.value)}
                      >
                        <option value="source_refresh">ソース更新</option>
                        <option value="threshold">閾値アラート</option>
                        <option value="missing_evidence">
                          証憑欠損
                        </option>
                        <option value="review_due">レビュー期限</option>
                        <option value="benchmark_change">
                          国ベンチマーク変更（EUDR）
                        </option>
                        <option value="eudr_risk_review">
                          EUDR リスクレビュー
                        </option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>対象タイプ</Label>
                      <select
                        name="targetType"
                        defaultValue="site"
                        className={selectCn}
                      >
                        <option value="site">サイト</option>
                        <option value="organization">組織</option>
                        <option value="material">素材</option>
                        <option value="relationship">サプライ関係</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>対象</Label>
                      <select name="targetId" required className={selectCn}>
                        <option value="">対象を選択...</option>
                        <optgroup label="サイト">
                          {siteOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="組織">
                          {orgOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>

                    {/* Dynamic config fields */}
                    {selectedRuleType === "source_refresh" && (
                      <div className="space-y-2">
                        <Label>
                          最大経過日数{" "}
                          <span className="text-muted-foreground">
                            — ソースが更新されない場合にトリガー
                          </span>
                        </Label>
                        <Input
                          name="maxAgeDays"
                          type="number"
                          defaultValue={30}
                          min={1}
                          max={365}
                        />
                      </div>
                    )}
                    {selectedRuleType === "threshold" && (
                      <div className="space-y-2">
                        <Label>
                          リスクスコア閾値{" "}
                          <span className="text-muted-foreground">(0-100)</span>
                        </Label>
                        <Input
                          name="threshold"
                          type="number"
                          defaultValue={50}
                          min={0}
                          max={100}
                        />
                      </div>
                    )}
                    {selectedRuleType === "missing_evidence" && (
                      <div className="space-y-2">
                        <Label>
                          陳腐化日数{" "}
                          <span className="text-muted-foreground">
                            — 証憑の更新がない場合にトリガー
                          </span>
                        </Label>
                        <Input
                          name="staleDays"
                          type="number"
                          defaultValue={90}
                          min={1}
                          max={365}
                        />
                      </div>
                    )}
                    {selectedRuleType === "review_due" && (
                      <div className="space-y-2">
                        <Label>
                          レビュー間隔（日）{" "}
                          <span className="text-muted-foreground">
                            — リスクの再スコアリングがない場合にトリガー
                          </span>
                        </Label>
                        <Input
                          name="reviewDays"
                          type="number"
                          defaultValue={60}
                          min={1}
                          max={365}
                        />
                      </div>
                    )}
                    {selectedRuleType === "benchmark_change" && (
                      <div className="space-y-2">
                        <Label>
                          監視対象国コード（カンマ区切り、空欄＝全国）{" "}
                          <span className="text-muted-foreground">
                            — 国ベンチマーク変更時にトリガー
                          </span>
                        </Label>
                        <Input
                          name="countryCodes"
                          placeholder="例: BR,ID,CM（空欄で全国監視）"
                        />
                      </div>
                    )}
                    {selectedRuleType === "eudr_risk_review" && (
                      <div className="space-y-2">
                        <Label>
                          レビュー間隔（日）{" "}
                          <span className="text-muted-foreground">
                            — EUDR リスク評価が再評価されていない場合にトリガー
                          </span>
                        </Label>
                        <Input
                          name="reviewDays"
                          type="number"
                          defaultValue={30}
                          min={1}
                          max={365}
                        />
                      </div>
                    )}

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" disabled={isPending} className="w-full">
                      {isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      ルールを作成
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              モニタリングルールが設定されていません。ルールを追加して、データソースの陳腐化、証憑の欠損、リスクレビュー期限を自動チェックしましょう。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>ルール種別</TableHead>
                  <TableHead>対象</TableHead>
                  <TableHead>設定</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>最終実行</TableHead>
                  {canEdit && <TableHead>操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => {
                  const eventCount = events.filter(
                    (e) =>
                      e.monitoring_rule_id === rule.id &&
                      e.status === "open"
                  ).length;
                  return (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {RULE_TYPE_ICON[rule.rule_type]}
                          <span className="text-sm font-medium">
                            {RULE_TYPE_LABEL[rule.rule_type] ??
                              rule.rule_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {rule.target_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {configSummary(rule)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={rule.is_active ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {rule.is_active ? "有効" : "無効"}
                          </Badge>
                          {eventCount > 0 && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                            >
                              {eventCount}件未対応
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rule.last_run_at
                          ? formatRelativeTime(rule.last_run_at)
                          : "未実行"}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              disabled={isPending}
                              onClick={() =>
                                handleToggleRule(rule.id, !rule.is_active)
                              }
                              title={
                                rule.is_active ? "無効化" : "有効化"
                              }
                            >
                              {rule.is_active ? (
                                <PowerOff className="h-3.5 w-3.5" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                              disabled={isPending}
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
    </div>
  );
}

function configSummary(rule: MonitoringRuleRow): string {
  const config = rule.config as Record<string, unknown>;
  switch (rule.rule_type) {
    case "source_refresh":
      return `最大経過: ${(config.max_age_days as number) ?? 30}日`;
    case "threshold":
      return `スコア ≥ ${(config.threshold as number) ?? 50}`;
    case "missing_evidence":
      return `陳腐化: ${(config.stale_days as number) ?? 90}日`;
    case "review_due":
      return `レビュー間隔: ${(config.review_days as number) ?? 60}日`;
    case "benchmark_change": {
      const codes = config.country_codes as string[] | undefined;
      return codes && codes.length > 0
        ? `対象国: ${codes.join(", ")}`
        : "全国監視";
    }
    case "eudr_risk_review":
      return `レビュー間隔: ${(config.review_days as number) ?? 30}日`;
    default:
      return "";
  }
}
