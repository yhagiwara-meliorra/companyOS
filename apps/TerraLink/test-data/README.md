# テストデータ CSV

EUDR モジュールの動作確認用テストデータです。

## アップロード順序

UI でのインポートは以下の順序で行ってください（FK 依存関係のため）：

### Step 1: 組織（Organizations）
- **ファイル**: `organizations.csv`
- **画面**: `/app/{ws}/orgs` → CSV インポート（ボタン or ドラッグ&ドロップ）
- **内容**: サプライヤー10社 + バイヤー2社（BR, ID, CI, RW, GH, MY, PY, ET, CO, DE, NL）

### Step 2: サイト（Sites）
- **ファイル**: `sites.csv`
- **画面**: `/app/{ws}/sites` → 組織セレクタで紐付け先を選択 → CSV インポート
- **内容**: 農場6件 + 工場3件 + 倉庫4件 + 港湾1件 + サイロ1件

### Step 3: DDS 作成
- **ファイル**: `dds.csv`
- **画面**: `/app/{ws}/eudr/dds` → CSV インポート
- **内容**: DDS 2件（Meliorra Green Supply + TerraLink Import EU）
- **注意**: `operator_org_name` は Step 1 でインポートした組織の display_name と一致する必要があります

### Step 4: Product Line 追加
- **ファイル**: DDS ごとに別ファイル
  - `product-lines-dds-001.csv` → DDS-2026-001 に対してインポート（coffee, cocoa, cattle）
  - `product-lines-dds-002.csv` → DDS-2026-002 に対してインポート（soya, oil_palm）
- **画面**: DDS 詳細ページ → 製品明細セクション → CSV インポート

### Step 5: Plots（区画）
- **ファイル**: 以下を該当 Product Line に対してインポート
  - `plots-coffee-rwanda.csv` — ルワンダ産コーヒー（5区画、< 4ha、point）
  - `plots-soya-brazil.csv` — ブラジル産大豆（7区画、45-200ha、polygon）
  - `plots-palm-oil-indonesia.csv` — インドネシア産パーム油（6区画、38-90ha、polygon）
  - `plots-cocoa-ghana.csv` — ガーナ産カカオ（8区画、< 4ha、point）

### Step 6: Cattle Establishments（牛トレーサビリティ）
- **ファイル**: `cattle-establishments-colombia.csv`
- **注意**: `cattle_animal_id` カラムは PLACEHOLDER になっています。
  DDS で cattle product line → cattle animal を作成後、実際の UUID に置換してからインポートしてください。

## データの特徴

| CSV | 国 | 品目 | 区画数 | ポイント/ポリゴン | リスク想定 |
|-----|-----|------|--------|-----------------|-----------|
| plots-coffee-rwanda | RW | coffee | 5 | point (< 4ha) | low |
| plots-soya-brazil | BR | soya | 7 | polygon (45-200ha) | high |
| plots-palm-oil-indonesia | ID | oil_palm | 6 | polygon (38-90ha) | high |
| plots-cocoa-ghana | GH/CI | cocoa | 8 | point (< 4ha) | standard |
| cattle-establishments-colombia | CO | cattle | 12 (3頭×4施設) | point | standard |
