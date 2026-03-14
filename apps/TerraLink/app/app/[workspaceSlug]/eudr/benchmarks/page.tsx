import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { COUNTRY_RISK_TIER_LABELS, label } from "@/lib/labels";

export default async function BenchmarksPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();
  const { data: benchmarks } = await admin
    .from("eudr_country_benchmarks")
    .select("*")
    .is("superseded_at", null)
    .order("risk_tier")
    .order("country_name");

  const items = benchmarks ?? [];

  // Group by risk tier
  const grouped: Record<string, typeof items> = {
    high: [],
    standard: [],
    low: [],
  };
  for (const item of items) {
    const tier = item.risk_tier as string;
    if (!grouped[tier]) grouped[tier] = [];
    grouped[tier].push(item);
  }

  const tierColors: Record<string, string> = {
    high: "border-red-200 bg-red-50",
    standard: "border-yellow-200 bg-yellow-50",
    low: "border-green-200 bg-green-50",
  };

  const countColors: Record<string, string> = {
    high: "text-red-700",
    standard: "text-yellow-700",
    low: "text-green-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          国別リスク分類
        </h1>
        <p className="text-sm text-muted-foreground">
          EUDR に基づく国別のリスクベンチマーク（読み取り専用）
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["high", "standard", "low"] as const).map((tier) => (
          <div
            key={tier}
            className={`rounded-lg border p-4 ${tierColors[tier]}`}
          >
            <p className={`text-2xl font-bold ${countColors[tier]}`}>
              {grouped[tier]?.length ?? 0}
            </p>
            <p className="text-sm font-medium">
              {label(COUNTRY_RISK_TIER_LABELS, tier)}
            </p>
          </div>
        ))}
      </div>

      {/* Full Table */}
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">国コード</th>
              <th className="px-4 py-3 text-left font-medium">国名</th>
              <th className="px-4 py-3 text-left font-medium">リスク分類</th>
              <th className="px-4 py-3 text-left font-medium">
                コモディティ限定
              </th>
              <th className="px-4 py-3 text-left font-medium">発効日</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((b) => (
              <tr key={b.id as string} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs font-medium">
                  {b.country_code as string}
                </td>
                <td className="px-4 py-2">{b.country_name as string}</td>
                <td className="px-4 py-2">
                  <RiskTierBadge tier={b.risk_tier as string} />
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {(b.commodity_type as string) || "全コモディティ"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {b.effective_date
                    ? new Date(
                        b.effective_date as string
                      ).toLocaleDateString("ja-JP")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskTierBadge({ tier }: { tier: string }) {
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
