# Company Builder OS Scaffold v2

## What was added
- Next.js App Router pages for the full flow
- Dark, modern UI with plain CSS (no external UI kit required)
- Server Functions / Actions for create → run → review → fan-out
- Supabase repositories for threads, packets, approvals, artifacts
- Mock structured-step adapter so the flow can be demoed without wiring real models

## Core flow
1. `/threads/new` to create a thread
2. `/threads/[threadId]` to run AI CEO
3. `/decision-packets/[packetId]` to inspect the structured result
4. `/decision-packets/[packetId]/review` to approve / edit / reject
5. `/artifacts/[artifactId]` to inspect PRD / Build Plan / GTM outputs

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `MOCK_DECISION_PACKET=true` (default behavior unless explicitly set to false)
- optional later: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

## Important note
The current runtime uses LangGraph with `MemorySaver` through the existing graph scaffold. That is convenient for local development, but you should replace it with a durable checkpointer before using interrupt/resume in production.

## Styling direction
- dark background with soft gradients
- subdued borders and glass-like panels
- wide spacing for internal tools
- high information density without visual noise
