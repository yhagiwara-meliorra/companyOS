-- =============================================================
-- MESSAGE CONTENT STORAGE
-- =============================================================
-- Add optional content column to message_refs for storing raw message text.
-- Controlled by org setting: store_message_content (default: false).
-- When disabled, content remains NULL and only content_hash is stored.

ALTER TABLE integrations.message_refs
  ADD COLUMN IF NOT EXISTS content text;

COMMENT ON COLUMN integrations.message_refs.content IS
  'Raw message text. Only populated when org setting store_message_content is true.';
