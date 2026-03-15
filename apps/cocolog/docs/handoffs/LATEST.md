# Handoff: Phase 1 — Real-time Communication Improvement (v2: Message Shortcut)

**Date:** 2026-03-14
**Phase:** 1 (Real-time Communication Improvement)
**Status:** Server-side implementation complete (slash command + message shortcut), Slack App dashboard config pending

---

## What was done

### Session 1: `/improve` slash command
Implemented the `/improve` slash command that lets users submit draft text and receive improved phrasing, tone analysis, and alternatives in real-time.

### Session 2: Message shortcut + refactoring
Added a **message shortcut** (right-click → "メッセージを改善する") that lets users improve any existing message in Slack. Also refactored the response helper for reuse.

---

## Files created (Session 1: 9 files)

| File | Purpose |
|------|---------|
| `supabase/migrations/00006_improvement_requests.sql` | `ai.improvement_requests` table |
| `src/lib/validations/slack-command.ts` | Zod schema for slash command payloads |
| `src/lib/slack/respond.ts` | `respondEphemeral()` — POST via response_url |
| `src/lib/slack/improve-blocks.ts` | Block Kit builder for improvement responses |
| `src/lib/slack/rate-limit.ts` | Per-user rate limit (free: 10/hr, pro: 50/hr) |
| `src/lib/anthropic/prompts/improve-message.ts` | Claude prompt (improve-v1) + `ImproveResultSchema` |
| `src/lib/anthropic/improve.ts` | Core `improveMessage()` function |
| `src/app/api/slack/commands/route.ts` | Slash command route handler |
| `src/app/api/analytics/improvements/route.ts` | Dashboard usage stats API |

## Files created (Session 2: 2 files)

| File | Purpose |
|------|---------|
| `src/lib/validations/slack-interaction.ts` | Zod schema for Slack interactivity payloads (message_action) |
| `src/app/api/slack/interactions/route.ts` | Interactivity handler — routes message shortcuts to improve pipeline |

## Files modified (Session 2: 4 files)

| File | Change |
|------|--------|
| `src/lib/slack/respond.ts` | Renamed `respondToSlashCommand` → `respondEphemeral` (works for both slash commands and interactions) |
| `src/app/api/slack/commands/route.ts` | Updated import to use `respondEphemeral` |
| `src/lib/slack/improve-blocks.ts` | Added `buildImproveShortcutBlocks(originalText, result)` — includes original message quoted |
| `src/__tests__/improve.test.ts` | Added 11 new tests (message action schema, interaction payload, shortcut blocks) |

## Files modified (Session 1: 4 files)

| File | Change |
|------|--------|
| `src/app/api/slack/oauth/start/route.ts` | Added `"commands"` scope |
| `src/lib/anthropic/prompts/index.ts` | Added improve prompt exports |
| `src/lib/anthropic/index.ts` | Added `improveMessage` export |
| `src/types/database.ts` | Added `improvement_requests` table types |

---

## Architecture decisions

1. **Two entrypoints, one pipeline:** Both `/improve` (slash command) and message shortcut route through the same `improveMessage()` core function, shared rate limiting, and shared `improvement_requests` table.
2. **Message shortcut response includes original text** — `buildImproveShortcutBlocks()` quotes the original message for comparison, unlike the slash command variant.
3. **Interaction handler is extensible** — `SlackInteractionPayloadSchema` uses `z.discriminatedUnion` so adding `block_actions`, `view_submission`, etc. later is trivial.
4. **Empty 200 ACK for interactions** — unlike slash commands (which can include JSON in the 200 response), interaction payloads require an empty 200 body. All user-visible messages are sent via `response_url`.
5. **`respondEphemeral` is shared** — renamed from `respondToSlashCommand` since the `response_url` POST mechanism is identical for both slash commands and interactions.

---

## Privacy

- Raw message text from shortcuts is passed transiently to Claude API only.
- Only `content_hash` (SHA-256) is stored in the database.
- `improved_text`, `tone_reason`, and `alternatives` are model-generated outputs.
- Ephemeral Slack messages are visible only to the invoking user.

---

## Verification

All checks passed on 2026-03-14:

- `pnpm lint` — pass (no new warnings)
- `pnpm typecheck` — pass
- `pnpm test` — 32/32 tests pass (7 existing + 14 session 1 + 11 session 2)
- `pnpm build` — pass (`/api/slack/interactions` route visible in build output)

---

## Manual steps required

### 1. Slash command (from Session 1)
In Slack App dashboard (https://api.slack.com/apps):

- **Slash Commands** → Create `/improve`
  - Request URL: `https://<app-url>/api/slack/commands`
  - Short Description: `メッセージの下書きを改善します`
  - Usage Hint: `[改善したいメッセージ]`

### 2. Message shortcut (Session 2 — NEW)
In Slack App dashboard:

- **Interactivity & Shortcuts** → Enable Interactivity
  - Request URL: `https://<app-url>/api/slack/interactions`
- **Shortcuts** → Create New Shortcut → **On messages**
  - Name: `メッセージを改善する`
  - Callback ID: `improve_message`
  - Short Description: `このメッセージの改善提案を表示します`

### 3. General
- Apply migration `00006` to production DB (if not already done)
- Reinstall app to workspace (for `commands` scope)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Claude latency (>5s) | Immediate ACK + async processing via `after()` |
| Interaction 3-second timeout | Only DB lookups + rate limit run synchronously; Claude call is in `after()` |
| Text-only guard | Messages with only attachments/files return informative error |
| `/improve` + shortcut share rate limits | Intentional — both increment the same `improvement_requests` table |
| Existing installs lack `commands` scope | Must reinstall app |

---

## Next steps

1. Configure Interactivity URL and message shortcut in Slack App dashboard
2. End-to-end test: right-click message → "メッセージを改善する" → improvement response
3. Begin Phase 2: Slack App Home Personal Coach
