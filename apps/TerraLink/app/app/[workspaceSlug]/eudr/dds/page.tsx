import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { canEdit } from "@/lib/auth/roles";
import {
  DDS_STATUS_LABELS,
  OPERATOR_TYPE_LABELS,
  EUDR_RISK_RESULT_LABELS,
  label,
} from "@/lib/labels";
import { Plus } from "lucide-react";

export default async function DdsListPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  const { data: ddsList } = await admin
    .from("eudr_dds_statements")
    .select(
      `
      id, internal_reference, status, operator_type, country_of_activity, created_at,
      operator_org:organizations!operator_org_id (display_name),
      risk_assessment:eudr_risk_assessments (overall_result)
    `
    )
    .eq("workspace_id", ctx.workspace.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const items = ddsList ?? [];
  const base = `/app/${workspaceSlug}/eudr`;
  const editable = canEdit(ctx.membership.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DDS 一覧</h1>
          <p className="text-sm text-muted-foreground">
            デューデリジェンスステートメントの管理
          </p>
        </div>
        {editable && (
          <Link
            href={`${base}/dds/new`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            新規 DDS
          </Link>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">
            DDS がまだ作成されていません。
          </p>
          {editable && (
            <Link
              href={`${base}/dds/new`}
              className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              最初の DDS を作成
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">参照番号</th>
                <th className="px-4 py-3 text-left font-medium">
                  オペレーター
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  オペレータータイプ
                </th>
                <th className="px-4 py-3 text-left font-medium">ステータス</th>
                <th className="px-4 py-3 text-left font-medium">
                  リスク評価
                </th>
                <th className="px-4 py-3 text-left font-medium">作成日</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((d) => {
                const org = d.operator_org as unknown as {
                  display_name: string;
                } | null;
                const ra = (
                  d.risk_assessment as unknown as {
                    overall_result: string;
                  }[]
                )?.[0];
                return (
                  <tr key={d.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link
                        href={`${base}/dds/${d.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {d.internal_reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {org?.display_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {label(OPERATOR_TYPE_LABELS, d.operator_type)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3">
                      {ra ? (
                        <RiskBadge result={ra.overall_result} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}
    >
      {label(DDS_STATUS_LABELS, status)}
    </span>
  );
}

function RiskBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    negligible: "bg-green-100 text-green-700",
    non_negligible: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[result] ?? "bg-gray-100"}`}
    >
      {label(EUDR_RISK_RESULT_LABELS, result)}
    </span>
  );
}
