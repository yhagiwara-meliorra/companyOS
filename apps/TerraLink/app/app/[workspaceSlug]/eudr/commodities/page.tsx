import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { EUDR_COMMODITY_TYPE_LABELS, label } from "@/lib/labels";

export default async function CommoditiesPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();
  const { data: codes } = await admin
    .from("eudr_commodity_codes")
    .select("*")
    .eq("is_active", true)
    .order("commodity_type")
    .order("cn_code");

  const items = codes ?? [];

  // Group by commodity type
  const grouped: Record<string, typeof items> = {};
  for (const item of items) {
    const ct = item.commodity_type as string;
    if (!grouped[ct]) grouped[ct] = [];
    grouped[ct].push(item);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          コモディティコード
        </h1>
        <p className="text-sm text-muted-foreground">
          EUDR Annex I 対象の CN/HS コード一覧（読み取り専用）
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(EUDR_COMMODITY_TYPE_LABELS).map(([key, ja]) => (
          <div key={key} className="rounded-lg border bg-background p-4">
            <p className="text-xs text-muted-foreground">コモディティ</p>
            <p className="text-lg font-bold">{ja}</p>
            <p className="text-xs text-muted-foreground">
              {grouped[key]?.length ?? 0} コード
            </p>
          </div>
        ))}
      </div>

      {Object.entries(grouped).map(([ct, codes]) => (
        <section key={ct}>
          <h2 className="mb-3 text-lg font-semibold">
            {label(EUDR_COMMODITY_TYPE_LABELS, ct)}
          </h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">
                    CN コード
                  </th>
                  <th className="px-4 py-2 text-left font-medium">
                    HS コード
                  </th>
                  <th className="px-4 py-2 text-left font-medium">説明</th>
                  <th className="px-4 py-2 text-left font-medium">年度</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {codes.map((c) => (
                  <tr key={c.id as string} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs font-medium">
                      {c.cn_code as string}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {(c.hs_code as string) ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      {c.description as string}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {c.cn_year as number}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
