# Handoff: Phase 1 — Real-time Communication Improvement

**Date:** 2026-03-14
**Phase:** 1 (Real-time Communication Improvement)
**Status:** Server-side implementation complete, Slack App dashboard config pending

---

## What was done

Implemented the `/improve` slash command feature that allows Slack users to submit draft text and receive improved phrasing, tone analysis, and alternative suggestions in real-time.

### New files created (9)

| File | Purpose |
|------|---------|
| `supabase/migrations/00006_improvement_requests.sql` | New `ai.improvement_requests` table for tracking usage |
| `src/lib/validations/slack-command.ts` | Zod schema for Slack slash command payloads |
| `src/lib/slack/respond.ts` | Helper to POST ephemeral responses via `response_url` |
| `src/lib/slack/improve-blocks.ts` | Block Kit builder for improvement response |
| `src/lib/slack/rate-limit.ts` | Per-user rate limit check (free: 10/hr, pro: 50/hr) |
| `src/lib/anthropic/prompts/improve-message.ts` | Claude prompt (improve-v1) + `ImproveResultSchema` |
| `src/lib/anthropic/improve.ts` | Core `improveMessage()` function |
| `src/app/api/slack/commands/route.ts` | Slash command route handler |
| `src/app/api/analytics/improvements/route.ts` | Dashboard usage stats API |

### Files modified (4)

| File | Change |
|------|--------|
| `src/app/api/slack/oauth/start/route.ts` | Added `"commands"` scope |
| `src/lib/anthropic/prompts/index.ts` | Added improve prompt exports |
| `src/lib/anthropic/index.ts` | Added `improveMessage` export |
| `src/types/database.ts` | Added `improvement_requests` table types |

### Tests added (1)

| File | Tests |
|------|-------|
| `src/__tests__/improve.test.ts` | 14 tests covering Zod schemas, Block Kit builder, user message builder |

### Documentation updated (2)

| File | Change |
|------|--------|
| `docs/roadmap.md` | Phase 1 status → "Partially complete", Now/Next/Later updated |
| `docs/handoffs/LATEST.md` | This file |

---

## Architecture decisions

1. **Slash command (`/improve`)** chosen over message shortcut because the user intent is to improve a *draft* (unsent text), not an existing message.
2. **Ephemeral response via `response_url`** — result is visible only to the invoking user for privacy.
3. **`after()` for async processing** — same pattern as `events/route.ts`; Slack gets immediate 200 acknowledgement.
4. **`provider_user_id` + `provider_team_id`** instead of `person_id` — not all `/improve` users have a `people` record.
5. **Model outputs stored, raw draft NOT stored** — `improved_text`, `tone_reason`, `alternatives` are model outputs (same as `coaching_runs.output_markdown`); only `content_hash` (SHA-256) is stored for the user's draft.
6. **Rate limit via COUNT on `improvement_requests`** — simple sliding window; no separate rate limit infrastructure needed.

---

## Privacy

- Raw draft text is passed transiently to Claude API only.
- Only `content_hash` (SHA-256) is stored in the database.
- `improved_text`, `tone_reason`, and `alternatives` are model-generated outputs, not user input.
- Ephemeral Slack messages are visible only to the invoking user.

---

## Verification

All checks passed on 2026-03-14:

- `pnpm lint` — pass (no new warnings)
- `pnpm typecheck` — pass
- `pnpm test` — 21/21 tests pass (7 existing + 14 new)
- `pnpm build` — pass

---

## Manual steps required

Before the feature works end-to-end, configure in the Slack App dashboard (https://api.slack.com/apps):

1. **Slash Commands** → Create `/improve`
   - Request URL: `https://<app-url>/api/slack/commands`
   - Short Description: `メッセージの下書きを改善します`
   - Usage Hint: `[改善したいメッセージ]`
2. **OAuth & Permissions** → Add `commands` to Bot Token Scopes
3. Reinstall app to the workspace

---

## Risks

| Risk | Mitigation |
|------|------------|
| Claude latency (>5s) | Immediate acknowledgement + async processing via `after()` |
| Existing installs lack `commands` scope | `/improve` doesn't appear until re-install (Slack standard behavior) |
| `response_url` timeout (30 min) | Claude responds in seconds; error handler covers edge cases |

---

## Next steps

1. Apply migration `00006` to the production database
2. Configure `/improve` command in Slack App dashboard
3. Reinstall app to workspace with new `commands` scope
4. Manual end-to-end test of `/improve` flow
5. Begin Phase 2: Slack App Home Personal Coach
