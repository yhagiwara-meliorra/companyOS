# Product Roadmap

## 0. Purpose

This document is the living roadmap for the product.

It exists to:
- keep implementation aligned across Claude Code sessions
- clarify what is **now**, **next**, and **later**
- preserve scope discipline
- ensure we build in the right order for growth, retention, and upsell

This roadmap must be updated at the end of each major implementation session.

---

## 1. Product Summary

We are building a Slack-first communication coaching SaaS.

The product analyzes communication patterns, helps users reflect on their habits, and encourages behavior change through weekly coaching and real-time support.

### Core user value
- Understand communication tendencies
- See improvement over time
- Receive specific next actions
- Improve phrasing and collaboration inside Slack

### Core product principles
- Slack first, Teams later
- Individual coaching first, team/manager insights second
- Message bodies are **not persisted by default**
- Store message references, hashes, metadata, model outputs, and aggregates only
- Privacy-preserving by design
- Production-minded, simple architecture
- Designed for 1-person to small-team development

---

## 2. Business Context

### Primary growth model
- Product-led growth (PLG)

### Target segments
- Team plan: individuals and small teams
- Business plan: team leads, managers, small-to-mid organizations

### Upsell path
1. Personal weekly coaching
2. Real-time communication improvement
3. Slack App Home daily usage
4. Manager insights
5. 1on1 support
6. Workflow integration
7. Future multi-provider expansion (Teams beta)

### Pricing assumptions
- Free
- Team: per-seat monthly plan
- Business: per-seat monthly plan with minimum monthly floor
- No enterprise-heavy implementation in the near term

---

## 3. Architecture Constraints

### Stack
- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres + Auth + RLS
- Supabase SQL migrations only
- Anthropic Claude API
- Slack API
- Vercel deployment

### Non-negotiables
- No Prisma / Drizzle
- No raw message body persistence by default
- Server-side service role only
- RLS for browser-accessible data
- Provider abstraction must support future Teams adapter
- Model versioning and taxonomy versioning must remain intact
- Rollups must be first-class (daily/weekly metrics)

---

## 4. Success Criteria

### Product success
- Users receive clear weekly value
- Slack usage becomes habitual
- Team adoption expands organically
- Business-tier features justify upgrade

### Technical success
- Clean, maintainable codebase
- Reliable event ingestion
- Retryable background flows
- Safe privacy boundaries
- Minimal manual ops burden

### Growth success
- Higher activation from Slack install to first insight
- Improved weekly retention
- Growth from individual to team adoption
- Clear upgrade path from Team to Business

---

## 5. Current Stage

## Current stage: Foundation complete / Expansion phase starting

Base system assumed:
- Slack ingestion exists
- Claude-based classification exists
- weekly digests exist
- dashboard foundation exists
- Supabase schema exists with provider-aware architecture

The next phase is feature expansion for retention and upsell.

---

## 6. Roadmap Overview

### Phase 0 — Foundation
**Status:** In progress / partially complete

#### Goal
Create a stable Slack-first SaaS foundation with:
- Slack installation
- event ingestion
- message reference persistence
- AI classification
- rollups
- weekly coaching
- dashboard basics

#### Includes
- Slack OAuth
- event signature verification
- webhook ingestion
- idempotency
- Claude classification
- weekly metrics
- weekly digest generation
- first dashboard pages
- Supabase migrations
- RLS basics

#### Exit criteria
- A Slack workspace can install the app
- Events are ingested safely
- Weekly digest is generated end-to-end
- Users can view weekly trends
- lint/typecheck/test/build pass

---

### Phase 1 — Real-time Communication Improvement
**Status:** Partially complete
**Priority:** P0

#### Why this matters
This is the fastest path to increasing daily/weekly product usage and improving Team retention.

#### Goal
Allow users to get immediate help improving draft messages inside Slack.

#### User value
- Better phrasing before sending
- Softer requests
- clearer feedback
- more useful tone coaching
- faster action than waiting for weekly digest

#### Scope
- User-invoked improvement flow
- Improved phrasing suggestion
- Tone explanation
- Alternative phrasings
- Scene classification for the draft
- Rate limiting
- Usage analytics
- No raw draft persistence by default

#### Out of scope
- Passive always-on monitoring
- Full message composer replacement
- Channel-wide automated moderation

#### Exit criteria
- A user can request real-time improvement in Slack
- Suggestions are returned with low latency
- No raw draft text is persisted
- Usage is tracked for adoption analysis

#### Success metrics
- % of active users who use real-time improvement
- repeat usage rate
- suggestion acceptance proxy rate
- median latency

---

### Phase 2 — Slack App Home Personal Coach
**Status:** Planned  
**Priority:** P0

#### Why this matters
Makes the product feel native inside Slack and increases weekly habit formation.

#### Goal
Turn App Home into the primary personal coaching surface in Slack.

#### User value
- See weekly trend without leaving Slack
- See top coaching tips
- View progress toward goals
- Access improvement actions quickly

#### Scope
- Home tab rendering
- Weekly summary
- Scene distribution
- Trend summary
- Top 3 coaching tips
- Goal progress
- Refresh action
- Deep links to dashboard pages

#### Out of scope
- Full analytics parity with web dashboard
- Raw message history display

#### Exit criteria
- App Home loads personalized coaching data
- Home tab can refresh
- Goal progress and top tips appear correctly
- Block Kit composition is modular and tested

#### Success metrics
- App Home open rate
- repeat weekly opens
- clicks from Home to actions
- goal interaction rate

---

### Phase 3 — Manager Team Insights
**Status:** Planned  
**Priority:** P1

#### Why this matters
This is the first major Business upgrade and the clearest upsell path.

#### Goal
Provide manager-safe, privacy-preserving aggregate team communication insights.

#### User value
- Understand team communication patterns
- Track change over time
- Spot where support is needed
- Use trends for team improvement

#### Scope
- Manager/team dashboard
- Aggregate weekly trends
- Scene mix changes
- Thanks / request / feedback ratio tracking
- Privacy thresholds for small sample groups
- Internal summary output for sharing

#### Out of scope
- Individual surveillance
- raw message viewing
- private individual coaching exposure

#### Exit criteria
- Managers can access team insights safely
- Aggregate metrics are privacy-thresholded
- Access control is enforced
- Business value is clearly demonstrated

#### Success metrics
- Business upgrade conversion rate
- manager weekly active usage
- teams with repeat insight views
- usage of exported summaries

---

### Phase 4 — 1on1 Support
**Status:** Planned  
**Priority:** P1

#### Why this matters
Transforms insights into actual manager behavior change.

#### Goal
Help managers prepare better 1on1 conversations using safe summaries and coaching prompts.

#### User value
- Better talking points
- More useful appreciation prompts
- More consistent follow-ups
- Better coaching conversations

#### Scope
- Generate 1on1 brief
- Suggested talking points
- Appreciation opportunities
- Follow-up prompts
- Time-window selection
- Save generated brief metadata and versioning
- Optional Slack share/DM action

#### Out of scope
- Writing fully scripted 1on1 conversations
- performance review automation
- HR case management

#### Exit criteria
- Manager can generate a 1on1 brief
- Inputs are based on safe aggregates only
- Access control is enforced
- Briefs are reusable and versioned

#### Success metrics
- 1on1 brief generation rate
- repeat usage by managers
- Business plan retention lift
- manager satisfaction feedback

---

### Phase 5 — Workflow Integration
**Status:** Planned  
**Priority:** P2

#### Why this matters
Makes the product part of team operations instead of just a dashboard.

#### Goal
Integrate with Slack Workflow Builder through custom steps.

#### User value
- Automate team rituals
- Embed coaching into routines
- Make insights operational

#### Scope
- Custom workflow step support
- Weekly thanks reminder
- 1on1 prep summary step
- Team retrospective summary step
- Step analytics
- Workflow setup docs

#### Out of scope
- Large library of workflow templates at launch
- cross-workspace orchestration

#### Exit criteria
- At least one custom workflow step works end-to-end
- Inputs/outputs are validated
- Existing core logic is reused
- Usage is measurable

#### Success metrics
- workflow step usage count
- teams activating workflows
- repeat workflow execution
- retention impact from workflow-enabled accounts

---

### Phase 6 — Teams Beta
**Status:** Planned  
**Priority:** P3

#### Why this matters
Enables future multi-provider expansion without blocking current Slack growth.

#### Goal
Add the first provider adapter for Microsoft Teams while keeping the core pipeline provider-agnostic.

#### User value
- Opens future market expansion
- reuses the same coaching and analytics logic

#### Scope
- Teams provider adapter
- Mapping for users/channels/messages
- Beta ingestion path
- Graph API / RSC-based consent assumptions
- Architecture and setup docs

#### Out of scope
- Full feature parity with Slack
- Teams-native polished UX
- enterprise-ready Teams rollout

#### Exit criteria
- Core codebase supports second provider cleanly
- Teams beta ingestion is scaffolded or partially working
- No duplication of analytics/business logic

#### Success metrics
- successful beta ingestion
- adapter stability
- parity gap documented clearly

---

## 7. Cross-Cutting Workstreams

These are ongoing and should be improved throughout all phases.

### A. Privacy and data handling
- never persist message bodies by default
- audit access paths
- keep manager views aggregate-only
- document privacy guarantees

### B. AI quality
- taxonomy versioning
- model versioning
- prompt versioning
- false positive / false negative review process
- controlled experimentation

### C. Reliability
- retryable jobs
- event idempotency
- observability
- failure state visibility
- cron resilience

### D. Analytics and billing
- usage analytics for feature adoption
- upgrade path instrumentation
- activation and retention metrics
- Team -> Business conversion tracking

### E. Documentation
- architecture.md
- data-model.md
- roadmap.md
- handoff notes
- env/setup docs

---

## 8. Prioritization Rules

When deciding what to build next, use this order:

1. Features that increase recurring user value inside Slack
2. Features that improve retention for Team plan
3. Features that create a clear Business upgrade reason
4. Features that reduce operational load
5. Features that expand provider coverage

Avoid building:
- enterprise-heavy requirements too early
- raw message storage features
- admin-only features without clear upgrade leverage
- large abstractions before second provider is actually needed

---

## 9. Current Now / Next / Later

## Now
- Real-time communication improvement (Phase 1) — server-side complete, Slack App config pending
- Slack App Home personal coach (Phase 2)

## Next
- Manager team insights (Phase 3)
- 1on1 support (Phase 4)

## Later
- Workflow integration (Phase 5)
- Teams beta (Phase 6)

---

## 10. Open Questions

These should be resolved as implementation advances.

- What is the safest and most useful Slack entrypoint for real-time improvement?
- Should real-time improvement begin via App Home, message shortcut, slash command, or modal?
- What is the minimum privacy threshold for team insights?
- How should manager roles be mapped cleanly from existing org membership?
- What usage event set is enough for pricing and upgrade experiments?
- What subset of Teams beta is worth implementing first?

---

## 11. Update Rules

At the end of each major implementation session:

1. Update the relevant phase status
2. Add completed scope items if needed
3. Move items between Now / Next / Later if priorities changed
4. Ensure roadmap still matches architecture constraints
5. Reflect changes in `docs/handoffs/LATEST.md`

### Status labels
Use one of:
- Planned
- In progress
- Blocked
- Partially complete
- Complete

---

## 12. Definition of Done (Global)

A roadmap item is only considered complete when:

- implementation is merged
- required migrations are included
- docs are updated
- tests exist for core logic
- lint passes
- typecheck passes
- build passes
- manual test steps are documented
- handoff note is updated

---

## 13. Notes for Claude Code

Before starting any roadmap item:
- read `CLAUDE.md`
- read `docs/architecture.md`
- read `docs/data-model.md`
- read `docs/roadmap.md`
- read `docs/handoffs/LATEST.md`
- inspect git status and recent commits
- propose a plan before editing

At the end of any roadmap item:
- run lint/typecheck/test/build
- update this roadmap
- update latest handoff
- summarize changed files, risks, and next step