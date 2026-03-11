# TerraLink セットアップガイド

本番環境（Supabase + Vercel + Resend）の構築手順です。

---

## 前提条件

- Node.js 20+
- pnpm
- Git
- Supabase CLI (`npm i -g supabase`)
- Vercel CLI (`npm i -g vercel`)

---

## 1. Supabase プロジェクト作成

### 1-1. プロジェクトを作成

1. https://supabase.com/dashboard で **New Project** をクリック
2. プロジェクト名: `terralink`（任意）
3. リージョン: Tokyo (`ap-northeast-1`) 推奨
4. データベースパスワードを控えておく

### 1-2. API キーを取得

**Settings → API** ページから以下を取得：

| キー | 説明 | 環境変数名 |
|------|------|-----------|
| Project URL | `https://xxxxx.supabase.co` | `NEXT_PUBLIC_SUPABASE_URL` |
| anon / public | RLS 適用クライアント用 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| service_role | RLS バイパス（サーバー専用） | `SUPABASE_SERVICE_ROLE_KEY` |

### 1-3. マイグレーションを適用

```bash
# Supabase CLI でリモートプロジェクトにリンク
supabase link --project-ref <project-ref>

# マイグレーションを実行
supabase db push
```

14 本のマイグレーションが順番に適用されます：

| # | ファイル | 内容 |
|---|---------|------|
| 1 | `_extensions.sql` | PostGIS / pgmq 拡張 |
| 2 | `_helpers.sql` | トリガー / 監査関数 |
| 3 | `_auth_tenancy.sql` | プロファイル / WS / 組織テーブル |
| 4 | `_rls_helpers.sql` | RLS チェック関数 |
| 5 | `_supply_graph.sql` | サプライチェーンテーブル |
| 6 | `_external_sources.sql` | 外部データソース |
| 7 | `_assessments_leap.sql` | LEAP アセスメント |
| 8 | `_evidence_audit.sql` | 証憑 / 監査ログ |
| 9 | `_rls_policies.sql` | バイヤー側 RLS ポリシー |
| 10 | `_pgmq_queues.sql` | メッセージキュー |
| 11 | `_fix_profiles_rls.sql` | プロファイル RLS 修正 |
| 12 | `_ingestion_framework.sql` | 空間スクリーニング RPC |
| 13 | `_seed_nature_topics.sql` | 自然トピックシードデータ |
| 14 | `_storage_evidence_bucket.sql` | Storage バケット設定 |
| 15 | `_supplier_rls.sql` | サプライヤーポータル RLS + Realtime publication |

### 1-4. Realtime を有効化

Supabase Dashboard → **Database → Replication** で以下のテーブルの Realtime を確認：

- `monitoring_events` — アラート通知
- `change_log` — アクティビティフィード
- `monitoring_rules` — ルール変更

マイグレーション `20260310000004_supplier_rls.sql` で自動設定済みですが、
ダッシュボードで確認してください。

### 1-5. Storage バケット

マイグレーションで `evidence-uploads` バケットが自動作成されます。
追加で `ingestion-data` バケットを手動作成してください：

1. **Storage → New Bucket**
2. Name: `ingestion-data`
3. Public: No
4. File size limit: 50 MB

---

## 2. Vercel デプロイ

### 2-1. プロジェクトをインポート

```bash
cd apps/TerraLink
vercel
```

- Framework: Next.js（自動検出）
- Root Directory: `apps/TerraLink`（monorepo の場合）

### 2-2. 環境変数を設定

Vercel Dashboard → **Settings → Environment Variables** に以下を設定：

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
CRON_SECRET=<openssl rand -hex 32 で生成>
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_xxxxx
EMAIL_FROM=TerraLink <noreply@yourdomain.com>
EMAIL_ENABLED=true
```

### 2-3. Cron ジョブ

`vercel.json` で自動設定済み：

```json
{
  "crons": [
    {
      "path": "/api/cron/monitor",
      "schedule": "0 * * * *"
    }
  ]
}
```

毎時 0 分にモニタリングルールを実行し、アラートを検知したら
ワークスペース管理者にメールダイジェストを送信します。

**注意**: Vercel Cron は Pro プラン以上で利用可能です。

### 2-4. デプロイ

```bash
vercel --prod
```

---

## 3. Supabase Edge Function デプロイ

### 3-1. Edge Function をデプロイ

```bash
# Edge Function をデプロイ
supabase functions deploy ingest-source --project-ref <project-ref>
```

### 3-2. Edge Function の環境変数（シークレット）

```bash
# Supabase Edge Functions に環境変数を設定
supabase secrets set \
  SUPABASE_URL=https://xxxxx.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3-3. Edge Function の呼び出し方法

2 つの呼び出し方法があります：

**A. キューモード（推奨）**
```
POST /api/ingestion/trigger
Body: { "dataSourceId": "uuid", "workspaceId": "uuid", "mode": "queue" }
```
pgmq キューにメッセージを追加し、Edge Function がポーリングします。

**B. ダイレクトモード**
```
POST /api/ingestion/trigger
Body: { "dataSourceId": "uuid", "workspaceId": "uuid", "mode": "direct" }
```
Supabase Edge Function を直接 HTTP 呼び出しします。

---

## 4. Resend（メール通知）セットアップ

### 4-1. Resend アカウント作成

1. https://resend.com にアクセスしてサインアップ
2. **API Keys** ページで新しい API キーを作成
3. キーをコピー → `EMAIL_API_KEY` に設定

### 4-2. ドメイン認証（本番推奨）

1. **Domains** ページで送信元ドメインを追加
2. DNS レコード（SPF / DKIM / DMARC）を設定
3. 認証完了後、`EMAIL_FROM` をそのドメインに設定

```
EMAIL_FROM=TerraLink <noreply@yourdomain.com>
```

### 4-3. テスト

ドメイン認証前は Resend のテスト用アドレスで送信テスト可能：

```
EMAIL_FROM=TerraLink <onboarding@resend.dev>
```

### 4-4. 開発環境

開発時はメール送信を無効にしてログ出力のみにできます：

```
EMAIL_ENABLED=false
```

---

## 5. ローカル開発

### 5-1. 環境構築

```bash
# 依存関係インストール
pnpm install

# 環境変数ファイルをコピー
cp .env.example .env.local
# .env.local を編集してキーを設定

# Supabase ローカル起動
supabase start

# ローカル Supabase の URL / キーが表示される
# → .env.local に設定
```

### 5-2. 開発サーバー起動

```bash
pnpm dev
```

http://localhost:3000 でアプリが起動します。

### 5-3. Edge Function ローカル実行

```bash
supabase functions serve ingest-source
```

### 5-4. テスト実行

```bash
pnpm test
```

### 5-5. 型チェック / ビルド

```bash
npx tsc --noEmit
npx next build
```

---

## 6. Auth 設定（Supabase）

### 6-1. リダイレクト URL

Supabase Dashboard → **Auth → URL Configuration**:

- Site URL: `https://your-app.vercel.app`
- Redirect URLs:
  - `https://your-app.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`（開発用）

### 6-2. メール確認（オプション）

デフォルトではメール確認なしでサインアップ可能です。
本番では **Auth → Email** で `Enable email confirmations` を有効にしてください。

---

## 7. 本番チェックリスト

- [ ] Supabase プロジェクト作成済み
- [ ] マイグレーション適用済み (`supabase db push`)
- [ ] Realtime テーブル確認済み
- [ ] Storage バケット作成済み (`ingestion-data`)
- [ ] Vercel デプロイ済み
- [ ] 環境変数設定済み（Vercel）
- [ ] CRON_SECRET 生成・設定済み
- [ ] Edge Function デプロイ済み
- [ ] Edge Function シークレット設定済み
- [ ] Resend API キー取得・設定済み
- [ ] 送信元ドメイン DNS 認証済み
- [ ] Auth リダイレクト URL 設定済み
- [ ] Vercel Cron 動作確認済み
- [ ] テストメール送信確認済み

---

## 環境変数一覧

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role キー |
| `NEXT_PUBLIC_SITE_URL` | Yes | アプリの公開 URL |
| `CRON_SECRET` | Yes | Vercel Cron 認証シークレット |
| `EMAIL_PROVIDER` | No | `resend` / `sendgrid` / `log`（デフォルト: `log`） |
| `EMAIL_API_KEY` | No* | メールプロバイダの API キー（*`EMAIL_ENABLED=true` 時は必須） |
| `EMAIL_FROM` | No | 送信元アドレス（デフォルト: `TerraLink <noreply@terralink.app>`） |
| `EMAIL_ENABLED` | No | メール送信を有効化（デフォルト: `false`） |
