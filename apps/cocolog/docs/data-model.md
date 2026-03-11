# Data Model

## Schema Overview

Cocolog uses a **7-schema** Postgres design for clear separation of concerns:

| Schema | Purpose | Client Access |
|--------|---------|---------------|
| `public` | User-facing tables, auth, RLS | anon, authenticated, service_role |
| `integrations` | Provider connections, webhooks, message refs | service_role only |
| `ai` | Taxonomy, model versions, analyses, coaching runs | service_role only |
| `analytics` | Pre-aggregated daily/weekly metrics | service_role only |
| `billing` | Subscriptions, seat snapshots | service_role only |
| `ops` | Job tracking, idempotency keys | service_role only |
| `audit` | Immutable event log | service_role only |

Non-public schemas are accessible only via the **service_role** (admin) client. Dashboard pages use **public views** (`v_my_installations`, `v_person_weekly_metrics`, `v_org_weekly_metrics`) to surface non-public data with RLS filtering.

## Why `people` and `profiles` Are Separate

| | `profiles` | `people` |
|-|-----------|----------|
| **Represents** | App users who log in | Analysis subjects (Slack users being analyzed) |
| **Auth** | Tied to `auth.users` via PK | No auth relationship |
| **Creation** | Auto-created on signup via trigger | Created when first message is seen |
| **Count** | Small (admins, managers) | Large (everyone in monitored Slack channels) |
| **Example** | Engineering manager viewing dashboards | Developer whose messages are analyzed |

A `profile` may never appear in `people` (if they don't write monitored messages). Most `people` will never have a `profile` (they're not app users). The `memberships` table links `profiles` to `organizations`; the `identity_links` table links `people` to external provider IDs.

## Entity Relationship Summary

```
auth.users ──1:1──> profiles ──M:N──> organizations
                                          |
                    people <──1:M─────────+
                      |
                      +──1:M──> identity_links (provider, user_id, team_id)
                      +──1:M──> integrations.message_refs
                      +──1:M──> analytics.person_daily_metrics
                      +──1:M──> analytics.person_weekly_metrics
                      +──1:M──> weekly_digests
                                    |
                                    +──M:1──> ai.coaching_runs ──M:1──> ai.model_versions

organizations ──1:M──> integrations.connections ──1:1──> integrations.installations
                                |
                                +──1:M──> integrations.external_users
                                +──1:M──> integrations.external_channels
                                +──1:M──> integrations.webhook_events
                                +──1:M──> integrations.message_refs ──1:1──> ai.message_analyses
                                                                    +──1:1──> integrations.message_content_secure (ephemeral)
```

## Schema Details

### public (8 tables)

- **organizations** — Multi-tenant root. All data is org-scoped.
- **profiles** — App users (PK = `auth.users.id`). Auto-created on signup.
- **memberships** — Profiles <-> Organizations (roles: owner, admin, member).
- **people** — Analysis subjects. Created from Slack user info on first message.
- **identity_links** — Maps people to external provider identities (Slack user ID, Teams user ID).
- **user_settings** — Per-profile preferences (timezone, locale, digest day, notifications).
- **goals** — Signal improvement targets. `person_id = null` means org-wide goal.
- **weekly_digests** — User-facing coaching digest. References `ai.coaching_runs` for provenance.

### integrations (7 tables)

- **connections** — Provider-agnostic connection record (one per org per provider).
- **installations** — Provider-specific details (Slack bot token, team info). 1:1 with connection.
- **external_users** — Cached external user profiles (display name, avatar, email).
- **external_channels** — Monitored channels with `is_monitored` toggle.
- **webhook_events** — Inbound webhook event queue with status tracking and retry support.
- **message_refs** — Message metadata (hash, permalink, timestamp). **Never stores message body.**
- **message_content_secure** — Ephemeral encrypted message body. Purged after AI analysis (default TTL: 1 hour).

### ai (4 tables)

- **taxonomy_versions** — Versioned signal definitions (JSONB). Currently v1.0 with 5 signals: clarity, empathy, constructiveness, responsiveness, professionalism.
- **model_versions** — Model name + prompt hash for reproducibility and A/B testing.
- **message_analyses** — One row per analyzed message. `scores` column stores all signals as JSONB: `{ "clarity": {"value": 0.85, "confidence": 0.9}, ... }`.
- **coaching_runs** — Processing artifact for digest generation. Tracks status, latency, errors.

### analytics (3 tables)

- **person_daily_metrics** — Daily aggregation per person. `metrics` column: `{ "clarity": {"avg": 0.8, "min": 0.5, "max": 1.0, "sum": 4.0, "count": 5}, ... }`.
- **person_weekly_metrics** — Weekly aggregation with `prev_week_metrics` for delta calculation.
- **org_weekly_metrics** — Org-level weekly rollup with active people count.

### billing (2 tables)

- **subscriptions** — Stripe integration (customer ID, subscription ID, plan, status, seat limit).
- **seat_snapshots** — Daily snapshot of seat usage for billing reconciliation.

### ops (2 tables)

- **job_runs** — Cron job tracking (name, status, started_at, completed_at, error).
- **idempotency_keys** — Deduplication keys with TTL (default: 24 hours).

### audit (1 table)

- **event_log** — Immutable log of significant actions (installs, config changes, etc.).

## Public Views

| View | Joins | Purpose |
|------|-------|---------|
| `v_my_installations` | connections + installations | Dashboard: show connected integrations |
| `v_person_weekly_metrics` | person_weekly_metrics + people | Dashboard: person-level weekly stats |
| `v_org_weekly_metrics` | org_weekly_metrics + organizations | Dashboard: org-level weekly stats |

All views use `security_barrier = true` and filter by `get_user_org_ids()`.

## Helper Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_user_org_ids()` | `setof uuid` | Get org IDs for the current authenticated user |
| `is_org_admin(org_id)` | `boolean` | Check if current user is owner/admin of the given org |
| `ops.purge_expired_content()` | `integer` | Delete expired ephemeral message bodies |

## Enums

| Enum | Schema | Values |
|------|--------|--------|
| `membership_role_enum` | public | owner, admin, member |
| `plan_tier_enum` | public | free, pro, enterprise |
| `provider_enum` | public | slack, teams, email |
| `goal_direction_enum` | public | up, down |
| `connection_status_enum` | integrations | active, revoked, expired |
| `webhook_event_status_enum` | integrations | pending, processing, processed, failed, skipped |
| `signal_value_type_enum` | ai | numeric, boolean, categorical |
| `run_status_enum` | ai | pending, running, completed, failed |
| `subscription_status_enum` | billing | trialing, active, past_due, canceled, paused |
| `job_status_enum` | ops | pending, running, completed, failed |
