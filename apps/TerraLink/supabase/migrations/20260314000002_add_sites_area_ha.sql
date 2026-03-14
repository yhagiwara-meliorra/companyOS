-- Add area_ha column to sites table
-- Stores the area of the site in hectares (used in site forms and CSV import)

alter table public.sites add column if not exists area_ha numeric;
