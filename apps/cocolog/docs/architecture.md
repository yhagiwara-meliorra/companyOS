# Architecture

## Overview

Cocolog is an AI-powered communication coaching platform. It integrates with Slack (and eventually Microsoft Teams) to analyze communication patterns and provide weekly coaching digests.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS v4 |
| Auth | Supabase Auth via `@supabase/ssr` |
| Database | Supabase Postgres with RLS |
| AI | Anthropic Claude API |
| Messaging | Slack Events API (Teams planned) |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

## Key Design Decisions

### Multi-Tenancy
- All data is scoped to an `organization`.
- Users (`profiles`) join organizations via `memberships` with roles: `owner`, `admin`, `member`.
- RLS policies enforce org-scoping at the database level.

### No Message Body Storage
- **Privacy by design**: Message bodies are NEVER persisted.
- We store only: message references, content hashes (SHA-256), Slack permalinks, timestamps, and channel metadata.
- Message text is passed transiently to Claude for analysis, then discarded.
- Only the resulting signal scores and aggregates are stored.

### Signal Taxonomy Versioning
- Signal definitions are versioned via `taxonomy_versions` and `signal_types`.
- New signals can be added in a new taxonomy version without schema changes.
- Rollups and digests reference their taxonomy version for reproducibility.

### Model Versioning
- Every AI analysis records which `model_version` (model name + prompt hash) produced the result.
- This enables A/B testing and tracking prompt improvements over time.

### Provider Abstraction
- `identity_links` maps external identities (Slack user IDs, Teams user IDs) to internal `people`.
- `message_refs` uses `provider` field to distinguish message sources.
- Adding Teams later requires: a new identity link provider, a new webhook handler, and no schema changes.

## Data Flow

```
Slack Message Event
  → Webhook handler (POST /api/slack/events)
  → Verify signature
  → Find/create person via identity_links
  → Store message_ref (hash + metadata, NO body)
  → [async] Analyze message via Claude → signal_scores
  → [daily cron] Aggregate into daily_rollups
  → [weekly cron] Aggregate into weekly_rollups
  → [weekly cron] Generate coaching_digest via Claude
  → Users view digests in the dashboard
```

## Folder Structure

```
src/
  app/
    (auth)/login/        # Auth pages
    (dashboard)/         # Authenticated app
      dashboard/         # Main dashboard
        people/          # People management
        digests/         # Coaching digests
          [id]/          # Individual digest detail
        settings/        # Org settings, integrations
    api/
      slack/
        events/          # Slack event webhook
        oauth/           # OAuth start + callback
      cron/              # Vercel cron endpoints
      health/            # Health check endpoint
    auth/callback/       # Supabase auth callback
  components/
    ui/                  # Button, Badge, Card, Input, Select
    layout/              # TopNav
    tables/              # DataTable
  lib/
    supabase/            # client, server, admin, middleware
    claude/              # analyze, digest
    slack/               # client, verify
    validations/         # Zod schemas
    env.ts               # Runtime env validation (Zod)
  types/
    database.ts          # Supabase generated types
  instrumentation.ts     # Sentry instrumentation
  __tests__/             # Vitest tests
supabase/
  migrations/            # SQL migration files
  config.toml            # Supabase CLI config
```

## Security

- **RLS everywhere**: All browser-accessible tables have row-level security policies.
- **Service role only on server**: `createAdminClient()` is used only in API routes and server-only code.
- **Slack signature verification**: All webhook requests are cryptographically verified.
- **Cron auth**: Cron endpoints require `CRON_SECRET` bearer token.
- **Sensitive data**: Bot tokens are stored encrypted at rest (Supabase Vault recommended for production).

## Scaling Considerations

- Daily/weekly rollup aggregation keeps query costs predictable regardless of message volume.
- Signal scores are append-only and can be partitioned by date if needed.
- Coaching digest generation is rate-limited by Claude API and runs in the weekly cron with `maxDuration: 300`.
