-- =============================================================
-- Cocolog: Full initial schema
-- 7 schemas · 30+ tables · multi-tenant · privacy-by-design
-- =============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =============================================================
-- Schemas
-- =============================================================
create schema if not exists integrations;
create schema if not exists ai;
create schema if not exists analytics;
create schema if not exists billing;
create schema if not exists ops;
create schema if not exists audit;

-- =============================================================
-- Enums
-- =============================================================

-- Shared enums (public)
create type public.membership_role_enum as enum ('owner', 'admin', 'member');
create type public.plan_tier_enum       as enum ('free', 'pro', 'enterprise');
create type public.provider_enum        as enum ('slack', 'teams', 'email');
create type public.goal_direction_enum  as enum ('up', 'down');

-- Integration enums
create type integrations.connection_status_enum     as enum ('active', 'revoked', 'expired');
create type integrations.webhook_event_status_enum  as enum ('pending', 'processing', 'processed', 'failed', 'skipped');

-- AI enums
create type ai.signal_value_type_enum as enum ('numeric', 'boolean', 'categorical');
create type ai.run_status_enum        as enum ('pending', 'running', 'completed', 'failed');

-- Billing enums
create type billing.subscription_status_enum as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');

-- Ops enums
create type ops.job_status_enum as enum ('pending', 'running', 'completed', 'failed');

-- =============================================================
-- PUBLIC TABLES
-- =============================================================

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  plan        public.plan_tier_enum not null default 'free',
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        public.membership_role_enum not null default 'member',
  created_at  timestamptz not null default now(),
  unique (org_id, profile_id)
);
create index idx_memberships_profile on public.memberships(profile_id);
create index idx_memberships_org     on public.memberships(org_id);

-- people = analysis subjects; profiles = app users who log in.
-- Many people (Slack users being analyzed) won't have a profile.
create table public.people (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  display_name  text not null,
  email         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_people_org on public.people(org_id);

create table public.identity_links (
  id                uuid primary key default gen_random_uuid(),
  person_id         uuid not null references public.people(id) on delete cascade,
  provider          public.provider_enum not null,
  provider_user_id  text not null,
  provider_team_id  text not null,
  provider_metadata jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  unique (provider, provider_user_id, provider_team_id)
);
create index idx_identity_links_person on public.identity_links(person_id);

create table public.user_settings (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null unique references public.profiles(id) on delete cascade,
  timezone              text not null default 'UTC',
  locale                text not null default 'en',
  digest_day            smallint not null default 1, -- 0=Sun, 1=Mon, … 6=Sat
  notification_channel  text not null default 'email',
  notification_prefs    jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  person_id     uuid references public.people(id) on delete cascade, -- null = org-wide goal
  signal_key    text not null,
  target_value  double precision not null,
  direction     public.goal_direction_enum not null default 'up',
  week_start    date not null,
  week_end      date not null,
  created_by    uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_goals_org on public.goals(org_id);

-- weekly_digests: user-facing coaching digest. coaching_run_id FK added later (after ai tables).
create table public.weekly_digests (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  person_id        uuid not null references public.people(id) on delete cascade,
  week_start       date not null,
  coaching_run_id  uuid, -- FK added after ai.coaching_runs is created
  digest_markdown  text not null default '',
  highlights       jsonb not null default '[]',
  is_read          boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (org_id, person_id, week_start)
);
create index idx_weekly_digests_lookup on public.weekly_digests(org_id, person_id, week_start);

-- =============================================================
-- INTEGRATIONS TABLES
-- =============================================================

-- Provider-agnostic connection record
create table integrations.connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  provider      public.provider_enum not null,
  status        integrations.connection_status_enum not null default 'active',
  config        jsonb not null default '{}',
  installed_by  uuid not null references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, provider) -- one connection per provider per org for now
);

-- Provider-specific installation details (e.g. Slack bot token, team info)
create table integrations.installations (
  id                uuid primary key default gen_random_uuid(),
  connection_id     uuid not null unique references integrations.connections(id) on delete cascade,
  provider_team_id  text not null unique,
  team_name         text not null,
  bot_token         text not null, -- encrypted at rest via Supabase Vault in prod
  bot_user_id       text not null,
  scopes            text[] not null default '{}',
  raw_oauth         jsonb not null default '{}', -- full OAuth response for debugging
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table integrations.external_users (
  id                uuid primary key default gen_random_uuid(),
  connection_id     uuid not null references integrations.connections(id) on delete cascade,
  provider_user_id  text not null,
  display_name      text not null,
  email             text,
  avatar_url        text,
  raw_profile       jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (connection_id, provider_user_id)
);

create table integrations.external_channels (
  id                    uuid primary key default gen_random_uuid(),
  connection_id         uuid not null references integrations.connections(id) on delete cascade,
  provider_channel_id   text not null,
  name                  text not null,
  channel_type          text not null default 'public',
  is_monitored          boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (connection_id, provider_channel_id)
);

create table integrations.webhook_events (
  id                uuid primary key default gen_random_uuid(),
  connection_id     uuid not null references integrations.connections(id) on delete cascade,
  provider_event_id text,            -- provider's event ID for dedup
  event_type        text not null,
  status            integrations.webhook_event_status_enum not null default 'pending',
  payload_hash      text not null,   -- SHA-256 of payload for dedup
  attempts          smallint not null default 0,
  last_error        text,
  created_at        timestamptz not null default now(),
  processed_at      timestamptz
);
create index idx_webhook_events_status on integrations.webhook_events(status) where status in ('pending', 'processing', 'failed');
create index idx_webhook_events_conn   on integrations.webhook_events(connection_id, created_at desc);

create table integrations.message_refs (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  person_id             uuid not null references public.people(id) on delete cascade,
  connection_id         uuid not null references integrations.connections(id) on delete cascade,
  provider_message_id   text not null,
  provider_channel_id   text not null,
  permalink             text,
  content_hash          text not null,     -- SHA-256 of message body
  message_ts            timestamptz not null,
  metadata              jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  unique (connection_id, provider_message_id)
);
create index idx_message_refs_org_person on integrations.message_refs(org_id, person_id);
create index idx_message_refs_ts         on integrations.message_refs(message_ts);

-- Ephemeral encrypted message body. Purged after AI analysis (TTL-based).
-- The app encrypts before INSERT and decrypts after SELECT; DB stores opaque bytes.
create table integrations.message_content_secure (
  id                uuid primary key default gen_random_uuid(),
  message_ref_id    uuid not null unique references integrations.message_refs(id) on delete cascade,
  encrypted_body    bytea not null,
  encryption_key_id text not null,     -- references external key management
  ttl_expires_at    timestamptz not null default (now() + interval '1 hour'),
  created_at        timestamptz not null default now()
);
create index idx_message_content_ttl on integrations.message_content_secure(ttl_expires_at);

-- =============================================================
-- AI TABLES
-- =============================================================

create table ai.taxonomy_versions (
  id                  uuid primary key default gen_random_uuid(),
  version_label       text not null unique,
  signal_definitions  jsonb not null,  -- { signal_key: {label, category, value_type, description} }
  is_active           boolean not null default true,
  created_at          timestamptz not null default now()
);

create table ai.model_versions (
  id              uuid primary key default gen_random_uuid(),
  model_name      text not null,
  prompt_hash     text not null,       -- SHA-256 of prompt template
  prompt_template text not null default '',
  description     text not null default '',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (model_name, prompt_hash)
);

-- Replaces per-signal rows (signal_scores) with one row per message.
-- scores column stores all signal values: { "clarity": {"value": 0.85, "confidence": 0.9}, … }
create table ai.message_analyses (
  id                    uuid primary key default gen_random_uuid(),
  message_ref_id        uuid not null references integrations.message_refs(id) on delete cascade,
  model_version_id      uuid not null references ai.model_versions(id),
  taxonomy_version_id   uuid not null references ai.taxonomy_versions(id),
  scores                jsonb not null default '{}',
  reasoning             text,
  latency_ms            int,
  created_at            timestamptz not null default now()
);
create index idx_message_analyses_ref on ai.message_analyses(message_ref_id);

create table ai.coaching_runs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  person_id         uuid not null references public.people(id) on delete cascade,
  model_version_id  uuid not null references ai.model_versions(id),
  week_start        date not null,
  status            ai.run_status_enum not null default 'pending',
  input_summary     jsonb not null default '{}',  -- aggregated metrics used as input
  output_markdown   text,
  highlights        jsonb not null default '[]',
  latency_ms        int,
  error_message     text,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz,
  unique (org_id, person_id, week_start, model_version_id)
);

-- Now add deferred FK from weekly_digests to ai.coaching_runs
alter table public.weekly_digests
  add constraint fk_weekly_digests_coaching_run
  foreign key (coaching_run_id) references ai.coaching_runs(id) on delete set null;

-- =============================================================
-- ANALYTICS TABLES
-- =============================================================

-- metrics column: { "clarity": {"avg": 0.8, "min": 0.5, "max": 1.0, "sum": 4.0, "count": 5}, … }
create table analytics.person_daily_metrics (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  person_id             uuid not null references public.people(id) on delete cascade,
  date                  date not null,
  taxonomy_version_id   uuid not null references ai.taxonomy_versions(id),
  metrics               jsonb not null default '{}',
  message_count         int not null default 0,
  created_at            timestamptz not null default now(),
  unique (org_id, person_id, date, taxonomy_version_id)
);
create index idx_pdm_lookup on analytics.person_daily_metrics(org_id, person_id, date);

create table analytics.person_weekly_metrics (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  person_id             uuid not null references public.people(id) on delete cascade,
  week_start            date not null,
  taxonomy_version_id   uuid not null references ai.taxonomy_versions(id),
  metrics               jsonb not null default '{}',
  message_count         int not null default 0,
  prev_week_metrics     jsonb,  -- snapshot of previous week for delta calculation
  created_at            timestamptz not null default now(),
  unique (org_id, person_id, week_start, taxonomy_version_id)
);
create index idx_pwm_lookup on analytics.person_weekly_metrics(org_id, person_id, week_start);

create table analytics.org_weekly_metrics (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  week_start            date not null,
  taxonomy_version_id   uuid not null references ai.taxonomy_versions(id),
  metrics               jsonb not null default '{}',
  active_people_count   int not null default 0,
  total_message_count   int not null default 0,
  created_at            timestamptz not null default now(),
  unique (org_id, week_start, taxonomy_version_id)
);

-- =============================================================
-- BILLING TABLES
-- =============================================================

create table billing.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null unique references public.organizations(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  plan                    public.plan_tier_enum not null default 'free',
  status                  billing.subscription_status_enum not null default 'active',
  seat_limit              int,          -- null = unlimited (free tier)
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table billing.seat_snapshots (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references public.organizations(id) on delete cascade,
  snapshot_date           date not null,
  seat_count              int not null,  -- profiles with active membership
  billable_people_count   int not null,  -- people with is_active=true
  created_at              timestamptz not null default now(),
  unique (org_id, snapshot_date)
);

-- =============================================================
-- OPS TABLES
-- =============================================================

create table ops.job_runs (
  id              uuid primary key default gen_random_uuid(),
  job_name        text not null,
  status          ops.job_status_enum not null default 'pending',
  started_at      timestamptz,
  completed_at    timestamptz,
  metadata        jsonb not null default '{}',
  error_message   text,
  created_at      timestamptz not null default now()
);
create index idx_job_runs_name_status on ops.job_runs(job_name, status);

create table ops.idempotency_keys (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  scope       text not null default 'global',
  response    jsonb,
  expires_at  timestamptz not null default (now() + interval '24 hours'),
  created_at  timestamptz not null default now()
);
create index idx_idempotency_expires on ops.idempotency_keys(expires_at);

-- =============================================================
-- AUDIT TABLE
-- =============================================================

create table audit.event_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references public.organizations(id) on delete set null,
  actor_id      uuid references public.profiles(id) on delete set null,
  action        text not null,
  resource_type text not null,
  resource_id   text,
  metadata      jsonb not null default '{}',
  ip_address    inet,
  created_at    timestamptz not null default now()
);
create index idx_event_log_org on audit.event_log(org_id, created_at desc);
create index idx_event_log_action on audit.event_log(action, created_at desc);

-- =============================================================
-- TRIGGERS: updated_at
-- =============================================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- public
create trigger trg_organizations_updated before update on public.organizations     for each row execute function public.set_updated_at();
create trigger trg_profiles_updated       before update on public.profiles         for each row execute function public.set_updated_at();
create trigger trg_people_updated         before update on public.people           for each row execute function public.set_updated_at();
create trigger trg_user_settings_updated  before update on public.user_settings    for each row execute function public.set_updated_at();
create trigger trg_goals_updated          before update on public.goals            for each row execute function public.set_updated_at();

-- integrations
create trigger trg_connections_updated     before update on integrations.connections     for each row execute function public.set_updated_at();
create trigger trg_installations_updated   before update on integrations.installations   for each row execute function public.set_updated_at();
create trigger trg_ext_users_updated       before update on integrations.external_users  for each row execute function public.set_updated_at();
create trigger trg_ext_channels_updated    before update on integrations.external_channels for each row execute function public.set_updated_at();

-- billing
create trigger trg_subscriptions_updated   before update on billing.subscriptions        for each row execute function public.set_updated_at();

-- =============================================================
-- TRIGGER: auto-create profile + user_settings on auth signup
-- =============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'User'),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_settings (profile_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- HELPER FUNCTIONS
-- =============================================================

create or replace function public.get_user_org_ids()
returns setof uuid
language sql security definer stable
as $$
  select org_id from public.memberships where profile_id = auth.uid();
$$;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists(
    select 1 from public.memberships
    where profile_id = auth.uid()
      and org_id = target_org_id
      and role in ('owner', 'admin')
  );
$$;

-- =============================================================
-- ROW LEVEL SECURITY (public tables only)
-- =============================================================

-- organizations
alter table public.organizations enable row level security;
create policy "Users can view their orgs"
  on public.organizations for select
  using (id in (select public.get_user_org_ids()));
create policy "Admins can update their orgs"
  on public.organizations for update
  using (public.is_org_admin(id));

-- profiles
alter table public.profiles enable row level security;
create policy "Users can view profiles in their orgs"
  on public.profiles for select
  using (
    id = auth.uid()
    or id in (select profile_id from public.memberships where org_id in (select public.get_user_org_ids()))
  );
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- memberships
alter table public.memberships enable row level security;
create policy "Users can view memberships in their orgs"
  on public.memberships for select
  using (org_id in (select public.get_user_org_ids()));
create policy "Admins can insert memberships"
  on public.memberships for insert
  with check (public.is_org_admin(org_id));
create policy "Admins can delete memberships"
  on public.memberships for delete
  using (public.is_org_admin(org_id));

-- people
alter table public.people enable row level security;
create policy "Users can view people in their orgs"
  on public.people for select
  using (org_id in (select public.get_user_org_ids()));
create policy "Admins can manage people"
  on public.people for all
  using (public.is_org_admin(org_id));

-- identity_links
alter table public.identity_links enable row level security;
create policy "Users can view identity links in their orgs"
  on public.identity_links for select
  using (
    person_id in (select id from public.people where org_id in (select public.get_user_org_ids()))
  );

-- user_settings
alter table public.user_settings enable row level security;
create policy "Users can view own settings"
  on public.user_settings for select
  using (profile_id = auth.uid());
create policy "Users can update own settings"
  on public.user_settings for update
  using (profile_id = auth.uid());

-- goals
alter table public.goals enable row level security;
create policy "Users can view goals in their orgs"
  on public.goals for select
  using (org_id in (select public.get_user_org_ids()));
create policy "Admins can manage goals"
  on public.goals for all
  using (public.is_org_admin(org_id));

-- weekly_digests
alter table public.weekly_digests enable row level security;
create policy "Users can view digests in their orgs"
  on public.weekly_digests for select
  using (org_id in (select public.get_user_org_ids()));
create policy "Users can mark digests as read"
  on public.weekly_digests for update
  using (org_id in (select public.get_user_org_ids()))
  with check (org_id in (select public.get_user_org_ids()));

-- =============================================================
-- SCHEMA ACCESS CONTROL
-- Non-public schemas: service_role only. Revoke from anon/authenticated.
-- =============================================================

do $$
declare
  s text;
begin
  foreach s in array array['integrations','ai','analytics','billing','ops','audit']
  loop
    execute format('grant usage on schema %I to postgres, service_role', s);
    execute format('grant all on all tables in schema %I to postgres, service_role', s);
    execute format('grant all on all sequences in schema %I to postgres, service_role', s);
    execute format('alter default privileges in schema %I grant all on tables to postgres, service_role', s);
    execute format('alter default privileges in schema %I grant all on sequences to postgres, service_role', s);
    execute format('revoke all on schema %I from anon, authenticated', s);
  end loop;
end;
$$;

-- =============================================================
-- PUBLIC VIEWS for dashboard consumption
-- These run as view-owner (superuser) so they can read non-public
-- schemas, but filter rows by auth.uid() / get_user_org_ids().
-- =============================================================

create or replace view public.v_my_installations with (security_barrier = true) as
select
  c.id          as connection_id,
  c.org_id,
  c.provider,
  c.status,
  i.id          as installation_id,
  i.provider_team_id as team_id,
  i.team_name,
  i.bot_user_id,
  i.scopes,
  i.created_at
from integrations.connections c
join integrations.installations i on i.connection_id = c.id
where c.org_id in (select public.get_user_org_ids());

create or replace view public.v_person_weekly_metrics with (security_barrier = true) as
select
  m.id,
  m.org_id,
  m.person_id,
  p.display_name as person_name,
  m.week_start,
  m.metrics,
  m.message_count,
  m.prev_week_metrics,
  m.created_at
from analytics.person_weekly_metrics m
join public.people p on p.id = m.person_id
where m.org_id in (select public.get_user_org_ids());

create or replace view public.v_org_weekly_metrics with (security_barrier = true) as
select
  m.id,
  m.org_id,
  o.name as org_name,
  m.week_start,
  m.metrics,
  m.active_people_count,
  m.total_message_count,
  m.created_at
from analytics.org_weekly_metrics m
join public.organizations o on o.id = m.org_id
where m.org_id in (select public.get_user_org_ids());

-- =============================================================
-- OPS: purge expired ephemeral content
-- =============================================================

create or replace function ops.purge_expired_content()
returns integer
language sql
as $$
  with deleted as (
    delete from integrations.message_content_secure
    where ttl_expires_at < now()
    returning 1
  )
  select count(*)::integer from deleted;
$$;
