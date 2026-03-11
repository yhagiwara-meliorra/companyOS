# TerraLink

Biodiversity & supply-chain risk management SaaS built for the TNFD/CSRD era.

## Features

- **Multi-tenant workspaces** — buyer workspaces with RBAC (owner / admin / analyst / reviewer / supplier_manager / viewer)
- **Organization & site management** — organizations, sites with PostGIS geolocation, workspace-scoped views
- **Supply chain graph** — TierN visibility with inferred / declared / verified states, material tracking
- **External data sources** — ingestion framework with pgmq queues, spatial intersections (buffer analysis)
- **LEAP workflow** — 4-phase assessment: Locate / Evaluate / Assess / Prepare
- **Evidence vault** — file upload to Supabase Storage, evidence linking, visibility controls
- **Monitoring** — rule-based alerts (source refresh, thresholds, missing evidence, review due) with Vercel Cron
- **Audit trail** — append-only change_log for compliance

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui (new-york) |
| Auth | Supabase Auth (email + OAuth) |
| Database | Supabase Postgres + PostGIS + RLS |
| Storage | Supabase Storage (private buckets, signed URLs) |
| Queue | pgmq (Supabase-native message queue) |
| Deployment | Vercel |
| Cron | Vercel Cron Jobs |

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10
- Supabase CLI (`npx supabase`)
- Docker (for local Supabase)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env.local
# Fill in your Supabase credentials (see Environment Variables below)

# 3. Start local Supabase
npx supabase start

# 4. Push migrations
npx supabase db push

# 5. (Optional) Seed development data
npx supabase db reset   # Resets DB and runs seed.sql

# 6. Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm test` | Run tests (vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `npx supabase start` | Start local Supabase |
| `npx supabase stop` | Stop local Supabase |
| `npx supabase db push` | Push migrations to local DB |
| `npx supabase db reset` | Reset DB + run seed |
| `npx supabase migration new <name>` | Create new migration |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | Yes | App URL (e.g., `http://localhost:3000`) |
| `CRON_SECRET` | Prod | Secret for Vercel Cron authorization |

## Project Structure

```
app/                          # Next.js App Router
  (marketing)/                # Public landing pages
  (auth)/                     # Login / auth callback
  app/[workspaceSlug]/        # Authenticated workspace pages
    evidence/                 # Evidence vault
    leap/                     # LEAP assessment workflow
    monitor/                  # Monitoring dashboard
    orgs/                     # Organization management
    sites/                    # Site management
    sources/                  # External data sources
    supply/                   # Supply chain graph
    settings/                 # Workspace settings
  api/
    cron/monitor/             # Vercel Cron endpoint
components/
  ui/                         # shadcn/ui components
lib/
  auth/                       # Supabase auth helpers
  db/                         # Database utilities (admin client)
  domain/                     # Business logic (server actions)
  ingestion/                  # External data ingestion
  validation/                 # Zod schemas
supabase/
  migrations/                 # SQL migrations (schema source of truth)
  functions/                  # Edge Functions
  seed.sql                    # Dev seed data
samples/                      # Sample CSV files for import testing
```

## Database Schema (ERD Summary)

### Core Tenancy
- `profiles` — user profiles (synced from auth.users)
- `workspaces` — multi-tenant workspaces
- `workspace_members` — user-workspace with roles

### Organizations & Sites
- `organizations` — company records
- `sites` — physical locations (PostGIS geography)
- `workspace_organizations` / `workspace_sites` — workspace-scoped views

### Supply Chain
- `materials` — tracked materials/commodities
- `supply_relationships` — org-to-org supply links with tier depth
- `supply_materials` — materials per relationship

### External Data
- `data_sources` — external dataset metadata
- `raw_source_payloads` — canonical JSON payloads
- `spatial_intersections` — site-source spatial overlap results

### LEAP Assessment
- `assessments` — assessment instances
- `assessment_scopes` — scope entries (site/org)
- `nature_topics` — biodiversity topic taxonomy
- `nature_dependencies` / `nature_impacts` — dependency/impact records
- `nature_risks` — risk register
- `risk_scores` — risk scoring history
- `disclosure_sections` — TNFD/CSRD disclosure drafts

### Evidence & Audit
- `evidence_items` — uploaded files metadata
- `evidence_links` — evidence-entity links
- `change_log` — append-only audit trail

### Monitoring
- `monitoring_rules` — alert rule configuration
- `monitoring_events` — triggered alert events

## Migrations

Migrations are in `supabase/migrations/` and are the single source of truth.

| Migration | Description |
|---|---|
| `20260309000001_extensions` | PostGIS, pgcrypto, pgmq extensions |
| `20260309000002_helpers` | updated_at trigger function |
| `20260309000003_auth_tenancy` | profiles, workspaces, members |
| `20260309000004_rls_helpers` | is_workspace_member, has_workspace_role, is_org_member |
| `20260309000005_supply_graph` | organizations, sites, materials, supply chain |
| `20260309000006_external_sources` | data_sources, raw_source_payloads, spatial_intersections |
| `20260309000007_assessments_leap` | LEAP tables, monitoring, disclosures |
| `20260309000008_evidence_audit` | evidence_items, evidence_links, change_log |
| `20260309000009_rls_policies` | All RLS policies |
| `20260309000010_pgmq_queues` | pgmq queue creation |
| `20260309000011_fix_profiles_rls` | Profile RLS fix |
| `20260310000001_ingestion_framework` | Ingestion config table |
| `20260310000002_seed_nature_topics` | Nature topic taxonomy seed |
| `20260310000003_storage_evidence_bucket` | Supabase Storage bucket + policies |

## Sample Data

Sample CSV files for testing batch import are in `samples/`:
- `sample_organizations.csv` — organization import template
- `sample_sites.csv` — site import template with lat/lng
- `sample_supply_relationships.csv` — supply chain link import

## License

Proprietary — All rights reserved.
