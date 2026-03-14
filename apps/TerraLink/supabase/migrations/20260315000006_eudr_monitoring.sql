-- ============================================================
-- Migration: EUDR Monitoring Rule Types
--   Extends monitoring_rules to support benchmark_change and
--   eudr_risk_review rule types.
-- ============================================================

-- 1. Extend rule_type CHECK to include EUDR-specific types
alter table public.monitoring_rules
  drop constraint if exists monitoring_rules_rule_type_check;

alter table public.monitoring_rules
  add constraint monitoring_rules_rule_type_check
  check (rule_type in (
    'source_refresh','threshold','missing_evidence','review_due',
    'benchmark_change','eudr_risk_review'
  ));

-- 2. Extend target_type CHECK to include EUDR-specific types
alter table public.monitoring_rules
  drop constraint if exists monitoring_rules_target_type_check;

alter table public.monitoring_rules
  add constraint monitoring_rules_target_type_check
  check (target_type in (
    'site','organization','material','relationship',
    'eudr_dds','eudr_country_benchmark'
  ));
