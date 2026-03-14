# TerraLink 修正計画 — EUDR着手前

作成日: 2026-03-14
前提: Critical 4 + Medium 10 + Low 8 修正済み。残存問題16件を分類・優先順位付け。

---

## 1. EUDR着手前に必須な修正（5件）

Runtime crash またはデータ不整合を起こす問題。EUDR の供給網マッピング・空間分析・監査ログが動作しない。

### R1: supply_relationships.relationship_type enum 不一致 ★CRASH

| 項目 | 内容 |
|------|------|
| 重大度 | Critical (CHECK 違反で INSERT 失敗) |
| 種別 | Quick fix (code + migration) |
| 工数 | 30分 |

**問題**: コード側 `direct_supplier, indirect_supplier, customer, logistics, jv_partner` ≠ DB CHECK `supplies, manufactures_for, ships_for, sells_to, owns`

**方針**: DB CHECK を拡張する migration を追加。既存5値はそのまま残し、アプリ側 enum を DB CHECK 値に合わせる。

**対象ファイル**:
- `lib/domain/supply-actions.ts` L16-18 — SupplyRelationshipSchema enum
- `lib/labels.ts` L76-82 — RELATIONSHIP_TYPE_LABELS
- `app/app/[workspaceSlug]/supply/add-relationship-form.tsx` L65-73 — dropdown options

### R2: supply_edges.flow_direction enum 不一致 ★CRASH

| 項目 | 内容 |
|------|------|
| 重大度 | Critical (CHECK 違反で INSERT 失敗) |
| 種別 | Quick fix (code only) |
| 工数 | 15分 |

**問題**: コード側 `inbound, outbound, internal, reverse, unknown` ≠ DB CHECK `upstream, downstream`

**方針**: アプリ側 enum を `upstream, downstream` に合わせる。

**対象ファイル**:
- `lib/domain/supply-actions.ts` L28-30 — SupplyEdgeSchema enum
- `lib/labels.ts` L84-90 — FLOW_DIRECTION_LABELS

### R3: org_name カラム参照（3ページ）★NULL表示

| 項目 | 内容 |
|------|------|
| 重大度 | High (全組織名が "Unknown" になる) |
| 種別 | Quick fix (code only) |
| 工数 | 20分 |

**問題**: organizations テーブルに `org_name` カラムは存在しない。正しくは `display_name`。evidence/monitor/leap の3ページで組織名が取得できない。

**対象ファイル**:
- `app/app/[workspaceSlug]/evidence/page.tsx` L115, 124-125
- `app/app/[workspaceSlug]/monitor/page.tsx` L44, 56, 58
- `app/app/[workspaceSlug]/leap/page.tsx` L205, 210, 218, 253-254

### R4: spatial_intersections クエリのカラム名不一致 ★CRASH

| 項目 | 内容 |
|------|------|
| 重大度 | High (LEAP Locate タブがクラッシュ) |
| 種別 | Quick fix (code only) |
| 工数 | 20分 |

**問題**: クエリが `source_observation_id`, `overlap_pct` を参照するが、DB には存在しない。正しくは `source_version_id`, `intersection_type`, `area_overlap_m2`, `severity_hint`, `raw_result`。

**対象ファイル**:
- `app/app/[workspaceSlug]/leap/page.tsx` L148-156 — select クエリ
- `app/app/[workspaceSlug]/leap/page.tsx` L344-353 — IntersectionRow 型定義
- `app/app/[workspaceSlug]/leap/leap-tabs.tsx` — intersections 表示コード（要確認）

### R5: change_log.action CHECK 違反（監査ログ欠損）

| 項目 | 内容 |
|------|------|
| 重大度 | Medium (監査ログが静かに失敗) |
| 種別 | Quick fix (migration) |
| 工数 | 15分 |
| DB migration | 必要 |

**問題**: コードが `trigger_ingestion`, `run_sample_ingestion`, `soft_delete` を action に使用するが、DB CHECK は `insert, update, delete, status_change, share, unshare` のみ許可。

**方針**: additive migration で CHECK 制約を拡張。

**対象ファイル**:
- 新規 migration: `20260314000004_expand_change_log_actions.sql`

---

## 2. EUDRと同時でもよい修正（7件）

機能は動くが不正確な表示、または EUDR 機能追加時にどうせ触るファイル。

### R6: supply edges の sites.name → site_name

| 工数 | 5分 | 種別 | Quick fix |
|------|-----|------|-----------|

**対象**: `app/app/[workspaceSlug]/supply/page.tsx` L83, 88

### R7: supplier-site-form の site_type enum 不一致

| 工数 | 15分 | 種別 | Quick fix |
|------|------|------|-----------|

**問題**: `plantation`, `other` → DB に存在しない。`project_site`, `store`, `unknown` が欠落。

**対象ファイル**:
- `app/supplier/sites/supplier-site-form.tsx` L20-29

### R8: supplier-site-form に area_ha フィールド追加

| 工数 | 15分 | 種別 | Quick fix |
|------|------|------|-----------|

**問題**: EUDR は生産区画の面積(ha)を要求。サプライヤーが自己申告できるフィールドが無い。

**対象ファイル**:
- `app/supplier/sites/supplier-site-form.tsx` — input 追加
- `lib/domain/supplier-actions.ts` — INSERT に area_ha 追加（Zod に areaHa は既にある）

### R9: テストスキーマの陳腐化

| 工数 | 20分 | 種別 | Quick fix |
|------|------|------|-----------|

**問題**: `schemas.test.ts` の SiteSchema / SupplyRelationshipSchema が本番コードと乖離。テストが嘘を通している。

**対象ファイル**:
- `tests/lib/domain/schemas.test.ts` L203-335 (SiteSchema), L340-384 (SupplyRelationshipSchema)
- `tests/lib/domain/schemas.test 2.ts` — 重複ファイル削除

### R10: disclosures.framework に 'eudr' を追加

| 工数 | 5分 | 種別 | Migration |
|------|-----|------|-----------|
| DB migration | 必要 |

**対象**: 新規 migration で CHECK 制約を拡張 (`'tnfd','csrd','internal','eudr'`)

### R11: 地図がプレースホルダーのみ

| 工数 | 1-2日 | 種別 | Structural fix |
|------|--------|------|----------------|

**問題**: sites 一覧 / 詳細ページの地図が CSS グラデーション＋ドット。EUDR は生産区画の地理的可視化を要求。

**方針**: Mapbox GL JS または Leaflet で実装。EUDR 機能の一部として開発。

**対象ファイル**:
- `app/app/[workspaceSlug]/sites/page.tsx` L109-144
- `app/app/[workspaceSlug]/sites/[siteId]/page.tsx` L148-171
- 新規: `components/map/site-map.tsx`

### R12: サプライチェーン可視化がカード表示のみ

| 工数 | 2-3日 | 種別 | Structural fix |
|------|--------|------|----------------|

**問題**: 最大8件のバッジ表示。EUDR は end-to-end のサプライチェーンマッピングを要求。

**方針**: EUDR 機能の一部としてネットワークグラフを実装。

**対象ファイル**:
- `app/app/[workspaceSlug]/supply/page.tsx` L200-248
- 新規: `components/supply/network-graph.tsx`

---

## 3. 後回しでよい修正（4件）

### R13: 重複テストファイル削除
- `tests/lib/domain/schemas.test 2.ts` を削除（R9 と同時）

### R14: seed.sql の陳腐化
- `supabase/seed.sql` のコメント内カラム名を修正

### R15: DELETE RLS ポリシー欠如
- 現在は全て service_role 経由のため影響なし
- サプライヤーセルフサービスで DELETE 操作を追加する場合に対応

### R16: E2E / 統合テスト不在
- スキーマテストのみ（80件）。server action / API route のテストなし
- EUDR 開発と並行でテスト基盤を構築すべき

---

## 4. 推奨実装順

### Phase 1: Quick wins（半日）— EUDR着手前に完了

| 順番 | 修正 | 工数 | migration |
|------|------|------|-----------|
| 1 | R1: relationship_type enum 修正 | 30分 | Yes |
| 2 | R2: flow_direction enum 修正 | 15分 | No |
| 3 | R3: org_name → display_name | 20分 | No |
| 4 | R4: spatial_intersections カラム修正 | 20分 | No |
| 5 | R5: change_log action 拡張 | 15分 | Yes |
| | **小計** | **~2時間** | **2件** |

### Phase 2: EUDR 初期スプリントで同時対応（1-2日）

| 順番 | 修正 | 工数 | migration |
|------|------|------|-----------|
| 6 | R6: supply edges site_name 修正 | 5分 | No |
| 7 | R7: supplier-site-form enum 修正 | 15分 | No |
| 8 | R8: supplier-site-form area_ha 追加 | 15分 | No |
| 9 | R9 + R13: テストスキーマ更新 + 重複削除 | 20分 | No |
| 10 | R10: disclosures framework eudr 追加 | 5分 | Yes |
| | **小計** | **~1時間** | **1件** |

### Phase 3: EUDR 機能開発（1週間内）

| 修正 | 工数 |
|------|------|
| R11: 地図実装 (Mapbox/Leaflet) | 1-2日 |
| R12: サプライチェーングラフ | 2-3日 |

### Phase 4: 後回し（EUDR 後）

R14 (seed.sql), R15 (DELETE RLS), R16 (E2E テスト)

---

## 5. 想定変更ファイル

### Phase 1 で変更するファイル

| ファイル | 修正 |
|----------|------|
| `lib/domain/supply-actions.ts` | R1, R2 |
| `lib/labels.ts` | R1, R2 |
| `app/app/[workspaceSlug]/supply/add-relationship-form.tsx` | R1 |
| `app/app/[workspaceSlug]/evidence/page.tsx` | R3 |
| `app/app/[workspaceSlug]/monitor/page.tsx` | R3 |
| `app/app/[workspaceSlug]/leap/page.tsx` | R3, R4 |
| `app/app/[workspaceSlug]/leap/leap-tabs.tsx` | R4 (要確認) |
| **新規** `supabase/migrations/20260314000004_fix_supply_enums.sql` | R1 (CHECK拡張、不要なら code-only) |
| **新規** `supabase/migrations/20260314000005_expand_change_log_actions.sql` | R5 |

### Phase 2 で変更するファイル

| ファイル | 修正 |
|----------|------|
| `app/app/[workspaceSlug]/supply/page.tsx` | R6 |
| `app/supplier/sites/supplier-site-form.tsx` | R7, R8 |
| `lib/domain/supplier-actions.ts` | R8 |
| `tests/lib/domain/schemas.test.ts` | R9 |
| `tests/lib/domain/schemas.test 2.ts` | R13 (削除) |
| **新規** `supabase/migrations/20260314000006_add_eudr_framework.sql` | R10 |

### Phase 3 で変更・作成するファイル

| ファイル | 修正 |
|----------|------|
| `app/app/[workspaceSlug]/sites/page.tsx` | R11 |
| `app/app/[workspaceSlug]/sites/[siteId]/page.tsx` | R11 |
| `app/app/[workspaceSlug]/supply/page.tsx` | R12 |
| **新規** `components/map/site-map.tsx` | R11 |
| **新規** `components/supply/network-graph.tsx` | R12 |
| `package.json` | R11 (mapbox-gl or leaflet dependency) |

---

## 補足: DB Migration まとめ

| Migration | 内容 | Phase |
|-----------|------|-------|
| `20260314000004_fix_supply_enums.sql` | relationship_type CHECK 拡張（不要なら code-only で対応） | 1 |
| `20260314000005_expand_change_log_actions.sql` | action CHECK に `trigger_ingestion`, `run_sample_ingestion`, `soft_delete` 追加 | 1 |
| `20260314000006_add_eudr_framework.sql` | disclosures.framework に `eudr` 追加 | 2 |

**注**: R1 について、DB の既存値 `supplies, manufactures_for, ships_for, sells_to, owns` はドメインモデルとして適切なので、アプリ側 enum をこれらに合わせる方が migration 不要で安全。その場合 migration は R5 と R10 の2件のみ。
