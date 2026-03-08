# CODEX_HANDOFF.md

## Objective
Stabilize and complete the first working slice of **Company Builder OS**.

The current goal is not broad feature expansion. The goal is a reliable end-to-end flow:

1. Create a thread
2. Run Decision Packet generation
3. Save and display the Decision Packet
4. Route to review when approval is required
5. Generate a PRD artifact from the packet

## Product context
This system is an AI-native company operating system.
It is designed to turn business discussions into structured, reusable decisions.

The operating chain is:

- AI CEO dialogue
- Decision Packet
- artifact fan-out
  - PRD
  - Build Plan
  - GTM Brief
  - Legal Change Request

The first product hypothesis is:
**AI Strategy Copilot for B2B corporate planning / strategy / new business teams**.

### Core problem
Important business decisions are not structured, not reused, and are repeatedly recreated from scratch.

### Initial MVP
Must include:
- thread creation
- AI CEO discussion flow
- Decision Packet generation
- review / approval
- PRD generation

Must not include yet:
- full legal automation
- CRM integration
- complex collaboration
- completed slide generation
- billing system completeness

## System design decisions already made

### 1. System roles
- Vercel / Next.js = UI + server actions + deployment runtime
- Supabase = system of record
- LangGraph = workflow runtime
- Claude = strategy / architecture / requirements shaping
- GPT = artifact generation / formatting

### 2. Primary business object
The **Decision Packet** is the main source of truth.
Chat transcripts are not the source of truth.
Artifacts should be derived from packets, not raw discussions.

### 3. Approval boundary
A human must approve at least:
- estimated cost impact >= 100,000 JPY
- changes to CEO AI design / authority
- major legal / public policy changes

## Technical state
A scaffold exists, but there have been repo/build issues.
The app has recently had problems because code in `company-os` referenced shared packages using relative paths such as:
- `../../../../packages/decision-schema/...`
- `../../../../../packages/ai-agents/...`

This means one of the current priorities is to ensure the app can build reliably.
If needed, make the app self-contained first before re-extracting shared packages.

## Preferred implementation order
1. Make `/threads/new` reliable
2. Make thread persistence reliable
3. Make `runDecisionPacketAction` work with mock data first
4. Persist packet to Supabase
5. Render packet page reliably
6. Add soft review flow
7. Add PRD artifact generation
8. Then connect real model providers
9. Then harden LangGraph interrupt/resume

## LangGraph expectations
Short-term preferred setup:
- compile graph with `MemorySaver`
- invoke using stable `thread_id`
- use soft review flow first if needed

Long-term:
- durable checkpointing for true interrupt/resume

## What Codex should focus on first
If the build is broken, fix that before feature work.
If imports are broken because of cross-package references, prefer the smallest path to a working slice.

Specifically prioritize:
- build reliability
- correct route rendering
- correct Supabase persistence
- correct Decision Packet schema flow
- correct PRD generation from saved packets

## Important domain expectations
Any packet or artifact should preserve:
- constitution alignment
- explicit human approval points
- separation of AI role vs human role
- out-of-scope clarity for MVP

## Desired immediate deliverables
The most useful next deliverables are:

1. working thread creation flow
2. working `runDecisionPacketAction`
3. working packet display page
4. working review page
5. working PRD generation path

## If you need to restructure
You may:
- localize schemas into the app if package linking is breaking build
- simplify the graph to a minimal vertical slice
- keep mock providers for early verification

You should avoid:
- large speculative rewrites
- introducing new architecture not required to get the slice working
- replacing the Decision Packet concept with ad hoc chat output
