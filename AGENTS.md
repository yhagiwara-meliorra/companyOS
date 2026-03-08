# AGENTS.md

## Project identity
This repository is the control plane for an AI-native company builder.
The core product is **Company Builder OS**: a system that turns founder/CEO discussions into structured business decisions, then fans those decisions out into implementation artifacts.

The key operating model is:

1. Human places a strategic question.
2. AI CEO structures the discussion.
3. The system produces a **Decision Packet**.
4. The Decision Packet becomes downstream artifacts:
   - PRD
   - Build Plan
   - GTM Brief
   - Legal Change Request
5. Humans approve only at defined governance boundaries.

## What matters most
Optimize for these properties, in order:

1. **Traceable decisions**
   - Chat output is not the source of truth.
   - Structured records are the source of truth.
   - `Decision Packet` is the primary business object.

2. **Human approval boundaries**
   The constitution requires explicit human review for at least:
   - changes with cost impact >= 100,000 JPY
   - changes to CEO AI design / authority
   - major external legal/policy changes

3. **Constitution alignment**
   Every major feature, packet, and artifact should be evaluated against:
   - explainable to the next generation
   - does not increase externalities
   - transparent enough to audit
   - strengthens individuals rather than weakening them
   - capable of scaling to a large market

4. **Thin vertical slices first**
   Prefer end-to-end working slices over broad incomplete abstractions.
   The current priority slice is:
   - `/threads/new`
   - create thread
   - run decision packet
   - review if needed
   - generate PRD

5. **Make the app self-contained when possible**
   If the current build setup breaks because of monorepo package resolution, prefer a self-contained local implementation over speculative abstraction.
   Get the system running first, then re-extract shared packages.

## Current product focus
The first external product hypothesis is:
**AI Strategy Copilot for B2B strategy / new business / corporate planning teams**.

Core problem:
Important business decisions are not structured, not reused, and get recreated from scratch every time.

Initial MVP:
- create a thread
- AI CEO discussion
- Decision Packet generation
- review / approval
- PRD generation

Out of scope for early MVP:
- full legal automation
- CRM integration
- finished slide generation
- complex collaboration / enterprise permissions
- full billing system

## Architecture principles
Use these boundaries consistently:

- **Vercel / Next.js** = UI + server actions + deployment runtime
- **Supabase** = persistent system of record
- **LangGraph** = decision workflow / graph runtime
- **Claude** = strategy / architecture / requirements shaping
- **GPT** = artifact generation / formatting / product-side assistants

Interpretation:
- LangGraph is not the database.
- Supabase is the system of record.
- Decision Packet is the primary saved decision object.

## Implementation guidance
When editing code:

- Prefer minimal, high-confidence changes.
- Keep schemas explicit and validated.
- Prefer Zod for runtime validation.
- Preserve or improve type safety.
- Avoid introducing hidden magic.
- Keep server-only secrets on the server.
- Do not move sensitive data into `NEXT_PUBLIC_*` variables.

## Current workflow priorities
Priority order for the current milestone:

1. make `/threads/new` work reliably
2. make `runDecisionPacketAction` generate and persist a packet
3. make `/decision-packets/[packetId]` render reliably
4. support soft review flow
5. connect PRD generator
6. only then harden LangGraph interrupt/resume

## LangGraph guidance
For now:
- start with `MemorySaver`
- use a stable `thread_id` matching the stored thread record
- use soft approval before durable interrupt/resume if needed

Later:
- switch to durable checkpointing when approval flow must survive restarts

## Artifact generation guidance
Artifacts should be generated from the Decision Packet, not from raw chat history.
The Decision Packet is the source for:
- PRD
- Build Plan
- GTM Brief
- Legal Change Request

## Legal / governance expectations
Legal templates already exist conceptually for:
- NDA
- PoC agreement
- contractor agreement
- privacy policy
- internal personal data policy
- incident response
- disclosure response process
- AI legal update workflow
- ToS for AI SaaS

Codex should not invent a new legal architecture unless asked.
It should preserve the existing direction: reusable template layer + service-specific diffs.

## Repo organization intent
Target shape:
- `apps/company-os`
- `packages/decision-schema`
- `packages/ai-agents`
- `packages/artifact-generators`
- `packages/constitution`
- `infra/supabase`
- `docs/legal`
- `docs/governance`

But if package linking is breaking build, prioritize a working local version first.

## What success looks like right now
A successful near-term state means:
- app deploys on Vercel
- Supabase connection works
- thread creation works
- decision packet generation works (mock first, then real models)
- review flow works
- PRD artifact generation works

## What to avoid
- Do not treat the UI as the main product object; the packet is.
- Do not over-engineer monorepo abstractions before the slice works.
- Do not skip human approval boundaries.
- Do not make legal or policy assumptions without checking the existing project direction.
