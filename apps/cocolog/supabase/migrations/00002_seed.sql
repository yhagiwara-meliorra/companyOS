-- =============================================================
-- Seed: initial taxonomy v1.0 + default model version
-- =============================================================

-- Taxonomy v1.0 — five core communication signals
insert into ai.taxonomy_versions (version_label, signal_definitions, is_active)
values (
  'v1.0',
  '{
    "clarity": {
      "label": "Clarity",
      "category": "effectiveness",
      "value_type": "numeric",
      "description": "How clear and easy to understand the message is"
    },
    "empathy": {
      "label": "Empathy",
      "category": "emotional",
      "value_type": "numeric",
      "description": "Level of emotional awareness and consideration for others"
    },
    "constructiveness": {
      "label": "Constructiveness",
      "category": "effectiveness",
      "value_type": "numeric",
      "description": "Whether the message moves the conversation forward productively"
    },
    "responsiveness": {
      "label": "Responsiveness",
      "category": "engagement",
      "value_type": "numeric",
      "description": "Timeliness and thoroughness of response"
    },
    "professionalism": {
      "label": "Professionalism",
      "category": "tone",
      "value_type": "numeric",
      "description": "Appropriate tone and language for workplace communication"
    }
  }'::jsonb,
  true
);

-- Default model version (placeholder — updated when first analysis runs)
insert into ai.model_versions (model_name, prompt_hash, description, is_active)
values (
  'claude-sonnet-4-20250514',
  'seed-placeholder',
  'Initial model version. Prompt hash updated on first deployment.',
  true
);
