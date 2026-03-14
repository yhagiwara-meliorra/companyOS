import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import {
  EUDR_RISK_RESULT_LABELS,
  COUNTRY_RISK_TIER_LABELS,
  label,
} from "@/lib/labels";
import { ShieldCheck } from "lucide-react";

export default async function AssessmentsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Fetch all risk assessments with DDS info
  const { data: assessments } = await admin
    .from("eudr_risk_assessments")
    .select(
      `
      id, dds_id, overall_result, country_risk_level, status, assessed_at, created_at,
      dds:eudr_dds_statements!dds_id (
        id, internal_reference, status,
        operator_org:organizations!operator_org_id (display_name)
      )
    `
    )
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false });

  const items = assessments ?? [];
  const base = `/app/${workspaceSlug}/eudr`;

  // Stats
  const negligibleCount = items.filter(
    (a) => a.overall_result === "negligible"
  ).length;
  const nonNegligibleCount = items.filter(
    (a) => a.overall_result === "non_negligible"
  ).length;
  const pendingCount = items.filter(
    (a) => a.overall_result === "pending"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <ShieldCheck className="mr-2 inline-block h-6 w-6" />
          リスク評価
        </h1>
        <p className="text-sm text-muted-foreground">
          DDS ごとのリスク評価結果一覧
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">合計</p>
          <p className="text-2xl font-bold">{items.length}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs text-green-600">無視可能</p>
          <p className="text-2xl font-bold text-green-700">
            {negligibleCount}
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-600">無視不可</p>
          <p className="text-2xl font-bold text-red-700">
            {nonNegligibleCount}
          </p>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs text-muted-foreground">未評価</p>
          <p className="text-2xl font-bold">{pendingCount}</p>
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">
            リスク評価がまだ実施されていません
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">DDS</th>
                <th className="px-4 py-3 text-left font-medium">
                  オペレーター
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  全体結果
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  国リスク
                </th>
                <th className="px-4 py-3 text-left font-medium">ステータス</th>
                <th className="px-4 py-3 text-left font-medium">評価日</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((a) => {
                const dds = a.dds as unknown as {
                  id: string;
                  internal_reference: string;
                  status: string;
                  operator_org: { display_name: string } | null;
                } | null;
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {dds ? (
                        <Link
                          href={`${base}/dds/${dds.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {dds.internal_reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {dds?.operator_org?.display_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RiskBadge result={a.overall_result} />
                    </td>
                    <td className="px-4 py-3">
                      {a.country_risk_level ? (
                        <TierBadge tier={a.country_risk_level} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.status}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.assessed_at
                        ? new Date(a.assessed_at).toLocaleDateString("ja-JP")
                        : "—"}
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

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    high: "bg-red-100 text-red-700",
    standard: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] ?? "bg-gray-100"}`}
    >
      {label(COUNTRY_RISK_TIER_LABELS, tier)}
    </span>
  );
}
