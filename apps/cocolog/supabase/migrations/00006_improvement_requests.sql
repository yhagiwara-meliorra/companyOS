-- =============================================================
-- 00006: improvement_requests
-- Phase 1: Real-time Communication Improvement (/improve)
--
-- Tracks /improve slash command usage.
-- Raw draft text is NEVER stored — only content_hash and model outputs.
-- =============================================================

CREATE TABLE ai.improvement_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_user_id  text NOT NULL,
  provider_team_id  text NOT NULL,
  content_hash      text NOT NULL,
  model_version_id  uuid NOT NULL REFERENCES ai.model_versions(id),
  scene_label       text,
  improved_text     text,
  tone_reason       text,
  alternatives      jsonb NOT NULL DEFAULT '[]',
  latency_ms        int,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Rate limit lookups: count recent requests per user
CREATE INDEX idx_ir_user_time
  ON ai.improvement_requests(provider_user_id, provider_team_id, created_at DESC);

-- Org-scoped analytics queries
CREATE INDEX idx_ir_org
  ON ai.improvement_requests(org_id, created_at DESC);

COMMENT ON TABLE ai.improvement_requests IS
  'Tracks /improve slash command usage. Raw draft text is NEVER stored — only content_hash and model outputs.';
