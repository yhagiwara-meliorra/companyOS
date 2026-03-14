import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import {
  GEOLOCATION_TYPE_LABELS,
  EUDR_COMMODITY_TYPE_LABELS,
  label,
} from "@/lib/labels";
import { MapPin, CheckCircle2, AlertCircle } from "lucide-react";

export default async function PlotsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Fetch all DDS for this workspace
  const { data: ddsList } = await admin
    .from("eudr_dds_statements")
    .select("id, internal_reference")
    .eq("workspace_id", ctx.workspace.id)
    .is("deleted_at", null);

  const ddsIds = (ddsList ?? []).map((d) => d.id);

  // Fetch all product lines
  const { data: productLines } = await admin
    .from("eudr_dds_product_lines")
    .select("id, dds_id, commodity_type, cn_code, country_of_production")
    .in("dds_id", ddsIds.length > 0 ? ddsIds : ["_none_"]);

  const plIds = (productLines ?? []).map((pl) => pl.id);

  // Fetch all plots
  const { data: plots } = await admin
    .from("eudr_dds_plots")
    .select("*")
    .in("product_line_id", plIds.length > 0 ? plIds : ["_none_"])
    .order("created_at", { ascending: false });

  const items = plots ?? [];

  // Build lookup maps
  const plMap = new Map<string, Record<string, unknown>>();
  for (const pl of productLines ?? []) {
    plMap.set(pl.id as string, pl);
  }
  const ddsMap = new Map<string, Record<string, unknown>>();
  for (const d of ddsList ?? []) {
    ddsMap.set(d.id as string, d);
  }

  // Stats
  const pointCount = items.filter(
    (p) => p.geolocation_type === "point"
  ).length;
  const polygonCount = items.filter(
    (p) => p.geolocation_type === "polygon"
  ).length;
  const withGeo = items.filter(
    (p) =>
      (p.geolocation_type === "point" &&
        p.latitude != null &&
        p.longitude != null) ||
      (p.geolocation_type === "polygon" && p.geojson != null)
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <MapPin className="mr-2 inline-block h-6 w-6" />
          生産区画
        </h1>
        <p className="text-sm text-muted-foreground">
          全 DDS に紐づく生産区画の一覧
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="合計" value={items.length} />
        <StatCard label="ポイント" value={pointCount} />
        <StatCard label="ポリゴン" value={polygonCount} />
        <StatCard
          label="ジオロケーション完了"
          value={withGeo}
          sub={`${items.length > 0 ? Math.round((withGeo / items.length) * 100) : 0}%`}
        />
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 p-12 text-center">
          <MapPin className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-muted-foreground">
            生産区画がまだ登録されていません
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">DDS</th>
                <th className="px-4 py-2 text-left font-medium">
                  コモディティ
                </th>
                <th className="px-4 py-2 text-left font-medium">参照</th>
                <th className="px-4 py-2 text-left font-medium">タイプ</th>
                <th className="px-4 py-2 text-left font-medium">座標</th>
                <th className="px-4 py-2 text-left font-medium">面積(ha)</th>
                <th className="px-4 py-2 text-left font-medium">生産国</th>
                <th className="px-4 py-2 text-left font-medium">期間</th>
                <th className="px-4 py-2 text-center font-medium">
                  森林破壊フリー
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((p) => {
                const pl = plMap.get(p.product_line_id as string);
                const dds = pl
                  ? ddsMap.get(pl.dds_id as string)
                  : null;
                return (
                  <tr key={p.id as string} className="hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs">
                      {dds
                        ? (dds.internal_reference as string)
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {pl ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {label(
                            EUDR_COMMODITY_TYPE_LABELS,
                            pl.commodity_type as string
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {(p.plot_reference as string) ||
                        (p.id as string).slice(0, 8)}
                    </td>
                    <td className="px-4 py-2">
                      {label(
                        GEOLOCATION_TYPE_LABELS,
                        p.geolocation_type as string
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {p.latitude != null && p.longitude != null
                        ? `${Number(p.latitude).toFixed(4)}, ${Number(p.longitude).toFixed(4)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {p.area_ha
                        ? Number(p.area_ha).toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {p.country_of_production as string}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {p.production_start_date && p.production_end_date
                        ? `${p.production_start_date as string} ~ ${p.production_end_date as string}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.deforestation_free === true ? (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-green-600" />
                      ) : p.deforestation_free === false ? (
                        <AlertCircle className="mx-auto h-4 w-4 text-red-600" />
                      ) : (
                        "—"
                      )}
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

function StatCard({
  label: l,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{l}</p>
      <p className="text-2xl font-bold">
        {value}
        {sub && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </p>
    </div>
  );
}
