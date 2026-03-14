"use server";

import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";
import { appendChangeLog } from "@/lib/domain/change-log";
import type {
  DdsGapAnalysis,
  DdsGapItem,
} from "@/lib/types/eudr";

type ActionState = { error?: string; success?: boolean };

// ── Helpers ─────────────────────────────────────────────────

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function resolveWorkspace(
  admin: ReturnType<typeof createAdminClient>,
  slug: string
) {
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  return ws;
}

// ── Fetch full DDS payload ──────────────────────────────────

async function fetchFullDds(
  admin: ReturnType<typeof createAdminClient>,
  ddsId: string
) {
  const { data: dds } = await admin
    .from("eudr_dds_statements")
    .select(
      `
      *,
      operator_org:organizations!operator_org_id (id, display_name, legal_name)
    `
    )
    .eq("id", ddsId)
    .is("deleted_at", null)
    .single();

  if (!dds) return null;

  const { data: productLines } = await admin
    .from("eudr_dds_product_lines")
    .select("*")
    .eq("dds_id", ddsId)
    .order("created_at");

  const plIds = (productLines ?? []).map((pl) => pl.id);

  const { data: plots } = await admin
    .from("eudr_dds_plots")
    .select("*")
    .in("product_line_id", plIds.length > 0 ? plIds : ["_none_"])
    .order("created_at");

  const { data: cattleAnimals } = await admin
    .from("eudr_dds_cattle_animals")
    .select("*")
    .in("product_line_id", plIds.length > 0 ? plIds : ["_none_"])
    .order("created_at");

  const caIds = (cattleAnimals ?? []).map((ca) => ca.id);

  const { data: cattleEstablishments } = await admin
    .from("eudr_dds_cattle_establishments")
    .select("*")
    .in("cattle_animal_id", caIds.length > 0 ? caIds : ["_none_"])
    .order("sequence_order");

  const { data: upstreamRefs } = await admin
    .from("eudr_dds_upstream_refs")
    .select("*")
    .eq("dds_id", ddsId)
    .order("created_at");

  const { data: riskAssessment } = await admin
    .from("eudr_risk_assessments")
    .select("*")
    .eq("dds_id", ddsId)
    .single();

  let riskCriteria = null;
  let riskMitigations = null;
  if (riskAssessment) {
    const { data: criteria } = await admin
      .from("eudr_risk_criteria")
      .select("*")
      .eq("risk_assessment_id", riskAssessment.id)
      .order("criterion_key");
    riskCriteria = criteria;

    const { data: mitigations } = await admin
      .from("eudr_risk_mitigations")
      .select("*")
      .eq("risk_assessment_id", riskAssessment.id)
      .order("created_at");
    riskMitigations = mitigations;
  }

  // Evidence links
  const { data: evidenceLinks } = await admin
    .from("evidence_links")
    .select(
      `
      *,
      evidence_item:evidence_items (id, file_name, evidence_type, mime_type, storage_path)
    `
    )
    .eq("target_type", "dds_statement")
    .eq("target_id", ddsId);

  return {
    dds,
    productLines: productLines ?? [],
    plots: plots ?? [],
    cattleAnimals: cattleAnimals ?? [],
    cattleEstablishments: cattleEstablishments ?? [],
    upstreamRefs: upstreamRefs ?? [],
    riskAssessment,
    riskCriteria: riskCriteria ?? [],
    riskMitigations: riskMitigations ?? [],
    evidenceLinks: evidenceLinks ?? [],
  };
}

// ── Gap Analysis ────────────────────────────────────────────

export async function analyzeDdsGaps(
  ddsId: string
): Promise<DdsGapAnalysis> {
  const admin = createAdminClient();
  const full = await fetchFullDds(admin, ddsId);

  const gaps: DdsGapItem[] = [];
  const productLineGaps: Record<string, DdsGapItem[]> = {};

  if (!full) {
    return {
      dds_id: ddsId,
      is_ready: false,
      gaps: [
        {
          field: "dds",
          label: "DDS",
          severity: "error",
          message: "DDS が見つかりません",
        },
      ],
      product_line_gaps: {},
    };
  }

  const { dds, productLines, plots, riskAssessment, upstreamRefs, evidenceLinks } = full;

  // DDS-level gaps
  if (!dds.internal_reference) {
    gaps.push({
      field: "internal_reference",
      label: "内部参照番号",
      severity: "error",
      message: "内部参照番号が設定されていません",
    });
  }

  if (productLines.length === 0) {
    gaps.push({
      field: "product_lines",
      label: "製品明細",
      severity: "error",
      message: "製品明細が登録されていません",
    });
  }

  if (!riskAssessment) {
    gaps.push({
      field: "risk_assessment",
      label: "リスク評価",
      severity: "error",
      message: "リスク評価が実施されていません",
    });
  } else if (riskAssessment.overall_result === "pending") {
    gaps.push({
      field: "risk_assessment",
      label: "リスク評価",
      severity: "warning",
      message: "リスク評価が未完了です",
    });
  } else if (riskAssessment.overall_result === "non_negligible") {
    const { data: mitigations } = await admin
      .from("eudr_risk_mitigations")
      .select("id, status")
      .eq("risk_assessment_id", riskAssessment.id);
    const allCompleted = (mitigations ?? []).every(
      (m) => m.status === "completed" || m.status === "verified"
    );
    if (!allCompleted) {
      gaps.push({
        field: "risk_mitigation",
        label: "リスク軽減",
        severity: "error",
        message:
          "リスクが無視不可と判定されましたが、軽減措置が完了していません",
      });
    }
  }

  // Evidence linking check
  if (evidenceLinks.length === 0) {
    gaps.push({
      field: "evidence_links",
      label: "証憑リンク",
      severity: "warning",
      message: "証憑が添付されていません",
    });
  }

  // Upstream ref commodity consistency check
  for (const ref of upstreamRefs) {
    if (ref.commodity_type) {
      const matchesAny = productLines.some(
        (pl) => pl.commodity_type === ref.commodity_type
      );
      if (!matchesAny) {
        gaps.push({
          field: "upstream_commodity",
          label: "上流参照コモディティ",
          severity: "warning",
          message: `上流参照 ${ref.reference_number || (ref.id as string)?.slice(0, 8)} のコモディティ (${ref.commodity_type}) が製品明細と一致しません`,
        });
      }
    }
  }

  // Product line gaps
  for (const pl of productLines) {
    const plGaps: DdsGapItem[] = [];
    const plPlots = plots.filter(
      (p) => p.product_line_id === pl.id
    );

    if (plPlots.length === 0 && pl.commodity_type !== "cattle") {
      plGaps.push({
        field: "plots",
        label: "生産区画",
        severity: "error",
        message: "生産区画が登録されていません",
      });
    }

    // Check plots
    for (const plot of plPlots) {
      if (
        plot.geolocation_type === "point" &&
        (plot.latitude == null || plot.longitude == null)
      ) {
        plGaps.push({
          field: "geolocation",
          label: "ジオロケーション",
          severity: "error",
          message: `区画 ${plot.plot_reference || plot.id.slice(0, 8)} にジオロケーションが設定されていません`,
        });
      }
      if (!plot.production_start_date || !plot.production_end_date) {
        plGaps.push({
          field: "production_date",
          label: "生産期間",
          severity: "warning",
          message: `区画 ${plot.plot_reference || plot.id.slice(0, 8)} の生産期間が未設定です`,
        });
      }
      // EUDR Art.9: plots >= 4ha must use polygon, not point
      if (
        plot.area_ha != null &&
        Number(plot.area_ha) >= 4 &&
        plot.geolocation_type === "point"
      ) {
        plGaps.push({
          field: "polygon_required",
          label: "ポリゴン必須",
          severity: "warning",
          message: `区画 ${plot.plot_reference || (plot.id as string)?.slice(0, 8)} は4ha以上のため、ポリゴンでのジオロケーションが必要です（EUDR第9条）`,
        });
      }
    }

    if (!pl.country_of_production) {
      plGaps.push({
        field: "country_of_production",
        label: "生産国",
        severity: "error",
        message: "生産国が設定されていません",
      });
    }

    if (plGaps.length > 0) {
      productLineGaps[pl.id] = plGaps;
    }
  }

  const hasError =
    gaps.some((g) => g.severity === "error") ||
    Object.values(productLineGaps).some((g) =>
      g.some((gi) => gi.severity === "error")
    );

  return {
    dds_id: ddsId,
    is_ready: !hasError,
    gaps,
    product_line_gaps: productLineGaps,
  };
}

// ── DDS JSON Export (TRACES-compatible format) ──────────────

export async function exportDdsAsJson(
  workspaceSlug: string,
  ddsId: string
): Promise<ActionState & { payload?: Record<string, unknown> }> {
  const user = await requireAuth();
  if (!user) return { error: "認証が必要です" };

  const admin = createAdminClient();
  const ws = await resolveWorkspace(admin, workspaceSlug);
  if (!ws) return { error: "ワークスペースが見つかりません" };

  const full = await fetchFullDds(admin, ddsId);
  if (!full) return { error: "DDS が見つかりません" };

  const { dds, productLines, plots, cattleAnimals, cattleEstablishments, upstreamRefs, riskAssessment, riskCriteria, riskMitigations, evidenceLinks } = full;

  // Build TRACES-compatible payload
  const payload = buildTracesPayload(
    dds,
    productLines,
    plots,
    cattleAnimals,
    cattleEstablishments,
    upstreamRefs,
    riskAssessment,
    riskCriteria,
    riskMitigations,
    evidenceLinks
  );

  // Record the export
  await admin.from("eudr_exports").insert({
    workspace_id: ws.id,
    dds_id: ddsId,
    export_type: "dds_json",
    file_name: `dds_${dds.internal_reference}_${new Date().toISOString().split("T")[0]}.json`,
    payload_snapshot: payload,
    exported_by: user.id,
  });

  await appendChangeLog(
    ws.id,
    user.id,
    "eudr_dds_statements",
    ddsId,
    "dds_export",
    null,
    { export_type: "dds_json" }
  );

  return { success: true, payload };
}

// ── Payload Builder (separated for future API integration) ──

function buildTracesPayload(
  dds: Record<string, unknown>,
  productLines: Record<string, unknown>[],
  plots: Record<string, unknown>[],
  cattleAnimals: Record<string, unknown>[],
  cattleEstablishments: Record<string, unknown>[],
  upstreamRefs: Record<string, unknown>[],
  riskAssessment: Record<string, unknown> | null,
  riskCriteria: Record<string, unknown>[],
  riskMitigations: Record<string, unknown>[],
  evidenceLinks: Record<string, unknown>[]
): Record<string, unknown> {
  return {
    schema_version: "1.0",
    export_timestamp: new Date().toISOString(),
    due_diligence_statement: {
      internal_reference: dds.internal_reference,
      eu_reference_number: dds.eu_reference_number,
      eu_verification_number: dds.eu_verification_number,
      operator_type: dds.operator_type,
      status: dds.status,
      submission_date: dds.submission_date,
      valid_from: dds.valid_from,
      valid_to: dds.valid_to,
      country_of_activity: dds.country_of_activity,
      description: dds.description,
      operator: dds.operator_org
        ? {
            name:
              (dds.operator_org as Record<string, unknown>).display_name ||
              (dds.operator_org as Record<string, unknown>).legal_name,
            legal_name: (dds.operator_org as Record<string, unknown>)
              .legal_name,
          }
        : null,
    },
    product_lines: productLines.map((pl) => {
      const plPlots = plots.filter(
        (p) => p.product_line_id === pl.id
      );
      const plAnimals = cattleAnimals.filter(
        (a) => a.product_line_id === pl.id
      );

      return {
        commodity_type: pl.commodity_type,
        cn_code: pl.cn_code,
        hs_code: pl.hs_code,
        product_description: pl.product_description,
        quantity_kg: pl.quantity_kg,
        country_of_production: pl.country_of_production,
        trade_name: pl.trade_name,
        scientific_name: pl.scientific_name,
        plots: plPlots.map((p) => ({
          plot_reference: p.plot_reference,
          geolocation_type: p.geolocation_type,
          latitude: p.latitude,
          longitude: p.longitude,
          geojson: p.geojson,
          area_ha: p.area_ha,
          country_of_production: p.country_of_production,
          region: p.region,
          production_period: {
            start: p.production_start_date,
            end: p.production_end_date,
          },
          deforestation_free: p.deforestation_free,
          deforestation_cutoff: p.deforestation_cutoff,
        })),
        cattle_animals:
          (pl.commodity_type as string) === "cattle"
            ? plAnimals.map((a) => {
                const aEstablishments = cattleEstablishments
                  .filter((e) => e.cattle_animal_id === a.id)
                  .sort(
                    (x, y) =>
                      (x.sequence_order as number) -
                      (y.sequence_order as number)
                  );
                return {
                  animal_identifier: a.animal_identifier,
                  ear_tag_number: a.ear_tag_number,
                  date_of_birth: a.date_of_birth,
                  date_of_death: a.date_of_death,
                  breed: a.breed,
                  establishments: aEstablishments.map((e) => ({
                    establishment_type: e.establishment_type,
                    establishment_name: e.establishment_name,
                    latitude: e.latitude,
                    longitude: e.longitude,
                    country_code: e.country_code,
                    date_entered: e.date_entered,
                    date_left: e.date_left,
                    sequence_order: e.sequence_order,
                  })),
                };
              })
            : undefined,
      };
    }),
    upstream_references: upstreamRefs.map((r) => ({
      reference_number: r.reference_number,
      verification_number: r.verification_number,
      upstream_operator_name: r.upstream_operator_name,
      upstream_eori: r.upstream_eori,
      upstream_country: r.upstream_country,
      commodity_type: r.commodity_type,
    })),
    supporting_evidence: evidenceLinks.map((el) => {
      const item = el.evidence_item as Record<string, unknown> | null;
      return {
        link_id: el.id,
        target_type: el.target_type,
        target_id: el.target_id,
        note: el.note,
        evidence_item: item
          ? {
              id: item.id,
              file_name: item.file_name,
              evidence_type: item.evidence_type,
              mime_type: item.mime_type,
            }
          : null,
      };
    }),
    risk_assessment: riskAssessment
      ? {
          overall_result: riskAssessment.overall_result,
          country_risk_level: riskAssessment.country_risk_level,
          assessed_at: riskAssessment.assessed_at,
          criteria: riskCriteria.map((c) => ({
            key: c.criterion_key,
            label: c.criterion_label,
            auto_score: c.auto_score,
            manual_override: c.manual_override,
            final_score: c.final_score,
            evidence_notes: c.evidence_notes,
            evidence_item_ids: c.evidence_item_ids,
          })),
          mitigations: riskMitigations.map((m) => ({
            criterion_key: m.criterion_key,
            mitigation_type: m.mitigation_type,
            description: m.description,
            status: m.status,
            evidence_item_id: m.evidence_item_id,
            completed_at: m.completed_at,
          })),
        }
      : null,
  };
}
