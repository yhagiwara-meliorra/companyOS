-- 00003_slack_schema_updates.sql
-- Evolve integrations schema for full Slack installation + event ingestion support.

-- ─── installations: add missing columns ────────────────────────────────────────

ALTER TABLE integrations.installations
  ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'bot',
  ADD COLUMN IF NOT EXISTS installed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at  timestamptz;

ALTER TABLE integrations.installations
  RENAME COLUMN raw_oauth TO raw_response;

-- ─── webhook_events: payload jsonb, rename error col, unique index ──────────────

ALTER TABLE integrations.webhook_events
  ADD COLUMN IF NOT EXISTS payload     jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE integrations.webhook_events
  RENAME COLUMN last_error TO error_message;

-- Unique on provider_event_id (partial: only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id
  ON integrations.webhook_events(provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- ─── external_users: add timestamp columns ──────────────────────────────────────

ALTER TABLE integrations.external_users
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_seen_at  timestamptz NOT NULL DEFAULT now();

-- ─── external_channels: rename name → channel_name, add first_seen_at ───────────

ALTER TABLE integrations.external_channels
  RENAME COLUMN name TO channel_name;

ALTER TABLE integrations.external_channels
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now();

-- ─── message_refs: add FK refs, rename timestamp, make person_id nullable ───────

ALTER TABLE integrations.message_refs
  ADD COLUMN IF NOT EXISTS channel_ref_id uuid REFERENCES integrations.external_channels(id),
  ADD COLUMN IF NOT EXISTS sender_ref_id  uuid REFERENCES integrations.external_users(id);

ALTER TABLE integrations.message_refs
  RENAME COLUMN message_ts TO sent_at;

ALTER TABLE integrations.message_refs
  ALTER COLUMN person_id DROP NOT NULL;

-- Make content_hash nullable (we may not always have text to hash)
ALTER TABLE integrations.message_refs
  ALTER COLUMN content_hash DROP NOT NULL;
