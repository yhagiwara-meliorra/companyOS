# 生物多様性リスク管理SaaS 開発ブリーフ

前提:
- フロント/アプリ: Next.js App Router on Vercel
- DB/Auth/Storage/Realtime/Functions: Supabase
- 開発オーケストレーション: Claude Code
- GitHubへそのままpushできる構成
- 初期は「箱」を作り、参照データソースを後から増やす
- 最初からTierN・監査証跡・マルチテナントを想定したDBにする

## 1. ゴール
このプロダクトは、買い手企業が自社拠点・サプライヤー・上流/下流サイトを登録し、外部自然資本レイヤと照合し、LEAPに沿ってLocate / Evaluate / Assess / Prepareを運用できるSaaSとする。

## 2. 技術方針
- Next.js App Routerを採用
- 認証はSupabase Auth
- 権限はSupabase Row Level Securityを前提
- DBの真実はSupabase SQL migrations
- 添付証憑はSupabase Storage
- ジョブキューはSupabase Queues(pgmq)
- スケジュール実行はVercel Cron → 内部API or Supabase Edge Function
- 地理処理はPostGIS
- 後でRAG/類似検索を入れられるようpgvectorを最初から有効化
- 監査ログはアプリログではなくDBレベルのappend-onlyテーブルでも残す

## 3. リポジトリ構成
```text
/
  app/
    (marketing)/
    (auth)/
    dashboard/
    api/
  components/
  lib/
    auth/
    db/
    domain/
    ingestion/
    risk/
    validation/
  styles/
  docs/
    architecture.md
    data-model.md
    prompt-pack.md
  supabase/
    config.toml
    migrations/
    seed.sql
    functions/
      run-monitor/
      ingest-source/
      recompute-risk/
      supplier-reminder/
  scripts/
  public/
  tests/
  .claude/
    settings.json
  CLAUDE.md
  .env.example
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.json
  next.config.ts
  middleware.ts
  vercel.json
  README.md
```

## 4. DB設計原則
1. **SaaSの所有権** と **現実世界の企業/拠点** を分離する。
2. 1つのサプライヤーが複数バイヤーに再利用されることを想定する。
3. TierNは「完全確定データ」ではなく「推定/確定」を同居させる。
4. 外部データ照合結果は上書きせず、版管理・履歴保持する。
5. UIで使う集計テーブルと、監査用の生ログテーブルを分ける。
6. 位置情報は最初からPostGISのgeometry/geographyを使う。

## 5. コアERD（論理）
### auth / tenancy
- profiles
- workspaces
- workspace_members
- organizations
- organization_members
- workspace_organizations

### supply graph
- sites
- organization_sites
- workspace_sites
- materials
- processes
- supply_relationships
- supply_edges
- supply_edge_materials

### assessments / leap
- assessments
- assessment_scopes
- nature_topics
- dependencies
- impacts
- risk_register
- opportunity_register
- risk_scores
- monitoring_rules
- monitoring_events

### external sources / ingestion
- data_sources
- source_versions
- source_assets
- ingestion_runs
- source_observations
- spatial_layers
- spatial_intersections

### evidence / audit
- evidence_items
- evidence_links
- change_log
- review_tasks
- disclosures

## 6. 初期テーブル（必須）
### profiles
- id uuid pk references auth.users
- full_name text
- avatar_url text
- created_at timestamptz

### workspaces
- id uuid pk
- name text not null
- slug text unique not null
- plan_code text not null default 'starter'
- primary_buyer_org_id uuid null
- settings jsonb not null default '{}'
- created_at timestamptz

### workspace_members
- id uuid pk
- workspace_id uuid fk
- user_id uuid fk
- role text check in ('owner','admin','analyst','reviewer','supplier_manager','viewer')
- status text check in ('invited','active','disabled')
- created_at timestamptz
- unique(workspace_id, user_id)

### organizations
- id uuid pk
- legal_name text not null
- display_name text not null
- org_type text check in ('buyer','supplier','customer','partner','logistics','internal')
- country_code text
- website text
- external_refs jsonb not null default '{}'
- created_at timestamptz

### organization_members
- id uuid pk
- organization_id uuid fk
- user_id uuid fk
- role text check in ('org_owner','org_admin','contributor','viewer')
- share_default boolean not null default false
- created_at timestamptz
- unique(organization_id, user_id)

### workspace_organizations
- id uuid pk
- workspace_id uuid fk
- organization_id uuid fk
- relationship_role text check in ('buyer','supplier','customer','partner','site_owner')
- tier integer null
- status text check in ('invited','active','archived')
- verification_status text check in ('inferred','declared','verified')
- invited_by uuid null
- created_at timestamptz
- unique(workspace_id, organization_id, relationship_role)

### sites
- id uuid pk
- site_name text not null
- site_type text check in ('office','factory','warehouse','farm','mine','port','project_site','store','unknown')
- country_code text
- region text
- locality text
- address_text text
- latitude double precision
- longitude double precision
- geom gis.geography(point,4326) null
- geocode_precision text check in ('country','region','city','address','parcel','manual')
- verification_status text check in ('inferred','declared','verified')
- created_at timestamptz

### organization_sites
- id uuid pk
- organization_id uuid fk
- site_id uuid fk
- ownership_role text check in ('owner','operator','tenant','supplier_site','customer_site')
- is_primary boolean not null default false
- valid_from date null
- valid_to date null
- unique(organization_id, site_id, ownership_role)

### workspace_sites
- id uuid pk
- workspace_id uuid fk
- site_id uuid fk
- workspace_organization_id uuid null fk
- scope_role text check in ('own_operation','upstream','downstream','logistics','portfolio_asset')
- tier integer null
- criticality numeric(5,2) not null default 0
- verification_status text check in ('inferred','declared','verified')
- created_at timestamptz
- unique(workspace_id, site_id, scope_role, coalesce(tier,0))

### materials
- id uuid pk
- name text not null
- category text
- hs_code text null
- description text null
- unique(name, coalesce(hs_code,''))

### processes
- id uuid pk
- process_code text unique not null
- name text not null
- process_group text not null
- description text null

### supply_relationships
- id uuid pk
- workspace_id uuid fk
- from_workspace_org_id uuid fk
- to_workspace_org_id uuid fk
- relationship_type text check in ('supplies','manufactures_for','ships_for','sells_to','owns')
- tier integer null
- verification_status text check in ('inferred','declared','verified')
- confidence_score numeric(5,2) not null default 0
- source_type text check in ('manual','csv','api','survey','inference')
- created_at timestamptz

### supply_edges
- id uuid pk
- workspace_id uuid fk
- relationship_id uuid fk
- from_site_id uuid null fk
- to_site_id uuid null fk
- process_id uuid null fk
- flow_direction text check in ('upstream','downstream')
- annual_volume numeric null
- annual_spend numeric null
- currency_code text null
- verification_status text check in ('inferred','declared','verified')
- created_at timestamptz

### supply_edge_materials
- id uuid pk
- supply_edge_id uuid fk
- material_id uuid fk
- share_ratio numeric(5,4) null
- is_critical boolean not null default false
- created_at timestamptz

### data_sources
- id uuid pk
- source_key text unique not null
- source_name text not null
- category text check in ('protected_area','kba','water','forest','land_cover','species','climate','custom')
- license_type text
- access_mode text check in ('manual','api','file','customer_provided')
- vendor_name text null
- config jsonb not null default '{}'
- is_active boolean not null default true
- created_at timestamptz

### source_versions
- id uuid pk
- data_source_id uuid fk
- version_label text not null
- released_at timestamptz null
- loaded_at timestamptz not null default now()
- checksum text null
- metadata jsonb not null default '{}'

### ingestion_runs
- id uuid pk
- data_source_id uuid fk
- source_version_id uuid null fk
- status text check in ('queued','running','succeeded','failed','partial')
- started_at timestamptz
- completed_at timestamptz null
- stats jsonb not null default '{}'
- error_message text null

### source_observations
- id uuid pk
- source_version_id uuid fk
- external_id text null
- entity_type text check in ('site','organization','region','species','protected_area','layer_cell')
- raw_payload jsonb not null
- normalized_payload jsonb not null
- observed_at timestamptz not null default now()

### spatial_intersections
- id uuid pk
- workspace_site_id uuid fk
- data_source_id uuid fk
- source_version_id uuid fk
- intersection_type text check in ('contains','within','intersects','nearby','same_region')
- distance_m numeric null
- area_overlap_m2 numeric null
- severity_hint numeric(5,2) null
- raw_result jsonb not null default '{}'
- created_at timestamptz

### assessments
- id uuid pk
- workspace_id uuid fk
- assessment_cycle text not null
- method_version text not null
- status text check in ('draft','active','archived')
- started_at date null
- closed_at date null
- created_by uuid null
- created_at timestamptz

### assessment_scopes
- id uuid pk
- assessment_id uuid fk
- scope_type text check in ('workspace','organization','site','material','relationship')
- workspace_organization_id uuid null fk
- workspace_site_id uuid null fk
- material_id uuid null fk
- relationship_id uuid null fk
- coverage_status text check in ('inferred','declared','verified')

### nature_topics
- id uuid pk
- topic_key text unique not null
- name text not null
- topic_group text check in ('land','freshwater','marine','species','pollution','climate_interaction')

### dependencies
- id uuid pk
- assessment_scope_id uuid fk
- nature_topic_id uuid fk
- dependency_level text check in ('low','medium','high','unknown')
- rationale jsonb not null default '{}'
- source_type text check in ('template','manual','model','external_source')
- created_at timestamptz

### impacts
- id uuid pk
- assessment_scope_id uuid fk
- nature_topic_id uuid fk
- impact_direction text check in ('negative','positive','mixed','unknown')
- impact_level text check in ('low','medium','high','unknown')
- rationale jsonb not null default '{}'
- source_type text check in ('template','manual','model','external_source')
- created_at timestamptz

### risk_register
- id uuid pk
- assessment_scope_id uuid fk
- risk_type text check in ('physical','transition','systemic','reputational','legal','market')
- title text not null
- description text not null
- status text check in ('open','accepted','mitigating','closed')
- owner_user_id uuid null
- created_at timestamptz

### risk_scores
- id uuid pk
- risk_id uuid fk
- severity numeric(5,2) not null
- likelihood numeric(5,2) not null
- velocity numeric(5,2) null
- detectability numeric(5,2) null
- final_score numeric(6,2) generated always as (severity * likelihood) stored
- score_components jsonb not null default '{}'
- scored_at timestamptz not null default now()

### monitoring_rules
- id uuid pk
- workspace_id uuid fk
- target_type text check in ('site','organization','material','relationship')
- target_id uuid not null
- rule_type text check in ('source_refresh','threshold','missing_evidence','review_due')
- config jsonb not null default '{}'
- is_active boolean not null default true
- last_run_at timestamptz null
- created_at timestamptz

### monitoring_events
- id uuid pk
- monitoring_rule_id uuid fk
- status text check in ('open','acknowledged','resolved','ignored')
- severity text check in ('info','warning','critical')
- title text not null
- payload jsonb not null default '{}'
- triggered_at timestamptz not null default now()
- resolved_at timestamptz null

### evidence_items
- id uuid pk
- workspace_id uuid fk
- organization_id uuid null fk
- site_id uuid null fk
- storage_bucket text not null
- storage_path text not null
- file_name text not null
- mime_type text not null
- file_size_bytes bigint not null
- sha256 text null
- evidence_type text check in ('invoice','certificate','survey','report','map','contract','screenshot','other')
- visibility text check in ('workspace_private','shared_to_buyers','org_private')
- uploaded_by uuid null
- created_at timestamptz

### evidence_links
- id uuid pk
- evidence_item_id uuid fk
- target_type text check in ('workspace_org','site','relationship','assessment','risk','monitoring_event')
- target_id uuid not null
- note text null
- linked_at timestamptz not null default now()

### change_log
- id uuid pk
- workspace_id uuid fk
- actor_user_id uuid null
- target_table text not null
- target_id uuid not null
- action text check in ('insert','update','delete','status_change','share','unshare')
- before_state jsonb null
- after_state jsonb null
- created_at timestamptz not null default now()

### disclosures
- id uuid pk
- workspace_id uuid fk
- assessment_id uuid fk
- framework text check in ('tnfd','csrd','internal')
- section_key text not null
- content_md text not null default ''
- source_snapshot jsonb not null default '{}'
- status text check in ('draft','review','approved','published')
- created_at timestamptz not null default now()

## 7. RLS方針
- `workspaces`, `workspace_members`, `workspace_organizations`, `workspace_sites`, `supply_relationships`, `assessments`, `risk_register`, `evidence_items` などは workspace membership ベースでRLS。
- `organizations`, `sites` は原則 service role 経由で作成/マージし、通常ユーザーは対応する workspace 経由の共有分のみ閲覧。
- supplier user は `organization_members` に属する自社 organization と、その organization に紐づく shared data のみ編集可能。
- canonical masterのマージはUIから直接させず、admin workflowで対応。

## 8. 初期MVPで実装する画面
1. ログイン / 招待受諾
2. ワークスペース切替
3. 組織一覧（buyer / supplier）
4. サイト一覧・地図
5. CSVアップロード（organizations, sites, relationships）
6. 一次スクリーニング結果一覧
7. LEAPボード（Locate / Evaluate / Assess / Prepare）
8. リスク登録簿
9. 証憑アップロード/紐付け
10. モニタリングイベント一覧

## 9. 初期API/Server Actions
- createWorkspace
- inviteWorkspaceMember
- createOrganization
- linkOrganizationToWorkspace
- upsertSite
- importCsvBatch
- createSupplyRelationship
- runScreeningForWorkspace
- recomputeRiskForAssessment
- uploadEvidence
- createDisclosureDraft

## 10. ジョブ設計
- `pgmq` queue: `ingestion_jobs`, `screening_jobs`, `risk_jobs`, `notification_jobs`
- Vercel Cron:
  - daily: source refresh check
  - daily: stale evidence reminders
  - weekly: monitoring recompute
- Supabase Edge Functions:
  - ingest-source
  - recompute-risk
  - supplier-reminder

## 11. Claude Codeに入れるプロジェクトルール（CLAUDE.md要約）
- SQL migrations を唯一のDBソースオブトゥルースにする
- Prismaを導入しない
- テーブル追加時は必ずRLS policy / indexes / updated_at trigger / audit hookをセットで考える
- `public` schemaに置くものと `private` schemaに置くものを分ける
- Vercel上で動くフロントとSupabase側の責務を分離する
- ドメインモデルを壊す破壊的リネームは migration で段階移行する
- UIは shadcn/ui + Tailwind で統一
- テストは少なくとも: schema smoke / auth / import / screening / evidence upload

## 12. Claude Codeへ投げる順番
### Prompt 1: リポジトリ雛形
「このリポジトリを Next.js App Router + TypeScript + Tailwind + Supabase SSR 前提で初期化してください。Supabase CLI migrations を前提にし、`supabase/` ディレクトリ、`CLAUDE.md`、`.claude/settings.json`、`vercel.json`、`.env.example`、`README.md` を作ってください。DBの真実は SQL migration とし、Prisma は使わないでください。shadcn/ui を導入し、認証済みダッシュボードの空画面まで作成してください。完了後に変更ファイル一覧、起動コマンド、未解決事項をまとめてください。」

### Prompt 2: 初期DB migration
「以下の論理モデルに沿って、Supabase migration を作成してください: workspaces, workspace_members, organizations, organization_members, workspace_organizations, sites, organization_sites, workspace_sites, materials, processes, supply_relationships, supply_edges, supply_edge_materials, data_sources, source_versions, ingestion_runs, source_observations, spatial_intersections, assessments, assessment_scopes, nature_topics, dependencies, impacts, risk_register, risk_scores, monitoring_rules, monitoring_events, evidence_items, evidence_links, change_log, disclosures。uuid pk, created_at, updated_at, soft deleteが必要なものには deleted_at を追加し、必須indexとRLS policyも作ってください。PostGIS, pgvector, pgmq を有効化し、必要な helper functions と triggers を追加してください。最後にERD要約を docs/data-model.md に出力してください。」

### Prompt 3: 認証とマルチテナント
「Supabase Auth + @supabase/ssr を使い、メールログイン/招待ベースで `workspace_members` と `organization_members` による認可を実装してください。middleware.ts と server-side helper を整備し、workspace context を URL ベース(`/app/[workspaceSlug]/...`)にしてください。RLSが成立するように、service roleを使う箇所と使わない箇所を分離してください。」

### Prompt 4: 組織・拠点・サプライチェーングラフ
「organizations, sites, workspace_organizations, workspace_sites, supply_relationships, supply_edges を操作する UI と server actions を作ってください。まずは一覧、詳細、作成、編集、CSV import を実装し、Tier 表示と verification_status（inferred/declared/verified）を必ずUIで見えるようにしてください。地図は site の lat/lng を表示できる最小構成で構いません。」

### Prompt 5: 外部データソース土台
「data_sources, source_versions, ingestion_runs, source_observations, spatial_intersections を使う ingestion framework を作ってください。まだ実データ連携は最小でよいので、サンプルのGeoJSON/CSVを読み込み、site と spatial join して `spatial_intersections` に保存するジョブを実装してください。ジョブは pgmq に投入し、Supabase Edge Function で処理してください。」

### Prompt 6: LEAP画面
「LEAPの4フェーズを `Locate / Evaluate / Assess / Prepare` の4タブで実装してください。Locateは site×source intersection、Evaluateは dependency/impact 仮説、Assessは risk register と risk_scores、Prepareは disclosure draft と monitoring rules を扱います。最初は業界テンプレートを製造業向けにハードコードして構いませんが、後でDB化しやすい構造にしてください。」

### Prompt 7: 証憑・監査証跡
「Supabase Storage を使って evidence upload を実装してください。evidence_items と evidence_links を作成・一覧・紐付けできるUIを作り、change_log に主要操作を append-only で残してください。RLSで workspace private と shared_to_buyers を制御してください。」

### Prompt 8: モニタリング
「monitoring_rules, monitoring_events と Vercel Cron を使って、定期再計算の仕組みを実装してください。vercel.json に cron を定義し、Vercel Function から Supabase Edge Function もしくは内部APIを呼んで、stale evidence と source refresh と risk recompute の3種類を回してください。」

### Prompt 9: GitHub品質
「GitHubにpushして共同開発できる品質に整えてください。README、セットアップ手順、ERD要約、環境変数一覧、lint/typecheck/test コマンド、seed 手順、サンプルCSV を追加し、CI 用に lint/typecheck/test を回す GitHub Actions を作成してください。さらに Claude Code が読みやすいように CLAUDE.md に開発ルールを要約してください。」

## 13. Claude Codeに最初に渡すべきコンテキスト
- プロダクト概要
- ターゲット顧客: バイヤー企業のサステナ・調達・リスク管理部門
- サプライヤーポータルも将来必要
- TierNの可視化が必要
- 初期は製造業向けデフォルト
- 多言語化を将来考慮（日本語UI優先）
- 監査証跡が重要
- 外部データソースはあとからどんどん追加
- DBは長期運用に耐えること
- GitHubへそのままpushできること

## 14. 今すぐ避けること
- 最初からベンダーごとのデータモデルを埋め込むこと
- UI先行でDBを後付けすること
- Prismaを真実のソースにすること
- supplier shared profile と buyer private notes を同じ列に置くこと
- TierNを全量verified前提で設計すること
- 外部データの生payloadを業務テーブルに直接混ぜること

## 15. 追加で決めると精度が上がる項目
- 初期対象業界: 製造 / 食品 / 化学 / 建設 / 不動産
- 初期対応言語: 日本語のみか、英語併記か
- 最初の外部データソース1〜3個
- 招待フロー: バイヤー主導のみか、サプライヤー自己登録も可か
- 顧客契約型データ（IBAT等）を初期から扱うか
