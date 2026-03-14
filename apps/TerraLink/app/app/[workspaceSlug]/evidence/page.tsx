import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { PageHeader } from "@/components/page-header";
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
import {
  FileCheck,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Clock,
} from "lucide-react";
import { EvidenceUploadForm } from "./evidence-upload-form";
import { EvidenceActions } from "./evidence-actions-client";
import { AuditLog } from "./audit-log";
import { canEdit, canUpload } from "@/lib/auth/roles";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  invoice: "請求書",
  certificate: "証明書",
  survey: "調査",
  report: "レポート",
  map: "地図",
  contract: "契約書",
  screenshot: "スクリーンショット",
  other: "その他",
};

const VISIBILITY_STYLE: Record<string, string> = {
  workspace_private:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  shared_to_buyers:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  org_private:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

function mimeIcon(mime: string) {
  if (mime.startsWith("image/"))
    return <Image className="h-4 w-4 text-pink-500" />;
  if (mime === "application/pdf")
    return <FileText className="h-4 w-4 text-red-500" />;
  if (mime.includes("spreadsheet") || mime.includes("csv") || mime.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  return <File className="h-4 w-4 text-slate-500" />;
}

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Load evidence items
  const { data: evidenceItems } = await admin
    .from("evidence_items")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Load evidence links for all items
  const evidenceIds = (evidenceItems ?? []).map((e) => e.id);
  const linksByEvidence: Record<string, LinkRow[]> = {};
  if (evidenceIds.length > 0) {
    const { data: links } = await admin
      .from("evidence_links")
      .select("*")
      .in("evidence_item_id", evidenceIds);
    (links ?? []).forEach((link) => {
      const list = linksByEvidence[link.evidence_item_id] ?? [];
      list.push(link as LinkRow);
      linksByEvidence[link.evidence_item_id] = list;
    });
  }

  // Load recent audit log entries
  const { data: auditEntries } = await admin
    .from("change_log")
    .select("*")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(30);

  // Load orgs and sites for upload form selectors
  const { data: wsOrgs } = await admin
    .from("workspace_organizations")
    .select("organization_id, organizations ( id, display_name )")
    .eq("workspace_id", ctx.workspace.id);

  const { data: wsSites } = await admin
    .from("workspace_sites")
    .select("site_id, sites ( id, site_name )")
    .eq("workspace_id", ctx.workspace.id);

  const orgOptions = (wsOrgs ?? []).map((wo) => {
    const org = wo.organizations as unknown as { id: string; display_name: string };
    return { id: org?.id ?? "", name: org?.display_name ?? "Unknown" };
  }).filter((o) => o.id);

  const siteOptions = (wsSites ?? []).map((ws) => {
    const site = ws.sites as unknown as { id: string; site_name: string };
    return { id: site?.id ?? "", name: site?.site_name ?? "Unknown" };
  }).filter((s) => s.id);

  const items = (evidenceItems ?? []) as EvidenceItemRow[];
  const canUploadEvidence = canUpload(ctx.membership.role);
  const hasEditAccess = canEdit(ctx.membership.role);

  // Summary stats
  const totalFiles = items.length;
  const totalSize = items.reduce((sum, e) => sum + (e.file_size_bytes ?? 0), 0);
  const sharedCount = items.filter(
    (e) => e.visibility === "shared_to_buyers"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="証憑"
        description="証憑ドキュメントをアップロード・管理し、サイト・組織・評価にリンク"
      />

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <FileCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalFiles}</p>
              <p className="text-xs text-muted-foreground">証憑ファイル</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900">
              <File className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
              <p className="text-xs text-muted-foreground">合計サイズ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sharedCount}</p>
              <p className="text-xs text-muted-foreground">バイヤーに共有</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Form */}
      {canUploadEvidence && (
        <EvidenceUploadForm
          workspaceSlug={workspaceSlug}
          orgOptions={orgOptions}
          siteOptions={siteOptions}
        />
      )}

      {/* Evidence Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">証憑ライブラリ</CardTitle>
          <CardDescription>
            このワークスペースにアップロードされた全証憑ドキュメント
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              証憑ファイルがまだアップロードされていません。上のフォームからドキュメントを追加してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>ファイル</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>公開範囲</TableHead>
                  <TableHead>サイズ</TableHead>
                  <TableHead>リンク</TableHead>
                  <TableHead>アップロード日</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const links = linksByEvidence[item.id] ?? [];
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {mimeIcon(item.mime_type)}
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {item.file_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {EVIDENCE_TYPE_LABEL[item.evidence_type] ??
                            item.evidence_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${VISIBILITY_STYLE[item.visibility] ?? ""}`}
                        >
                          {({
                            workspace_private: "ワークスペース限定",
                            shared_to_buyers: "バイヤーに共有",
                            org_private: "組織限定",
                          } as Record<string, string>)[item.visibility] ?? item.visibility}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatBytes(item.file_size_bytes)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {links.length > 0 ? (
                          <Badge variant="secondary" className="text-[10px]">
                            {links.length}件
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <EvidenceActions
                          workspaceSlug={workspaceSlug}
                          evidenceId={item.id}
                          storagePath={item.storage_path}
                          currentVisibility={item.visibility}
                          canEdit={hasEditAccess}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <AuditLog entries={(auditEntries ?? []) as AuditEntryRow[]} />
    </div>
  );
}

// ── Types ───────────────────────────────────────────────────

export type EvidenceItemRow = {
  id: string;
  workspace_id: string;
  organization_id: string | null;
  site_id: string | null;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  evidence_type: string;
  visibility: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LinkRow = {
  id: string;
  evidence_item_id: string;
  target_type: string;
  target_id: string;
  note: string | null;
  linked_at: string;
};

export type AuditEntryRow = {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  target_table: string;
  target_id: string;
  action: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
};
