"use client";

import { useState, useTransition } from "react";
import {
  createDisclosure,
  updateDisclosure,
  createMonitoringRule,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Loader2,
  FileText,
  Bell,
  Eye,
  CheckCircle2,
  Send,
  Pencil,
} from "lucide-react";
import type { DisclosureRow, MonitoringRuleRow } from "./page";

const selectCn =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const FRAMEWORK_COLOR: Record<string, string> = {
  tnfd: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  csrd: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  internal: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  draft: <Pencil className="h-3 w-3" />,
  review: <Eye className="h-3 w-3" />,
  approved: <CheckCircle2 className="h-3 w-3" />,
  published: <Send className="h-3 w-3" />,
};

const RULE_TYPE_LABEL: Record<string, string> = {
  source_refresh: "ソース更新",
  threshold: "閾値アラート",
  missing_evidence: "エビデンス不足",
  review_due: "レビュー期限",
};

const DISCLOSURE_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  review: "レビュー中",
  approved: "承認済み",
  published: "公開済み",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  site: "サイト",
  organization: "組織",
  material: "原材料",
  relationship: "サプライ関係",
};

// TNFD disclosure sections for manufacturing
const TNFD_SECTIONS = [
  { key: "governance-a", label: "ガバナンスA — 取締役会の監督" },
  { key: "governance-b", label: "ガバナンスB — 経営陣の役割" },
  { key: "strategy-a", label: "戦略A — 依存関係と影響" },
  { key: "strategy-b", label: "戦略B — 戦略と財務計画" },
  { key: "strategy-c", label: "戦略C — レジリエンス" },
  { key: "risk-a", label: "リスク・影響管理A — 特定" },
  { key: "risk-b", label: "リスク・影響管理B — 管理" },
  { key: "risk-c", label: "リスク・影響管理C — 統合" },
  { key: "metrics-a", label: "指標・目標A — 指標" },
  { key: "metrics-b", label: "指標・目標B — 目標" },
];

type Props = {
  workspaceSlug: string;
  assessmentId: string;
  disclosures: DisclosureRow[];
  monitoringRules: MonitoringRuleRow[];
};

export function PrepareTab({
  workspaceSlug,
  assessmentId,
  disclosures,
  monitoringRules,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [discOpen, setDiscOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editDisclosure, setEditDisclosure] = useState<DisclosureRow | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCreateDisclosure(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createDisclosure(workspaceSlug, formData);
      if (res.error) setError(res.error);
      else setDiscOpen(false);
    });
  }

  function handleUpdateDisclosure(disclosureId: string, status?: string) {
    startTransition(async () => {
      await updateDisclosure(workspaceSlug, disclosureId, editContent, status);
      setEditDisclosure(null);
    });
  }

  function handleCreateRule(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createMonitoringRule(workspaceSlug, formData);
      if (res.error) setError(res.error);
      else setRuleOpen(false);
    });
  }

  return (
    <div className="space-y-6">
      {/* Disclosure Drafts */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                開示ドラフト
              </CardTitle>
              <CardDescription>
                このアセスメントに関連するTNFD / CSRD報告セクション
              </CardDescription>
            </div>
            <Dialog open={discOpen} onOpenChange={setDiscOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  新規開示
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>開示を作成</DialogTitle>
                </DialogHeader>
                <form action={handleCreateDisclosure} className="space-y-4">
                  <input type="hidden" name="assessmentId" value={assessmentId} />
                  <div className="space-y-2">
                    <Label>フレームワーク</Label>
                    <select name="framework" defaultValue="tnfd" className={selectCn}>
                      <option value="tnfd">TNFD</option>
                      <option value="csrd">CSRD</option>
                      <option value="internal">社内用</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>セクション</Label>
                    <select name="sectionKey" required className={selectCn}>
                      <option value="">セクションを選択...</option>
                      {TNFD_SECTIONS.map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>内容 (Markdown)</Label>
                    <Textarea name="contentMd" placeholder="開示内容を記載..." rows={6} />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    作成
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {disclosures.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                開示がまだ作成されていません。TNFDまたはCSRDフレームワークに基づくレポートの作成を開始してください。
              </p>
              <div className="rounded-lg border-2 border-dashed p-4">
                <p className="text-xs font-medium mb-2">TNFD 推奨開示項目</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {TNFD_SECTIONS.map((s) => (
                    <p key={s.key} className="text-xs text-muted-foreground">{s.label}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>フレームワーク</TableHead>
                  <TableHead>セクション</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>最終更新</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disclosures.map((disc) => {
                  const sectionLabel =
                    TNFD_SECTIONS.find((s) => s.key === disc.section_key)?.label ?? disc.section_key;
                  return (
                    <TableRow key={disc.id}>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] uppercase ${FRAMEWORK_COLOR[disc.framework] ?? ""}`}
                        >
                          {disc.framework}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{sectionLabel}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${STATUS_STYLE[disc.status] ?? ""}`}
                        >
                          <span className="mr-1">{STATUS_ICON[disc.status]}</span>
                          {DISCLOSURE_STATUS_LABELS[disc.status] ?? disc.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(disc.created_at).toLocaleDateString("ja-JP")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setEditDisclosure(disc);
                            setEditContent(disc.content_md);
                          }}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          編集
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Disclosure Edit Dialog */}
      <Dialog open={!!editDisclosure} onOpenChange={(v) => !v && setEditDisclosure(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              開示を編集 —{" "}
              {TNFD_SECTIONS.find((s) => s.key === editDisclosure?.section_key)?.label ??
                editDisclosure?.section_key}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={12}
              placeholder="Markdown形式で開示内容を記載..."
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge
                  variant="secondary"
                  className={`text-[10px] uppercase ${FRAMEWORK_COLOR[editDisclosure?.framework ?? ""] ?? ""}`}
                >
                  {editDisclosure?.framework}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${STATUS_STYLE[editDisclosure?.status ?? ""] ?? ""}`}
                >
                  {DISCLOSURE_STATUS_LABELS[editDisclosure?.status ?? ""] ?? editDisclosure?.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => editDisclosure && handleUpdateDisclosure(editDisclosure.id)}
                >
                  下書き保存
                </Button>
                {editDisclosure?.status === "draft" && (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      editDisclosure && handleUpdateDisclosure(editDisclosure.id, "review")
                    }
                  >
                    レビューに提出
                  </Button>
                )}
                {editDisclosure?.status === "review" && (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      editDisclosure && handleUpdateDisclosure(editDisclosure.id, "approved")
                    }
                  >
                    承認
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Monitoring Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bell className="h-4 w-4" />
                モニタリングルール
              </CardTitle>
              <CardDescription>
                データ変更、閾値、レビューサイクルの自動アラート
              </CardDescription>
            </div>
            <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  ルールを追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>モニタリングルールを作成</DialogTitle>
                </DialogHeader>
                <form action={handleCreateRule} className="space-y-4">
                  <div className="space-y-2">
                    <Label>対象種別</Label>
                    <select name="targetType" defaultValue="site" className={selectCn}>
                      <option value="site">サイト</option>
                      <option value="organization">組織</option>
                      <option value="material">原材料</option>
                      <option value="relationship">サプライ関係</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>対象ID</Label>
                    <Input name="targetId" placeholder="対象エンティティのUUID" required />
                  </div>
                  <div className="space-y-2">
                    <Label>ルール種別</Label>
                    <select name="ruleType" required className={selectCn}>
                      <option value="">ルール種別を選択...</option>
                      <option value="source_refresh">ソース更新</option>
                      <option value="threshold">閾値アラート</option>
                      <option value="missing_evidence">エビデンス不足</option>
                      <option value="review_due">レビュー期限</option>
                    </select>
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <Button type="submit" disabled={isPending} className="w-full">
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    ルールを作成
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {monitoringRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              モニタリングルールが設定されていません。データソースの更新、リスク閾値、レビュー期限のアラートを設定してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>ルール種別</TableHead>
                  <TableHead>対象</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>作成日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitoringRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium text-sm">
                      {RULE_TYPE_LABEL[rule.rule_type] ?? rule.rule_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{TARGET_TYPE_LABELS[rule.target_type] ?? rule.target_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "default" : "secondary"} className="text-[10px]">
                        {rule.is_active ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(rule.created_at).toLocaleDateString("ja-JP")}
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
