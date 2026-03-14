# テストデータ CSV

EUDR モジュールの動作確認用テストデータです。

## アップロード順序

UI でのインポートは以下の順序で行ってください（FK 依存関係のため）：

### Step 1: 組織（Organizations）
- **ファイル**: `organizations.csv`
- **画面**: `/app/{ws}/orgs` → CSV インポート
- **内容**: サプライヤー10社 + バイヤー2社（BR, ID, CI, RW, GH, MY, PY, ET, CO, DE, NL）

### Step 2: サイト（Sites）
- **ファイル**: `sites.csv`
- **画面**: `/app/{ws}/sites` → CSV インポート
- **内容**: 農場6件 + 工場3件 + 倉庫4件 + 港湾1件 + サイロ1件

### Step 3: DDS 作成（手動）
- **画面**: `/app/{ws}/eudr/dds/new` で DDS を作成
- operator_org には Step 1 でインポートした組織を選択
- 例：Meliorra Green Supply GmbH を operator に設定

### Step 4: Product Line 追加（手動）
- **画面**: DDS 詳細ページで製品明細を追加
- コモディティごとに1行：coffee, soya, oil_palm, cocoa, cattle など

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
