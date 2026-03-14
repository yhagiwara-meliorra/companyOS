/**
 * EUDR Module TypeScript types.
 *
 * These types represent the database schema for the EUDR (EU Deforestation Regulation)
 * module. They mirror the SQL migrations and are used throughout the application.
 */

// ── Enums ───────────────────────────────────────────────────

export const EUDR_COMMODITY_TYPES = [
  "cattle",
  "cocoa",
  "coffee",
  "oil_palm",
  "rubber",
  "soya",
  "wood",
] as const;
export type EudrCommodityType = (typeof EUDR_COMMODITY_TYPES)[number];

export const DDS_STATUSES = [
  "draft",
  "ready",
  "submitted",
  "validated",
  "rejected",
  "withdrawn",
] as const;
export type DdsStatus = (typeof DDS_STATUSES)[number];

export const OPERATOR_TYPES = [
  "operator",
  "non_sme_trader",
  "sme_trader",
] as const;
export type OperatorType = (typeof OPERATOR_TYPES)[number];

export const GEOLOCATION_TYPES = ["point", "polygon"] as const;
export type GeolocationType = (typeof GEOLOCATION_TYPES)[number];

export const ESTABLISHMENT_TYPES = [
  "birthplace",
  "rearing_farm",
  "feeding_facility",
  "grazing_land",
  "slaughterhouse",
] as const;
export type EstablishmentType = (typeof ESTABLISHMENT_TYPES)[number];

export const RISK_RESULTS = [
  "pending",
  "negligible",
  "non_negligible",
] as const;
export type RiskResult = (typeof RISK_RESULTS)[number];

export const COUNTRY_RISK_TIERS = ["low", "standard", "high"] as const;
export type CountryRiskTier = (typeof COUNTRY_RISK_TIERS)[number];

export const RISK_SCORES = ["low", "medium", "high"] as const;
export type RiskScore = (typeof RISK_SCORES)[number];

export const RISK_ASSESSMENT_STATUSES = [
  "draft",
  "in_review",
  "completed",
] as const;

export const MITIGATION_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "verified",
] as const;
export type MitigationStatus = (typeof MITIGATION_STATUSES)[number];

export const EXPORT_TYPES = [
  "dds_json",
  "dds_csv",
  "evidence_pack",
  "traces_payload",
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

// ── Risk Criteria Keys (Art. 10 EUDR) ───────────────────────

export const RISK_CRITERION_KEYS = [
  "a", // geolocation_missing
  "b", // plot_geometry_invalid
  "c", // production_period_missing
  "d", // legality_evidence_missing
  "e", // commodity_mapping_incomplete
  "f", // country_risk_not_mapped
  "g", // upstream_dds_inconsistency
  "h", // deforestation_screening
  "i", // forest_degradation
  "j", // protected_area_overlap
  "k", // indigenous_rights
  "l", // supply_chain_complexity
  "m", // corruption_perception
  "n", // sanctions_conflict
] as const;
export type RiskCriterionKey = (typeof RISK_CRITERION_KEYS)[number];

export const RISK_CRITERION_LABELS: Record<RiskCriterionKey, string> = {
  a: "ジオロケーション欠落",
  b: "区画ジオメトリ無効",
  c: "生産期間欠落",
  d: "合法性証拠欠落",
  e: "コモディティ/製品マッピング不完全",
  f: "国リスク未マッピング",
  g: "上流DDS参照不整合",
  h: "森林破壊スクリーニング結果",
  i: "森林劣化",
  j: "保護区域重複",
  k: "先住民族権利",
  l: "サプライチェーン複雑度",
  m: "汚職認知指数",
  n: "制裁・紛争",
};

// ── Database Row Types ──────────────────────────────────────

export type EudrCommodityCode = {
  id: string;
  cn_code: string;
  hs_code: string | null;
  description: string;
  commodity_type: EudrCommodityType;
  cn_year: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EudrCountryBenchmark = {
  id: string;
  country_code: string;
  country_name: string;
  risk_tier: CountryRiskTier;
  commodity_type: EudrCommodityType | null;
  effective_date: string;
  superseded_at: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
};

export type EudrDdsStatement = {
  id: string;
  workspace_id: string;
  assessment_id: string | null;
  operator_org_id: string;
  internal_reference: string;
  operator_type: OperatorType;
  status: DdsStatus;
  eu_reference_number: string | null;
  eu_verification_number: string | null;
  submission_date: string | null;
  valid_from: string | null;
  valid_to: string | null;
  country_of_activity: string | null;
  description: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type EudrDdsProductLine = {
  id: string;
  dds_id: string;
  commodity_code_id: string | null;
  commodity_type: EudrCommodityType;
  cn_code: string;
  product_description: string;
  quantity_kg: number | null;
  quantity_unit: string | null;
  country_of_production: string;
  hs_code: string | null;
  trade_name: string | null;
  scientific_name: string | null;
  created_at: string;
  updated_at: string;
};

export type EudrDdsPlot = {
  id: string;
  product_line_id: string;
  site_id: string | null;
  plot_reference: string | null;
  geolocation_type: GeolocationType;
  latitude: number | null;
  longitude: number | null;
  geojson: Record<string, unknown> | null;
  area_ha: number | null;
  country_of_production: string;
  region: string | null;
  production_start_date: string | null;
  production_end_date: string | null;
  deforestation_free: boolean | null;
  deforestation_cutoff: string;
  verification_status: string;
  created_at: string;
  updated_at: string;
};

export type EudrDdsCattleAnimal = {
  id: string;
  product_line_id: string;
  animal_identifier: string;
  ear_tag_number: string | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  breed: string | null;
  sex: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EudrDdsCattleEstablishment = {
  id: string;
  cattle_animal_id: string;
  site_id: string | null;
  establishment_type: EstablishmentType;
  establishment_name: string | null;
  latitude: number | null;
  longitude: number | null;
  country_code: string;
  region: string | null;
  date_entered: string | null;
  date_left: string | null;
  sequence_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EudrDdsUpstreamRef = {
  id: string;
  dds_id: string;
  reference_number: string;
  verification_number: string | null;
  upstream_operator_name: string | null;
  upstream_eori: string | null;
  upstream_country: string | null;
  commodity_type: string | null;
  verified_in_traces: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type EudrRiskAssessment = {
  id: string;
  workspace_id: string;
  dds_id: string;
  overall_result: RiskResult;
  country_risk_level: CountryRiskTier | null;
  auto_score_json: Record<string, unknown>;
  manual_override: boolean;
  assessed_by: string | null;
  assessed_at: string | null;
  rationale: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type EudrRiskCriterion = {
  id: string;
  risk_assessment_id: string;
  criterion_key: RiskCriterionKey;
  criterion_label: string;
  auto_score: RiskScore | null;
  manual_override: RiskScore | null;
  final_score: RiskScore | null;
  evidence_notes: string | null;
  evidence_item_ids: string[];
  created_at: string;
  updated_at: string;
};

export type EudrRiskMitigation = {
  id: string;
  risk_assessment_id: string;
  criterion_key: string | null;
  mitigation_type: string;
  description: string;
  evidence_item_id: string | null;
  status: MitigationStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EudrExport = {
  id: string;
  workspace_id: string;
  dds_id: string;
  export_type: ExportType;
  file_name: string | null;
  storage_path: string | null;
  payload_snapshot: Record<string, unknown> | null;
  exported_by: string | null;
  created_at: string;
};

// ── DDS with relations (for detail views) ───────────────────

export type DdsStatementWithRelations = EudrDdsStatement & {
  operator_org?: { id: string; display_name: string; legal_name: string | null };
  product_lines?: EudrDdsProductLine[];
  upstream_refs?: EudrDdsUpstreamRef[];
  risk_assessment?: EudrRiskAssessment | null;
};

// ── DDS Gap Analysis ────────────────────────────────────────

export type DdsGapItem = {
  field: string;
  label: string;
  severity: "error" | "warning" | "info";
  message: string;
};

export type DdsGapAnalysis = {
  dds_id: string;
  is_ready: boolean;
  gaps: DdsGapItem[];
  product_line_gaps: Record<string, DdsGapItem[]>;
};
