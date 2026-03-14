/**
 * Japanese label maps for database enum values displayed in the UI.
 */

export const ORG_TYPE_LABELS: Record<string, string> = {
  buyer: "バイヤー",
  supplier: "サプライヤー",
  customer: "顧客",
  partner: "パートナー",
  logistics: "物流",
  internal: "社内",
};

export const ROLE_LABELS: Record<string, string> = {
  buyer: "バイヤー",
  supplier: "サプライヤー",
  customer: "顧客",
  partner: "パートナー",
  site_owner: "サイトオーナー",
};

export const SITE_TYPE_LABELS: Record<string, string> = {
  farm: "農場",
  factory: "工場",
  warehouse: "倉庫",
  port: "港",
  mine: "鉱山",
  office: "オフィス",
  project_site: "プロジェクトサイト",
  store: "店舗",
  unknown: "不明",
};

export const OWNERSHIP_ROLE_LABELS: Record<string, string> = {
  operator: "運営者",
  owner: "所有者",
  lessee: "借主",
  investor: "投資家",
};

export const SCOPE_ROLE_LABELS: Record<string, string> = {
  own_operation: "自社運営",
  upstream: "上流",
  downstream: "下流",
  logistics: "物流",
  portfolio_asset: "ポートフォリオ資産",
};

export const RUN_STATUS_LABELS: Record<string, string> = {
  pending: "待機中",
  queued: "キュー中",
  running: "実行中",
  success: "成功",
  succeeded: "成功",
  failed: "失敗",
  partial: "一部成功",
  cancelled: "キャンセル",
};

export const IMPACT_DIRECTION_LABELS: Record<string, string> = {
  dependency: "依存",
  impact: "影響",
  both: "両方",
};

export const RISK_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  open: "未対応",
  active: "有効",
  accepted: "受容",
  mitigating: "緩和中",
  mitigated: "緩和済み",
  closed: "完了",
};

export const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  supplies: "供給",
  manufactures_for: "製造委託",
  ships_for: "輸送",
  sells_to: "販売",
  owns: "所有",
};

export const FLOW_DIRECTION_LABELS: Record<string, string> = {
  upstream: "上流",
  downstream: "下流",
};

export const LEVEL_LABELS: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
  unknown: "不明",
};

export const RISK_TYPE_LABELS: Record<string, string> = {
  physical: "物理的",
  transition: "移行",
  systemic: "システミック",
  reputational: "レピュテーション",
  legal: "法的",
  market: "市場",
};

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: "手動",
  template: "テンプレート",
  ai: "AI",
};

export const DATA_SOURCE_CATEGORY_LABELS: Record<string, string> = {
  protected_area: "保護区域",
  kba: "重要生物多様性地域",
  water: "水域",
  forest: "森林",
  land_cover: "土地被覆",
  species: "種",
  climate: "気候",
  custom: "カスタム",
};

export const TOPIC_GROUP_LABELS: Record<string, string> = {
  land: "陸域",
  freshwater: "淡水",
  marine: "海洋",
  species: "種",
  pollution: "汚染",
  climate_interaction: "気候相互作用",
};

// ── EUDR Labels ─────────────────────────────────────────────

export const EUDR_COMMODITY_TYPE_LABELS: Record<string, string> = {
  cattle: "牛",
  cocoa: "カカオ",
  coffee: "コーヒー",
  oil_palm: "パーム油",
  rubber: "ゴム",
  soya: "大豆",
  wood: "木材",
};

export const DDS_STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  ready: "提出準備完了",
  submitted: "提出済み",
  validated: "検証済み",
  rejected: "却下",
  withdrawn: "取下げ",
};

export const OPERATOR_TYPE_LABELS: Record<string, string> = {
  operator: "オペレーター",
  non_sme_trader: "大規模トレーダー",
  sme_trader: "中小トレーダー",
};

export const GEOLOCATION_TYPE_LABELS: Record<string, string> = {
  point: "ポイント",
  polygon: "ポリゴン",
};

export const ESTABLISHMENT_TYPE_LABELS: Record<string, string> = {
  birthplace: "出生地",
  rearing_farm: "飼育農場",
  feeding_facility: "肥育施設",
  grazing_land: "放牧地",
  slaughterhouse: "食肉処理場",
};

export const EUDR_RISK_RESULT_LABELS: Record<string, string> = {
  pending: "未評価",
  negligible: "無視可能",
  non_negligible: "無視不可",
};

export const COUNTRY_RISK_TIER_LABELS: Record<string, string> = {
  low: "低リスク",
  standard: "標準リスク",
  high: "高リスク",
};

export const MITIGATION_STATUS_LABELS: Record<string, string> = {
  planned: "計画中",
  in_progress: "実施中",
  completed: "完了",
  verified: "検証済み",
};

export const EXPORT_TYPE_LABELS: Record<string, string> = {
  dds_json: "DDS JSON",
  dds_csv: "DDS CSV",
  evidence_pack: "証憑パック",
  traces_payload: "TRACES ペイロード",
};

/** Helper to look up a label, falling back to the raw value */
export function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}
