import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createAdminClient } from "@/lib/db/admin";
import { canEdit } from "@/lib/auth/roles";
import { analyzeDdsGaps } from "@/lib/domain/eudr-export";
import {
  DDS_STATUS_LABELS,
  OPERATOR_TYPE_LABELS,
  EUDR_COMMODITY_TYPE_LABELS,
  EUDR_RISK_RESULT_LABELS,
  GEOLOCATION_TYPE_LABELS,
  COUNTRY_RISK_TIER_LABELS,
  label,
} from "@/lib/labels";
import { DdsActions } from "./dds-actions";
import { AddPlotForm } from "./add-plot-form";
import {
  FileText,
  MapPin,
  ShieldCheck,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Package,
} from "lucide-react";

export default async function DdsDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; ddsId: string }>;
}) {
  const { workspaceSlug, ddsId } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);
  if (!ctx) notFound();

  const admin = createAdminClient();

  // Fetch DDS with operator
  const { data: dds } = await admin
    .from("eudr_dds_statements")
    .select(
      `
      *,
      operator_org:organizations!operator_org_id (id, display_name, legal_name)
    `
    )
    .eq("id", ddsId)
    .eq("workspace_id", ctx.workspace.id)
    .is("deleted_at", null)
    .single();

  if (!dds) notFound();

  // Fetch product lines
  const { data: productLines } = await admin
    .from("eudr_dds_product_lines")
    .select("*")
    .eq("dds_id", ddsId)
    .order("created_at");

  const plIds = (productLines ?? []).map((pl) => pl.id);

  // Fetch plots
  const { data: plots } = await admin
    .from("eudr_dds_plots")
    .select("*")
    .in("product_line_id", plIds.length > 0 ? plIds : ["_none_"])
    .order("created_at");

  // Fetch upstream refs
  const { data: upstreamRefs } = await admin
    .from("eudr_dds_upstream_refs")
    .select("*")
    .eq("dds_id", ddsId)
    .order("created_at");

  // Fetch risk assessment
  const { data: riskAssessment } = await admin
    .from("eudr_risk_assessments")
    .select("*")
    .eq("dds_id", ddsId)
    .single();

  let riskCriteria: Record<string, unknown>[] = [];
  if (riskAssessment) {
    const { data } = await admin
      .from("eudr_risk_criteria")
      .select("*")
      .eq("risk_assessment_id", riskAssessment.id)
      .order("criterion_key");
    riskCriteria = data ?? [];
  }

  // Fetch evidence links
  const { data: evidenceLinks } = await admin
    .from("evidence_links")
    .select(
      `
      *,
      evidence_item:evidence_items (id, file_name, evidence_type, mime_type)
    `
    )
    .eq("target_type", "dds_statement")
    .eq("target_id", ddsId);

  // Fetch sites for plot linking
  const { data: workspaceSites } = await admin
    .from("workspace_sites")
    .select("site_id, sites!inner ( id, site_name )")
    .eq("workspace_id", ctx.workspace.id);

  const siteOptions = (workspaceSites ?? []).map((ws) => {
    const site = ws.sites as unknown as { id: string; site_name: string };
    return { id: site.id, name: site.site_name };
  });

  // Gap analysis
  const gaps = await analyzeDdsGaps(ddsId);

  const org = dds.operator_org as unknown as {
    id: string;
    display_name: string;
    legal_name: string | null;
  } | null;

  const editable = canEdit(ctx.membership.role);
  const _base = `/app/${workspaceSlug}/eudr`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {dds.internal_reference}
            </h1>
            <StatusBadge status={dds.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {org?.display_name ?? "—"} ·{" "}
            {label(OPERATOR_TYPE_LABELS, dds.operator_type)} ·{" "}
            作成: {new Date(dds.created_at).toLocaleDateString("ja-JP")}
          </p>
        </div>
        {editable && (
          <DdsActions
            workspaceSlug={workspaceSlug}
            ddsId={ddsId}
            currentStatus={dds.status}
            isReady={gaps.is_ready}
          />
        )}
      </div>

      {/* Gap Analysis Banner */}
      {!gaps.is_ready && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
            <div>
              <h3 className="font-medium text-yellow-800">
                提出準備が完了していません
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-yellow-700">
                {gaps.gaps.map((g, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {g.severity === "error" ? (
                      <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                    )}
                    {g.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* DDS Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border p-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            基本情報
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">オペレーター</dt>
              <dd className="font-medium">{org?.display_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">法人名</dt>
              <dd>{org?.legal_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">タイプ</dt>
              <dd>{label(OPERATOR_TYPE_LABELS, dds.operator_type)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">活動国</dt>
              <dd>{dds.country_of_activity ?? "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            EU 提出情報
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">EU 参照番号</dt>
              <dd>{dds.eu_reference_number ?? "未提出"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">EU 検証番号</dt>
              <dd>{dds.eu_verification_number ?? "未提出"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">提出日</dt>
              <dd>
                {dds.submission_date
                  ? new Date(dds.submission_date).toLocaleDateString("ja-JP")
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            サマリー
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">製品明細</dt>
              <dd className="font-medium">
                {(productLines ?? []).length} 件
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">生産区画</dt>
              <dd className="font-medium">{(plots ?? []).length} 件</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">上流参照</dt>
              <dd className="font-medium">
                {(upstreamRefs ?? []).length} 件
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">リスク評価</dt>
              <dd>
                {riskAssessment ? (
                  <RiskBadge result={riskAssessment.overall_result as string} />
                ) : (
                  "未実施"
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Product Lines */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          <Package className="mr-2 inline-block h-5 w-5" />
          製品明細
        </h2>
        {(productLines ?? []).length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            製品明細がまだ登録されていません
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">
                    コモディティ
                  </th>
                  <th className="px-4 py-2 text-left font-medium">CN コード</th>
                  <th className="px-4 py-2 text-left font-medium">製品説明</th>
                  <th className="px-4 py-2 text-left font-medium">生産国</th>
                  <th className="px-4 py-2 text-right font-medium">数量(kg)</th>
                  <th className="px-4 py-2 text-right font-medium">区画数</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(productLines ?? []).map((pl) => {
                  const plPlots = (plots ?? []).filter(
                    (p) => p.product_line_id === pl.id
                  );
                  return (
                    <tr key={pl.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {label(
                            EUDR_COMMODITY_TYPE_LABELS,
                            pl.commodity_type as string
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {pl.cn_code as string}
                      </td>
                      <td className="px-4 py-2">
                        {pl.product_description as string}
                      </td>
                      <td className="px-4 py-2">
                        {pl.country_of_production as string}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {pl.quantity_kg
                          ? Number(pl.quantity_kg).toLocaleString("ja-JP")
                          : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {plPlots.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Plots */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          <MapPin className="mr-2 inline-block h-5 w-5" />
          生産区画
        </h2>
        {(plots ?? []).length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            生産区画がまだ登録されていません
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">参照</th>
                  <th className="px-4 py-2 text-left font-medium">タイプ</th>
                  <th className="px-4 py-2 text-left font-medium">緯度/経度</th>
                  <th className="px-4 py-2 text-left font-medium">面積(ha)</th>
                  <th className="px-4 py-2 text-left font-medium">生産国</th>
                  <th className="px-4 py-2 text-left font-medium">生産期間</th>
                  <th className="px-4 py-2 text-left font-medium">
                    森林破壊フリー
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(plots ?? []).map((p) => (
                  <tr key={p.id as string} className="hover:bg-muted/30">
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
                      {p.area_ha ? Number(p.area_ha).toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {p.country_of_production as string}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {p.production_start_date && p.production_end_date
                        ? `${p.production_start_date as string} ~ ${p.production_end_date as string}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {p.deforestation_free === true ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : p.deforestation_free === false ? (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Plot Form */}
      {editable && dds.status === "draft" && (productLines ?? []).length > 0 && (
        <AddPlotForm
          workspaceSlug={workspaceSlug}
          productLines={(productLines ?? []).map((pl) => ({
            id: pl.id as string,
            cnCode: pl.cn_code as string,
            commodityType: pl.commodity_type as string,
            countryOfProduction: pl.country_of_production as string,
          }))}
          sites={siteOptions}
        />
      )}

      {/* Risk Assessment */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          <ShieldCheck className="mr-2 inline-block h-5 w-5" />
          リスク評価
        </h2>
        {!riskAssessment ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            リスク評価がまだ実施されていません
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-lg border p-4">
              <div>
                <p className="text-xs text-muted-foreground">全体結果</p>
                <RiskBadge
                  result={riskAssessment.overall_result as string}
                  large
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">国リスクレベル</p>
                <p className="font-medium">
                  {riskAssessment.country_risk_level
                    ? label(
                        COUNTRY_RISK_TIER_LABELS,
                        riskAssessment.country_risk_level as string
                      )
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">評価日</p>
                <p className="font-medium">
                  {riskAssessment.assessed_at
                    ? new Date(
                        riskAssessment.assessed_at as string
                      ).toLocaleDateString("ja-JP")
                    : "—"}
                </p>
              </div>
            </div>

            {riskCriteria.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">基準</th>
                      <th className="px-4 py-2 text-left font-medium">説明</th>
                      <th className="px-4 py-2 text-center font-medium">
                        自動スコア
                      </th>
                      <th className="px-4 py-2 text-center font-medium">
                        手動オーバーライド
                      </th>
                      <th className="px-4 py-2 text-center font-medium">
                        最終スコア
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {riskCriteria.map((c) => (
                      <tr
                        key={c.id as string}
                        className="hover:bg-muted/30"
                      >
                        <td className="px-4 py-2 font-mono text-xs">
                          ({c.criterion_key as string})
                        </td>
                        <td className="px-4 py-2">
                          {c.criterion_label as string}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <ScoreBadge score={c.auto_score as string | null} />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <ScoreBadge
                            score={c.manual_override as string | null}
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <ScoreBadge
                            score={c.final_score as string | null}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Upstream References */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          <ArrowUpRight className="mr-2 inline-block h-5 w-5" />
          上流 DDS 参照
        </h2>
        {(upstreamRefs ?? []).length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            上流 DDS 参照がまだ登録されていません
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">参照番号</th>
                  <th className="px-4 py-2 text-left font-medium">検証番号</th>
                  <th className="px-4 py-2 text-left font-medium">
                    上流オペレーター
                  </th>
                  <th className="px-4 py-2 text-left font-medium">国</th>
                  <th className="px-4 py-2 text-left font-medium">TRACES</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(upstreamRefs ?? []).map((r) => (
                  <tr key={r.id as string} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.reference_number as string}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {(r.verification_number as string) || "—"}
                    </td>
                    <td className="px-4 py-2">
                      {(r.upstream_operator_name as string) || "—"}
                    </td>
                    <td className="px-4 py-2">
                      {(r.upstream_country as string) || "—"}
                    </td>
                    <td className="px-4 py-2">
                      {r.verified_in_traces ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Evidence */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          <FileText className="mr-2 inline-block h-5 w-5" />
          証憑
        </h2>
        {(evidenceLinks ?? []).length === 0 ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            証憑がまだ紐づけられていません。証憑ページから DDS に紐づけてください。
          </div>
        ) : (
          <div className="space-y-2">
            {(evidenceLinks ?? []).map((link) => {
              const item = link.evidence_item as unknown as {
                id: string;
                file_name: string;
                evidence_type: string;
                mime_type: string;
              } | null;
              return (
                <div
                  key={link.id as string}
                  className="flex items-center gap-3 rounded-lg border px-4 py-2"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {item?.file_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item?.evidence_type ?? "—"}
                    </p>
                  </div>
                  {link.note && (
                    <p className="text-xs text-muted-foreground">
                      {link.note as string}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
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

function RiskBadge({
  result,
  large,
}: {
  result: string;
  large?: boolean;
}) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600",
    negligible: "bg-green-100 text-green-700",
    non_negligible: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colors[result] ?? "bg-gray-100"} ${large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
    >
      {label(EUDR_RISK_RESULT_LABELS, result)}
    </span>
  );
}

function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return <span className="text-muted-foreground">—</span>;
  const colors: Record<string, string> = {
    low: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[score] ?? "bg-gray-100"}`}
    >
      {labels[score] ?? score}
    </span>
  );
}
