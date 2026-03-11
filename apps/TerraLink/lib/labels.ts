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
  plantation: "プランテーション",
  factory: "工場",
  warehouse: "倉庫",
  port: "港湾",
  mine: "鉱山",
  office: "オフィス",
  other: "その他",
};

export const SITE_ROLE_LABELS: Record<string, string> = {
  operator: "運営者",
  owner: "所有者",
  lessee: "借主",
  supplier: "サプライヤー",
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

export const SUPPLY_STATUS_LABELS: Record<string, string> = {
  active: "有効",
  inactive: "無効",
  suspended: "停止中",
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

/** Helper to look up a label, falling back to the raw value */
export function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}
