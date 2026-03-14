-- ============================================================
-- Migration: EUDR Reference Tables
--   eudr_commodity_codes, eudr_country_benchmarks
--   + materials table extension (cn_code, commodity_type)
-- ============================================================

-- ── eudr_commodity_codes ────────────────────────────────────
-- Annex I commodity codes: CN/HS code → EUDR commodity mapping
-- Global reference table (not workspace-scoped)
create table public.eudr_commodity_codes (
  id              uuid primary key default gen_random_uuid(),
  cn_code         text not null,
  hs_code         text,
  description     text not null,
  commodity_type  text not null check (commodity_type in (
                    'cattle','cocoa','coffee','oil_palm','rubber','soya','wood')),
  cn_year         integer not null default 2024,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (cn_code, cn_year)
);

create index idx_ecc_commodity on public.eudr_commodity_codes (commodity_type);
create index idx_ecc_hs        on public.eudr_commodity_codes (hs_code);
create index idx_ecc_active    on public.eudr_commodity_codes (is_active) where is_active = true;

select public.apply_updated_at_trigger('eudr_commodity_codes');

-- ── eudr_country_benchmarks ─────────────────────────────────
-- Country-level risk classification (low/standard/high)
-- Append-only: new benchmarks are added, old ones superseded
create table public.eudr_country_benchmarks (
  id              uuid primary key default gen_random_uuid(),
  country_code    text not null,
  country_name    text not null,
  risk_tier       text not null check (risk_tier in ('low','standard','high')),
  commodity_type  text check (commodity_type in (
                    'cattle','cocoa','coffee','oil_palm','rubber','soya','wood')),
  effective_date  date not null default current_date,
  superseded_at   date,
  source_url      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_ecb_country   on public.eudr_country_benchmarks (country_code);
create index idx_ecb_tier      on public.eudr_country_benchmarks (risk_tier);
create index idx_ecb_active    on public.eudr_country_benchmarks (country_code, commodity_type)
  where superseded_at is null;

select public.apply_updated_at_trigger('eudr_country_benchmarks');

-- ── materials extension ─────────────────────────────────────
-- Add CN code and EUDR commodity type to materials table
alter table public.materials add column if not exists cn_code text;
alter table public.materials add column if not exists commodity_type text;

-- ── Seed: EUDR commodity codes (representative subset) ──────
insert into public.eudr_commodity_codes (cn_code, hs_code, description, commodity_type, cn_year) values
  -- Cattle
  ('0102', '0102', 'Live bovine animals', 'cattle', 2024),
  ('0201', '0201', 'Meat of bovine animals, fresh or chilled', 'cattle', 2024),
  ('0202', '0202', 'Meat of bovine animals, frozen', 'cattle', 2024),
  ('4101', '4101', 'Raw hides and skins of bovine', 'cattle', 2024),
  -- Cocoa
  ('1801', '1801', 'Cocoa beans, whole or broken', 'cocoa', 2024),
  ('1802', '1802', 'Cocoa shells, husks, skins and other cocoa waste', 'cocoa', 2024),
  ('1803', '1803', 'Cocoa paste', 'cocoa', 2024),
  ('1804', '1804', 'Cocoa butter, fat and oil', 'cocoa', 2024),
  ('1805', '1805', 'Cocoa powder', 'cocoa', 2024),
  ('1806', '1806', 'Chocolate and other cocoa preparations', 'cocoa', 2024),
  -- Coffee
  ('0901', '0901', 'Coffee', 'coffee', 2024),
  -- Oil palm
  ('1511', '1511', 'Palm oil and its fractions', 'oil_palm', 2024),
  ('1513', '1513', 'Coconut, palm kernel or babassu oil', 'oil_palm', 2024),
  -- Rubber
  ('4001', '4001', 'Natural rubber', 'rubber', 2024),
  ('4005', '4005', 'Compounded rubber, unvulcanised', 'rubber', 2024),
  ('4011', '4011', 'New pneumatic tyres, of rubber', 'rubber', 2024),
  -- Soya
  ('1201', '1201', 'Soya beans', 'soya', 2024),
  ('1208', '1208', 'Flours and meals of oil seeds', 'soya', 2024),
  ('1507', '1507', 'Soya-bean oil and its fractions', 'soya', 2024),
  -- Wood
  ('4401', '4401', 'Fuel wood; wood in chips or particles', 'wood', 2024),
  ('4403', '4403', 'Wood in the rough', 'wood', 2024),
  ('4407', '4407', 'Wood sawn or chipped lengthwise', 'wood', 2024),
  ('4408', '4408', 'Sheets for veneering', 'wood', 2024),
  ('4409', '4409', 'Wood continuously shaped along any edge', 'wood', 2024),
  ('4410', '4410', 'Particle board and similar board of wood', 'wood', 2024),
  ('4411', '4411', 'Fibreboard of wood or other ligneous materials', 'wood', 2024),
  ('4412', '4412', 'Plywood, veneered panels', 'wood', 2024),
  ('9403', '9403', 'Other furniture and parts thereof', 'wood', 2024),
  ('4818', '4818', 'Printed books, newspapers, pictures', 'wood', 2024),
  ('4802', '4802', 'Uncoated paper and paperboard', 'wood', 2024)
on conflict (cn_code, cn_year) do nothing;

-- ── Seed: Country benchmarks (initial — will be updated) ────
-- Note: These are placeholder classifications. The actual EU Commission
-- delegated act determining country risk has not yet been published.
-- All countries start as 'standard' until the official list is published.
-- A few examples are included for development purposes.
insert into public.eudr_country_benchmarks (country_code, country_name, risk_tier, effective_date) values
  ('BR', 'Brazil', 'high', '2024-12-30'),
  ('ID', 'Indonesia', 'high', '2024-12-30'),
  ('MY', 'Malaysia', 'standard', '2024-12-30'),
  ('CO', 'Colombia', 'standard', '2024-12-30'),
  ('GH', 'Ghana', 'standard', '2024-12-30'),
  ('CI', 'Côte d''Ivoire', 'high', '2024-12-30'),
  ('PE', 'Peru', 'standard', '2024-12-30'),
  ('EC', 'Ecuador', 'standard', '2024-12-30'),
  ('VN', 'Viet Nam', 'standard', '2024-12-30'),
  ('TH', 'Thailand', 'standard', '2024-12-30'),
  ('PG', 'Papua New Guinea', 'high', '2024-12-30'),
  ('CM', 'Cameroon', 'standard', '2024-12-30'),
  ('CG', 'Congo', 'high', '2024-12-30'),
  ('CD', 'DR Congo', 'high', '2024-12-30'),
  ('NG', 'Nigeria', 'standard', '2024-12-30'),
  ('AR', 'Argentina', 'standard', '2024-12-30'),
  ('PY', 'Paraguay', 'high', '2024-12-30'),
  ('BO', 'Bolivia', 'high', '2024-12-30'),
  ('SE', 'Sweden', 'low', '2024-12-30'),
  ('FI', 'Finland', 'low', '2024-12-30'),
  ('DE', 'Germany', 'low', '2024-12-30'),
  ('FR', 'France', 'low', '2024-12-30'),
  ('JP', 'Japan', 'low', '2024-12-30'),
  ('US', 'United States', 'low', '2024-12-30'),
  ('CA', 'Canada', 'low', '2024-12-30'),
  ('AU', 'Australia', 'low', '2024-12-30'),
  ('NZ', 'New Zealand', 'low', '2024-12-30'),
  ('GB', 'United Kingdom', 'low', '2024-12-30')
on conflict do nothing;
