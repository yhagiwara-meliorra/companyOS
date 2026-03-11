-- ============================================================
-- Migration 009: pgmq job queues
-- ============================================================

-- Ingestion jobs — ingest external data sources
select pgmq.create('ingestion_jobs');

-- Screening jobs — run spatial screening for workspace sites
select pgmq.create('screening_jobs');

-- Risk jobs — recompute risk scores
select pgmq.create('risk_jobs');

-- Notification jobs — send emails, reminders
select pgmq.create('notification_jobs');
