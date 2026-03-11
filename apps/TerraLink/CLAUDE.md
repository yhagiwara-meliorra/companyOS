# Project rules for Claude Code

## Product
This repository is a biodiversity / supply-chain risk management SaaS called **TerraLink**.
The product supports:
- Buyer workspaces with role-based access (owner / admin / analyst / reviewer / supplier_manager / viewer)
- Supplier self-service profiles
- TierN visibility with inferred / declared / verified states
- LEAP workflow: Locate / Evaluate / Assess / Prepare
- Evidence vault with audit trail
- Monitoring with automated alerts (Vercel Cron)
- Extensible external data source ingestion (pgmq queues)

## Stack
- **Framework**: Next.js 16 App Router on Vercel (TypeScript)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`) + shadcn/ui (new-york style)
- **Auth**: Supabase Auth with `@supabase/ssr` (cookie-based)
- **Database**: Supabase Postgres + PostGIS + RLS
- **Storage**: Supabase Storage (private buckets, signed URLs)
- **Queue**: pgmq (Supabase-native)
- **Validation**: Zod v4 (`zod/v4` import path)
- **Package manager**: pnpm
- **Supabase SQL migrations are the single source of truth for the database**
- Do NOT introduce Prisma as the schema authority

## Key Architecture Patterns

### Auth & Data Access
- `createClient()` — browser/RSC client (uses anon key with RLS)
- `createAdminClient()` — service_role client (bypasses RLS, takes no arguments)
- Server actions pattern: `requireAuth()` + `createAdminClient()` + `resolveWorkspace()`
- RLS helper functions: `is_workspace_member(uuid)`, `has_workspace_role(uuid, text[])`, `is_org_member(uuid)`

### UI Components
- shadcn/ui Select component is **native HTML `<select>`**, NOT Radix UI Select
- Use native `<select>` + `<option>` elements, not SelectContent/SelectItem/SelectTrigger
- Standard select class: `"flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"`
- Dialog, DropdownMenu, Tabs etc. are Radix UI components (use normally)

### Zod v4
- `z.record()` requires TWO arguments: `z.record(z.string(), z.unknown())`
- Import from `zod` (not `zod/v4`)

### Data Patterns
- Verification status: `inferred` / `declared` / `verified`
- Append-only audit: `change_log` table
- Soft delete: `deleted_at` column
- Spatial data: PostGIS `geography` type, `ST_DWithin`, `ST_Intersects`
- Multi-tenant: workspace_id scoping on all business tables

## Non-negotiables
1. Never create application features without thinking through RLS.
2. Every new business table must include indexes, created_at, and clear ownership (workspace_id or organization_id).
3. Use append-only audit records for critical user actions.
4. Keep canonical external-source payloads separate from normalized business tables.
5. Separate shared supplier data from buyer-private annotations.
6. Preserve backward compatibility; prefer additive migrations.
7. Use inferred/declared/verified status on supply-chain and site data when relevant.
8. Use PostGIS for spatial data from the beginning.
9. Keep the repo GitHub-ready: README, env example, lint, typecheck, tests.

## Coding conventions
- Favor server components and server-side actions for secure data flows.
- Use zod for validation in server actions.
- Use shadcn/ui + Tailwind for the interface.
- Use feature folders only when it improves clarity; otherwise keep domain logic under `lib/domain`.
- Keep SQL readable and explicit.
- Use `ja-JP` locale for date formatting in the UI.

## Project Routes

| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Login page |
| `/app` | Workspace selector |
| `/app/[workspaceSlug]` | Workspace dashboard |
| `/app/[workspaceSlug]/orgs` | Organization management |
| `/app/[workspaceSlug]/sites` | Site management |
| `/app/[workspaceSlug]/supply` | Supply chain graph |
| `/app/[workspaceSlug]/sources` | External data sources |
| `/app/[workspaceSlug]/leap` | LEAP assessment |
| `/app/[workspaceSlug]/evidence` | Evidence vault |
| `/app/[workspaceSlug]/monitor` | Monitoring dashboard |
| `/app/[workspaceSlug]/settings` | Workspace settings |
| `/api/cron/monitor` | Vercel Cron endpoint |

## Commands
```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript type checking
pnpm test         # Run tests (vitest)
```

## Expected outputs for each task
When you finish a task, always report:
- files changed
- commands to run
- migrations added
- follow-up risks / TODOs
