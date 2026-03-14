# Project rules

## Product
- Slack-first communication coaching SaaS
- Vercel + Next.js App Router + Supabase + Claude API
- Message bodies are NOT persisted by default
- Store refs, hashes, scores, aggregates, and permalinks only
- Slack first, Teams later

## Architecture
- Next.js Route Handlers for HTTP entrypoints
- Supabase SQL migrations only
- RLS for browser-accessible data
- service-role only on server side
- Keep provider adapters isolated: slack/, teams/, anthropic/, analytics/

## Coding rules
- Strict TypeScript
- Zod for input validation
- Recharts for charts
- No Prisma/Drizzle
- Prefer small pure functions
- Write tests for changed core logic
- Update docs/roadmap.md and docs/handoffs/LATEST.md at the end of every task

## Delivery rules
- Always inspect current repo state first
- Always propose a plan before editing
- After implementation run: lint, typecheck, test, build
- Summarize changed files, risks, and next step