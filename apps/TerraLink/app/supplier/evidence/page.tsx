import { redirect } from "next/navigation";
import { getSupplierContext } from "@/lib/auth/supplier-context";
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
} from "lucide-react";

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

const VISIBILITY_LABEL: Record<string, string> = {
  workspace_private: "ワークスペース限定",
  shared_to_buyers: "バイヤーに共有",
  org_private: "組織限定",
};

const VISIBILITY_COLOR: Record<string, string> = {
  workspace_private:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  shared_to_buyers:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  org_private:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mime: string) {
  if (mime.startsWith("image/"))
    return <Image className="h-4 w-4 text-pink-500" />;
  if (mime === "application/pdf")
    return <FileText className="h-4 w-4 text-red-500" />;
  if (
    mime.includes("spreadsheet") ||
    mime.includes("csv") ||
    mime.includes("excel")
  )
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  return <File className="h-4 w-4 text-slate-500" />;
}

export default async function SupplierEvidencePage() {
  const ctx = await getSupplierContext();
  if (!ctx) redirect("/login");

  const admin = createAdminClient();

  const { data: evidenceItems } = await admin
    .from("evidence_items")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  type EvidenceRow = {
    id: string;
    file_name: string;
    mime_type: string;
    file_size_bytes: number;
    evidence_type: string;
    visibility: string;
    created_at: string;
  };

  const items = (evidenceItems ?? []) as EvidenceRow[];
  const totalSize = items.reduce((sum, e) => sum + (e.file_size_bytes ?? 0), 0);
  const sharedCount = items.filter(
    (e) => e.visibility === "shared_to_buyers"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="証憑管理"
        description="バイヤーと共有する証憑ドキュメントを管理"
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900">
              <FileCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{items.length}</p>
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

      {/* Evidence Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">証憑ライブラリ</CardTitle>
          <CardDescription>
            組織に関連付けられた証憑ドキュメント
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              証憑ファイルがまだありません。バイヤーのワークスペースからドキュメントをアップロードしてください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>ファイル</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>公開範囲</TableHead>
                  <TableHead>サイズ</TableHead>
                  <TableHead>アップロード日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
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
                        className={`text-[10px] ${VISIBILITY_COLOR[item.visibility] ?? ""}`}
                      >
                        {VISIBILITY_LABEL[item.visibility] ?? item.visibility}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatBytes(item.file_size_bytes)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString("ja-JP", {
                        month: "short",
                        day: "numeric",
                      })}
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
