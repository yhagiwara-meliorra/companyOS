# EUDR モジュール設計差分

作成日: 2026-03-14

---

## 1. 既存モデルで再利用できるもの

| 既存テーブル | EUDR での役割 | 再利用度 |
|-------------|-------------|---------|
| **workspaces** | DDS の所有・スコープ単位 | そのまま |
| **organizations** | operator / trader / supplier の主体 | そのまま（`org_type` 拡張不要、既存 enum で足りる） |
| **workspace_organizations** | supply chain 内の組織関係 + tier | そのまま |
| **sites** | production plot / establishment のベース | **拡張必要**（後述）。PostGIS `geom` カラム、`area_ha`、`country_code` は既に存在 |
| **organization_sites** | 組織→サイト所有関係 | そのまま |
| **workspace_sites** | バイヤー視点のサイトスコープ | そのまま |
| **supply_relationships** | サプライチェーン上流参照 | そのまま |
| **supply_edges** | サイト間の物流フロー | そのまま |
| **supply_edge_materials** | エッジに紐づく原材料 | そのまま（`materials.hs_code` が既に存在） |
| **materials** | HS コード付き原材料マスタ | **拡張必要**（CN コード追加） |
| **evidence_items** | 合法性証明・森林破壊フリー証明の格納 | そのまま（`evidence_type` 拡張） |
| **evidence_links** | DDS / risk assessment への証憑紐づけ | そのまま（`target_type` 拡張） |
| **spatial_intersections** | 森林被覆・保護区域との空間重畳 | そのまま |
| **data_sources** | GFW / WDPA 等の外部データ | そのまま |
| **risk_register** | EUDR リスク評価結果の格納 | **拡張不要**（`risk_type` に既存値で表現可、新 enum 追加は後述） |
| **assessments** | EUDR 年次評価サイクル | そのまま（`method_version: 'eudr_v1'` で区別） |
| **disclosures** | DDS コンテンツの Markdown 生成 | そのまま（`framework: 'eudr'` 追加済み） |
| **change_log** | 監査ログ（5年保持義務対応） | そのまま |
| **monitoring_rules** | 森林破壊アラート・国ベンチマーク変更検知 | そのまま |

**再利用率: ~70%**。EUDR 固有の概念（DDS、plot/establishment、commodity code、country benchmark）のみ新規テーブルが必要。

---

## 2. 追加すべきテーブル一覧

### 2A. マスタデータ（グローバル、workspace 非依存）

| テーブル | 目的 | 行数目安 |
|---------|------|---------|
| `eudr_commodity_codes` | Annex I の CN/HS コード→コモディティマッピング | ~200行（seed） |
| `eudr_country_benchmarks` | 国別リスク分類（low/standard/high）| ~250行（seed、定期更新） |

### 2B. ビジネスデータ（workspace スコープ）

| テーブル | 目的 | 主な FK |
|---------|------|--------|
| `dds_statements` | Due Diligence Statement 本体 | workspace_id, assessment_id |
| `dds_product_lines` | DDS 内の製品明細（CN コード単位）| dds_id, eudr_commodity_code_id |
| `dds_plots` | 生産区画の geolocation | dds_product_line_id, site_id (nullable) |
| `dds_cattle_animals` | 牛個体情報（cattle 専用） | dds_product_line_id |
| `dds_cattle_establishments` | 牛の飼育施設チェーン | dds_cattle_animal_id, site_id (nullable) |
| `dds_upstream_refs` | 上流 DDS 参照番号 | dds_id |
| `eudr_risk_assessments` | EUDR 14 基準のリスク評価 | dds_id, workspace_id |
| `eudr_risk_mitigations` | リスク軽減措置の記録 | eudr_risk_assessment_id |

**合計: 10 テーブル（マスタ 2 + ビジネス 8）**

---

## 3. Enum / Type の追加案

### 3A. 新規 CHECK 制約

```sql
-- eudr_commodity_codes.commodity_type
CHECK (commodity_type IN (
  'cattle','cocoa','coffee','oil_palm','rubber','soya','wood'
))

-- dds_statements.status
CHECK (status IN (
  'draft','ready','submitted','validated','rejected','withdrawn'
))

-- dds_statements.operator_type
CHECK (operator_type IN (
  'operator','non_sme_trader','sme_trader'
))

-- dds_plots.geolocation_type
CHECK (geolocation_type IN ('point','polygon'))

-- dds_cattle_establishments.establishment_type
CHECK (establishment_type IN (
  'birthplace','rearing_farm','feeding_facility',
  'grazing_land','slaughterhouse'
))

-- eudr_risk_assessments.overall_result
CHECK (overall_result IN ('negligible','non_negligible'))

-- eudr_risk_assessments.country_risk_level
CHECK (country_risk_level IN ('low','standard','high'))

-- eudr_country_benchmarks.risk_tier
CHECK (risk_tier IN ('low','standard','high'))
```

### 3B. 既存テーブルへの CHECK 拡張

```sql
-- evidence_items.evidence_type に追加
'legality_proof','deforestation_free_proof','dds_export'

-- evidence_links.target_type に追加
'dds_statement','eudr_risk_assessment','dds_plot'

-- change_log.action に追加
'dds_submit','dds_withdraw'

-- risk_register.risk_type に追加
'eudr_deforestation','eudr_legality','eudr_country'
```

### 3C. materials テーブルへのカラム追加

```sql
ALTER TABLE materials ADD COLUMN cn_code text;
ALTER TABLE materials ADD COLUMN commodity_type text;
-- commodity_type は eudr_commodity_codes との紐づけ用
```

---

## 4. Plot / Establishment / Batch / Shipment / Product の関係モデル

```
dds_statements (1 DDS = 1回の市場投入/輸出の申告)
 │
 ├── dds_product_lines (1:N) ── 製品明細
 │    │  cn_code, commodity_type, quantity_kg
 │    │  FK → eudr_commodity_codes
 │    │
 │    ├── dds_plots (1:N) ── 生産区画 (crop commodities)
 │    │    geolocation (point or polygon)
 │    │    country_of_production
 │    │    area_ha, production_date_start/end
 │    │    FK → sites (optional: 既存サイトへのリンク)
 │    │
 │    └── dds_cattle_animals (1:N) ── 牛個体 (cattle only)
 │         animal_identifier, date_of_birth, date_of_death
 │         │
 │         └── dds_cattle_establishments (1:N) ── 飼育施設チェーン
 │              establishment_type, geolocation (always point)
 │              date_entered, date_left, sequence_order
 │              FK → sites (optional)
 │
 ├── dds_upstream_refs (1:N) ── 上流 DDS 参照
 │    reference_number, verification_number
 │    upstream_operator_name, upstream_eori
 │
 ├── eudr_risk_assessments (1:1) ── 14基準リスク評価
 │    overall_result: negligible | non_negligible
 │    │
 │    └── eudr_risk_mitigations (1:N) ── 軽減措置
 │         mitigation_type, description, evidence_item_id
 │
 └── evidence_links (1:N) ── 証憑紐づけ
      target_type='dds_statement'
```

### 既存モデルとの接続点

```
dds_plots ──FK──→ sites (既存)
  sites.geom (PostGIS) → spatial_intersections (既存)
    → 森林被覆・保護区域チェック自動実行

dds_product_lines ──FK──→ eudr_commodity_codes (新規マスタ)
  eudr_commodity_codes.hs_code → materials.hs_code (既存)

dds_statements ──FK──→ assessments (既存)
  assessments → assessment_scopes → risk_register (既存 LEAP)

dds_statements.workspace_id → workspace (既存テナント)
dds_statements.operator_org_id → organizations (既存)
```

### Batch / Shipment の設計方針

EUDR は「batch」「shipment」を独立テーブルとして定義しない。代わりに：
- **Batch** = `dds_product_lines` の1行（同一 CN コード・同一原産国の集約単位）
- **Shipment** = `dds_statements` 自体（1 DDS = 1回の market placing / export）
- **Mixing** = 1つの `dds_product_line` に複数の `dds_plots` が紐づく（複数区画の混合）

この設計により、バッチ/出荷の追加テーブルは不要。

---

## 5. Risk Assessment の最小ロジック

### 5A. 自動スコアリング（既存データから算出）

```
入力:
  country_of_production → eudr_country_benchmarks.risk_tier
  site.geom → spatial_intersections (GFW forest loss, WDPA protected areas)
  supply_chain_depth → supply_relationships.tier (max)

自動判定ロジック:
  1. country_risk_level = lookup(country_of_production)
  2. forest_overlap = any spatial_intersection with category='forest' AND severity_hint > 0.5
  3. protected_area_overlap = any spatial_intersection with category='protected_area'
  4. supply_chain_complexity = tier > 3 ? 'complex' : tier > 1 ? 'moderate' : 'simple'

  IF country_risk_level = 'high'
    OR forest_overlap = true
    OR protected_area_overlap = true
  THEN overall_result = 'non_negligible'
  ELSE IF country_risk_level = 'standard'
    AND supply_chain_complexity = 'complex'
  THEN overall_result = 'non_negligible'
  ELSE overall_result = 'negligible'
```

### 5B. 手動オーバーライド（14基準）

自動スコア → アナリストがレビュー → 14基準を個別に確認 → 最終判定

```typescript
type RiskCriterion = {
  criterion_key: string;  // 'a' through 'n'
  auto_score: 'low' | 'medium' | 'high' | null;
  manual_override: 'low' | 'medium' | 'high' | null;
  evidence_notes: string;
  evidence_item_ids: string[];  // 紐づく証憑
};
```

### 5C. 判定結果と後続アクション

| 判定 | 後続アクション |
|------|-------------|
| `negligible` | DDS 提出可能 |
| `non_negligible` | 軽減措置を記録 → 再評価 → negligible になれば DDS 提出可能 |
| 軽減後も `non_negligible` | DDS 提出不可（市場投入禁止） |

---

## 6. UI の最小画面一覧

### 6A. EUDR タブ（メインナビゲーション追加）

| # | 画面 | Route | 種別 |
|---|------|-------|------|
| 1 | **EUDR ダッシュボード** | `/app/[ws]/eudr` | 一覧 |
| 2 | **DDS 一覧** | `/app/[ws]/eudr/dds` | CRUD 一覧 |
| 3 | **DDS 作成/編集** | `/app/[ws]/eudr/dds/new`, `/app/[ws]/eudr/dds/[id]` | フォーム |
| 4 | **DDS 製品明細** | DDS 詳細ページ内タブ | インラインCRUD |
| 5 | **Plot 管理** | DDS 詳細ページ内タブ | 地図 + フォーム |
| 6 | **Cattle 施設チェーン** | DDS 詳細ページ内タブ（cattle のみ） | タイムライン |
| 7 | **リスク評価** | DDS 詳細ページ内タブ | 14基準チェックリスト |
| 8 | **証憑パック** | DDS 詳細ページ内タブ | 証憑リスト + エクスポート |
| 9 | **Country Benchmark 参照** | `/app/[ws]/eudr/benchmarks` | 読み取り専用テーブル |
| 10 | **Commodity Code 参照** | `/app/[ws]/eudr/commodities` | 読み取り専用テーブル |

### 6B. 既存画面への追加

| 画面 | 追加内容 |
|------|---------|
| Sites 詳細 | EUDR plot としての利用状況バッジ |
| Supply chain | DDS 紐づき表示 |
| Evidence vault | EUDR 証憑タイプフィルター |
| Dashboard | EUDR KPI カード（DDS 件数、リスク分布） |

### 6C. サプライヤーセルフサービス追加

| 画面 | Route |
|------|-------|
| Plot 情報入力 | `/supplier/plots` |
| Establishment 情報入力 | `/supplier/establishments`（cattle 用） |

---

## 7. Migration の実装順序

### Phase 1: マスタデータ + コアテーブル

```
20260315000001_eudr_reference_tables.sql
  - eudr_commodity_codes (CREATE + seed)
  - eudr_country_benchmarks (CREATE + seed)
  - materials テーブルに cn_code, commodity_type カラム追加

20260315000002_dds_core.sql
  - dds_statements (CREATE)
  - dds_product_lines (CREATE)
  - dds_plots (CREATE + PostGIS geography)
  - dds_upstream_refs (CREATE)
  - evidence_items.evidence_type CHECK 拡張
  - evidence_links.target_type CHECK 拡張
  - change_log.action CHECK 拡張
```

### Phase 2: Cattle + Risk Assessment

```
20260315000003_eudr_cattle.sql
  - dds_cattle_animals (CREATE)
  - dds_cattle_establishments (CREATE + PostGIS geography)

20260315000004_eudr_risk.sql
  - eudr_risk_assessments (CREATE)
  - eudr_risk_mitigations (CREATE)
  - risk_register.risk_type CHECK 拡張
```

### Phase 3: RLS + Indexes

```
20260315000005_eudr_rls.sql
  - 全新規テーブルの RLS ポリシー
  - マスタデータ: authenticated read-only
  - ビジネスデータ: workspace member read, editor write
  - サプライヤー: 自社 org スコープで read/write

20260315000006_eudr_indexes.sql
  - パフォーマンスインデックス
  - dds_statements (workspace_id, status)
  - dds_plots (geolocation GIST)
  - eudr_risk_assessments (dds_id)
  - 等
```

### Phase 4: Monitoring + Automation（後続）

```
20260315000007_eudr_monitoring.sql
  - monitoring_rules に EUDR 固有の rule_type 追加
  - country_benchmark 変更検知用の仕組み
```

---

## 8. 将来の EU IS API 連携に向けた境界設計

### 8A. 境界レイヤーの分離

```
┌─────────────────────────────────────────────┐
│  TerraLink Core (内部管理)                    │
│  dds_statements, plots, risk_assessments    │
│  → 全て internal_reference で管理            │
└──────────────┬──────────────────────────────┘
               │ Export / Import API
               │ (lib/domain/eudr-export.ts)
┌──────────────▼──────────────────────────────┐
│  EUDR Gateway Layer (将来実装)               │
│  - TRACES API client                         │
│  - DDS JSON serializer (TRACES format)       │
│  - Reference/Verification number 受信        │
│  - Submission status polling                 │
└──────────────┬──────────────────────────────┘
               │ HTTPS (SOAP wrapped in REST)
┌──────────────▼──────────────────────────────┐
│  EU Information System (TRACES)              │
└─────────────────────────────────────────────┘
```

### 8B. 設計原則

1. **DDS は内部で完結させ、export-ready な JSON を生成する**
   - `dds_statements` に `eu_reference_number` / `eu_verification_number` を nullable で持つ
   - 提出前は `null`、提出後に EU IS から受け取った値を格納
   - これにより内部管理と EU 連携が分離される

2. **Export 関数を lib/domain に配置**
   - `exportDdsAsJson(ddsId)` → TRACES 形式の JSON を生成
   - `exportDdsAsCsv(ddsId)` → 簡易 CSV エクスポート（社内監査用）
   - `exportEvidencePack(ddsId)` → ZIP（DDS JSON + 全証憑ファイル）

3. **Country Benchmark は外部更新に備える**
   - `eudr_country_benchmarks` に `effective_date` / `superseded_at` を持つ
   - 新しいベンチマークが発表されたらレコード追加（上書きしない）
   - Monitoring rule で「利用中の benchmark が更新された」アラートを発火

4. **CN コードの年次更新に備える**
   - `eudr_commodity_codes.cn_year` で版管理
   - 新年度の CN 改定時はレコード追加

5. **DDS 間の参照チェーンは DAG**
   - `dds_upstream_refs` で上流参照を格納
   - 将来の TRACES API 連携時に `verified_in_traces` フラグで検証状態を管理

---

## 9. リスクとトレードオフ

### 9A. 設計上のリスク

| リスク | 影響 | 軽減策 |
|--------|------|--------|
| **EUDR 施行延期/変更** | テーブル設計が無駄になる可能性 | Additive migration のみ。既存モデルは壊さない。新テーブルは `eudr_` / `dds_` prefix で隔離 |
| **TRACES API 仕様未確定** | Export 形式が変わる可能性 | Gateway layer を分離し、内部データモデルは安定させる。Export は JSON テンプレート方式で差し替え可能に |
| **Polygon geolocation の UI 複雑度** | 4ha 以上の plot に polygon 入力が必要 | Phase 1 では GeoJSON ファイルアップロードのみ。Phase 2 で地図上描画を実装 |
| **Cattle の施設チェーン** | 1頭あたり複数施設の入力負荷 | CSV 一括インポート対応。サプライヤーセルフサービスで入力分散 |
| **Country Benchmark 動的更新** | ベンチマーク変更で既存 DDS のリスク再評価が必要 | Monitoring rule で変更検知 → 影響 DDS リストを自動生成 |

### 9B. トレードオフ

| 選択肢 | 採用 | 理由 |
|--------|------|------|
| `dds_plots` を独立テーブル vs `sites` に統合 | **独立テーブル** + `site_id` FK | Plot は DDS のスナップショット（提出時点の座標）。Sites は生きたデータ。分離すれば DDS の不変性を保証 |
| Risk assessment を `risk_register` に統合 vs 専用テーブル | **専用テーブル** `eudr_risk_assessments` | EUDR の14基準は TNFD/CSRD のリスクモデルと構造が異なる。無理に統合すると両方が複雑化 |
| Commodity code を `materials` に統合 vs 専用テーブル | **専用マスタ** + `materials` へのリンク | CN コードは年次更新される参照データ。Materials は自由入力のビジネスデータ。ライフサイクルが異なる |
| DDS 内の batch/shipment を独立テーブル化 vs product_line に集約 | **product_line に集約** | EUDR の規制構造上、batch = product_line、shipment = DDS で十分。過剰な正規化を避ける |
| 全 geolocation を `sites` テーブル経由 vs DDS に直接格納 | **両方**: `dds_plots.geolocation` + `dds_plots.site_id` (optional) | DDS 提出時の座標は不変。Sites は更新される可能性がある。リンクは任意で、一致確認に使う |

### 9C. スコープ外（後回し）

- TRACES API 直接連携（Phase 1 では export-ready まで）
- GeoJSON polygon 地図上描画（Phase 1 では ファイルアップロード）
- 自動 CN コード判定（Phase 1 では手動選択）
- マルチ DDS バッチ提出（Phase 1 では1件ずつ）
- SME trader の簡易フロー（Phase 1 では full operator フローのみ）
