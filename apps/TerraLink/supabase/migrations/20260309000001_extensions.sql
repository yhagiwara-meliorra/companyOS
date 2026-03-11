-- ============================================================
-- Migration 001: Enable required extensions
-- ============================================================

-- PostGIS — spatial data from day one
create extension if not exists postgis schema extensions;

-- pgvector — future RAG / similarity search
create extension if not exists vector schema extensions;

-- pgmq — job queue (ingestion, screening, risk, notifications)
create extension if not exists pgmq;

-- pg_cron — scheduled jobs (optional; Supabase hosted provides this)
-- create extension if not exists pg_cron;

-- moddatetime — auto updated_at trigger helper
create extension if not exists moddatetime schema extensions;

-- Create a schema alias so we can reference PostGIS types as gis.*
-- without polluting the public search_path.
create schema if not exists gis;
grant usage on schema gis to postgres, anon, authenticated, service_role;
