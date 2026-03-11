# Cocolog

AI-powered communication coaching platform. Integrates with Slack to analyze communication patterns and generate weekly coaching digests.

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- **Auth**: Supabase Auth (`@supabase/ssr`)
- **Database**: Supabase Postgres + Row-Level Security
- **AI**: Anthropic Claude API
- **Messaging**: Slack Events API
- **Error Tracking**: Sentry (optional)
- **Hosting**: Vercel
- **CI**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- A Supabase project
- An Anthropic API key
- A Slack app (for integration)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Fill in your values in .env.local

# Start Supabase locally (optional)
pnpm db:start

# Push migrations
pnpm db:push

# Generate types
pnpm generate:types

# Start development server
pnpm dev
```

### Environment Variables

See `.env.example` for all required variables.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Run Vitest tests |
| `pnpm generate:types` | Generate Supabase TypeScript types |
| `pnpm db:start` | Start local Supabase |
| `pnpm db:push` | Push migrations to Supabase |
| `pnpm db:reset` | Reset database |

## Architecture

See [docs/architecture.md](docs/architecture.md) for full architecture documentation.

See [docs/data-model.md](docs/data-model.md) for database schema details.

## Key Design Principles

- **Privacy by design**: Message bodies are never persisted. Only hashes, references, and AI-generated scores are stored.
- **Multi-tenant**: All data is org-scoped with RLS enforcement.
- **Extensible signals**: New communication signals can be added via taxonomy versioning without schema changes.
- **Model versioning**: All AI outputs reference the model and prompt version that produced them.
- **Slack first, Teams later**: Provider abstraction via `identity_links` and `message_refs` makes adding new integrations straightforward.

## Deployment

Deploy to Vercel:

```bash
vercel deploy
```

## 本番デプロイチェックリスト

### 1. Vercel環境変数

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-roleキー（サーバー専用） |
| `SLACK_CLIENT_ID` | Slack App クライアントID（Bot OAuth） |
| `SLACK_CLIENT_SECRET` | Slack App クライアントシークレット |
| `SLACK_SIGNING_SECRET` | Slack App 署名シークレット |
| `SLACK_OIDC_CLIENT_ID` | Slack OIDC クライアントID（Sign in with Slack） |
| `SLACK_OIDC_CLIENT_SECRET` | Slack OIDC クライアントシークレット |
| `ANTHROPIC_API_KEY` | Anthropic APIキー |
| `CRON_SECRET` | Cronジョブ認証トークン（任意の安全な文字列） |
| `NEXT_PUBLIC_APP_URL` | アプリの公開URL（例: https://cocolog.vercel.app） |

### 2. Supabase設定

- Supabaseプロジェクトをリンク: `supabase link --project-ref <ref>`
- マイグレーション適用: `supabase db push`
- Auth > Providers > Slack (OIDC) を有効化し、Client ID/Secretを設定
- Auth > URL Configuration > Redirect URLsに `https://<your-domain>/auth/callback` を追加

### 3. Slack App設定

- **OAuth & Permissions** のRedirect URLに `https://<your-domain>/api/slack/oauth/callback` を追加
- **Bot Token Scopes**: `channels:history`, `channels:read`, `chat:write`, `users:read`, `users:read.email`
- **Event Subscriptions**: Request URLに `https://<your-domain>/api/slack/events` を設定
- **Subscribe to Bot Events**: `message.channels`
- Sign in with Slack用のOIDC設定（同一Appでも別Appでも可）

### 4. Vercel Cronジョブ

`vercel.json`に定義済み（Vercel Proプラン必須）:

| Cron | スケジュール | 説明 |
|------|------------|------|
| `/api/cron/daily-rollup` | 毎日03:00 UTC | 日次メトリクス集計 |
| `/api/cron/analyze-pending` | 15分毎 | 未分析メッセージの分析 |
| `/api/cron/weekly-digest` | 月曜06:00 UTC | 週次コーチングダイジェスト生成+DM送信 |
| `/api/cron/retry-pending-events` | 30分毎 | 失敗イベントのリトライ |

全Cronエンドポイントは `Authorization: Bearer $CRON_SECRET` ヘッダーで保護されています。

### 5. CI/CD

GitHub Actionsワークフロー (`.github/workflows/ci.yml`):
- `pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm build`
- PRでの新規マイグレーションファイル検知
