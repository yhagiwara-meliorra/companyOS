# Handoff: Phase 1 — Real-time Communication Improvement (Complete)

**Date:** 2026-03-15
**Phase:** 1 (Real-time Communication Improvement)
**Status:** Implementation complete & deployed. Slash command E2E confirmed. Message shortcut pending Callback ID fix in Slack dashboard.

---

## Feature worked on

Phase 1: Real-time communication improvement for Slack — two entrypoints:
1. **`/improve` slash command** — user types `/improve <draft>`, gets improved phrasing back as ephemeral message
2. **Message shortcut** — user right-clicks any message → "メッセージを改善する" → gets improvement suggestions with original text quoted

Both share the same `improveMessage()` pipeline, rate limiting, and `ai.improvement_requests` analytics table.

---

## Files changed

### New files (11 total)

| File | Purpose |
|------|---------|
| `supabase/migrations/00006_improvement_requests.sql` | `ai.improvement_requests` table |
| `src/lib/validations/slack-command.ts` | Zod schema for slash command payloads |
| `src/lib/validations/slack-interaction.ts` | Zod schema for Slack interactivity payloads (message_action) |
| `src/lib/slack/respond.ts` | `respondEphemeral()` — POST to Slack response_url |
| `src/lib/slack/improve-blocks.ts` | Block Kit builders: `buildImproveResponseBlocks` + `buildImproveShortcutBlocks` |
| `src/lib/slack/rate-limit.ts` | Per-user rate limit (free: 10/hr, pro: 50/hr) |
| `src/lib/anthropic/prompts/improve-message.ts` | Claude prompt (improve-v1) + ImproveResultSchema |
| `src/lib/anthropic/improve.ts` | Core `improveMessage()` function |
| `src/app/api/slack/commands/route.ts` | Slash command route handler |
| `src/app/api/slack/interactions/route.ts` | Interactivity route handler (message shortcuts) |
| `src/app/api/analytics/improvements/route.ts` | Dashboard improvement usage stats API |

### Modified files (5)

| File | Change |
|------|--------|
| `src/app/api/slack/oauth/start/route.ts` | Added `"commands"` scope |
| `src/lib/anthropic/prompts/index.ts` | Added improve prompt exports |
| `src/lib/anthropic/index.ts` | Added `improveMessage` export |
| `src/types/database.ts` | Added `improvement_requests` table types |
| `src/middleware.ts` | Broadened Slack route exclusion: `api/slack/events` → `api/slack` |

### Test file

| File | Tests |
|------|-------|
| `src/__tests__/improve.test.ts` | 25 tests (slash command schema, improve result schema, Block Kit builders, interaction schemas) |

---

## Migrations / env changes

- **Migration:** `supabase/migrations/00006_improvement_requests.sql` — creates `ai.improvement_requests` table with indexes for rate limiting and analytics
- **Env:** No new env vars required (uses existing `SLACK_SIGNING_SECRET`, `ANTHROPIC_API_KEY`, Supabase service role)
- **OAuth scope:** `commands` added to Slack OAuth scopes (existing installs must reinstall)

---

## Completed items

- [x] `/improve` slash command — implemented, deployed, E2E tested ✓
- [x] Message shortcut (message_action) — implemented, deployed
- [x] Shared `improveMessage()` core pipeline
- [x] Rate limiting (sliding window on `improvement_requests`)
- [x] Block Kit responses (slash command + shortcut variants)
- [x] Zod validation for all payloads
- [x] Privacy: no raw text persistence, content_hash only
- [x] Analytics API (`/api/analytics/improvements`)
- [x] Middleware fix for `/api/slack/*` routes
- [x] Tests: 32/32 pass
- [x] Typecheck, lint, build pass
- [x] Deployed to Vercel (commits `676caf9`, `5763a25`)

---

## Unresolved issues

1. **Message shortcut Callback ID misconfigured** — User set `このメッセージの改善提案を表示します` (the description) as the Callback ID instead of `improve_message`. Vercel logs show: `[slack/interactions] unknown callback_id: このメッセージの改善提案を表示します`. **Fix:** Update Callback ID to `improve_message` in Slack App dashboard → Interactivity & Shortcuts → edit the message shortcut.

2. **Message shortcut E2E not yet verified** — After fixing Callback ID, need to confirm: right-click message → shortcut → ephemeral response with original + improved text.

3. **Typecheck/build hang on local machine** — Known resource issue; passes in CI/Vercel deployment but hangs locally on Mac mini.

---

## Exact next recommended prompt

```
Slack App ダッシュボードでメッセージショートカットの Callback ID を `improve_message` に修正しました。E2E テスト完了したら Phase 2（Slack App Home Personal Coach）を始めましょう。docs/roadmap.md の Phase 2 スコープに基づいて実装プランを提案してください。
```
