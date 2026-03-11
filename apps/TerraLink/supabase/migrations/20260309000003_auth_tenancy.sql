-- ============================================================
-- Migration 003: Auth / Tenancy tables
--   profiles, workspaces, workspace_members,
--   organizations, organization_members, workspace_organizations
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

select public.apply_updated_at_trigger('profiles');

-- ── workspaces ───────────────────────────────────────────────
create table public.workspaces (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique not null,
  plan_code           text not null default 'starter',
  primary_buyer_org_id uuid,                     -- fk added after organizations
  settings            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index idx_workspaces_slug on public.workspaces (slug) where deleted_at is null;

select public.apply_updated_at_trigger('workspaces');

-- ── workspace_members ────────────────────────────────────────
create table public.workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  role          text not null check (role in (
                  'owner','admin','analyst','reviewer','supplier_manager','viewer')),
  status        text not null default 'invited' check (status in (
                  'invited','active','disabled')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index idx_wm_user on public.workspace_members (user_id) where status = 'active';
create index idx_wm_workspace on public.workspace_members (workspace_id);

select public.apply_updated_at_trigger('workspace_members');

-- ── organizations ────────────────────────────────────────────
create table public.organizations (
  id            uuid primary key default gen_random_uuid(),
  legal_name    text not null,
  display_name  text not null,
  org_type      text not null check (org_type in (
                  'buyer','supplier','customer','partner','logistics','internal')),
  country_code  text,
  website       text,
  external_refs jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index idx_org_type on public.organizations (org_type) where deleted_at is null;
create index idx_org_country on public.organizations (country_code) where deleted_at is null;

select public.apply_updated_at_trigger('organizations');

-- Add FK from workspaces → organizations now that organizations exists
alter table public.workspaces
  add constraint fk_workspaces_primary_buyer_org
  foreign key (primary_buyer_org_id)
  references public.organizations (id) on delete set null;

-- ── organization_members ─────────────────────────────────────
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations on delete cascade,
  user_id         uuid not null references auth.users on delete cascade,
  role            text not null check (role in (
                    'org_owner','org_admin','contributor','viewer')),
  share_default   boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index idx_om_user on public.organization_members (user_id);
create index idx_om_org  on public.organization_members (organization_id);

select public.apply_updated_at_trigger('organization_members');

-- ── workspace_organizations ──────────────────────────────────
create table public.workspace_organizations (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces on delete cascade,
  organization_id     uuid not null references public.organizations on delete cascade,
  relationship_role   text not null check (relationship_role in (
                        'buyer','supplier','customer','partner','site_owner')),
  tier                integer,
  status              text not null default 'invited' check (status in (
                        'invited','active','archived')),
  verification_status text not null default 'inferred' check (verification_status in (
                        'inferred','declared','verified')),
  invited_by          uuid references auth.users,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (workspace_id, organization_id, relationship_role)
);

create index idx_wo_workspace on public.workspace_organizations (workspace_id);
create index idx_wo_org       on public.workspace_organizations (organization_id);
create index idx_wo_tier      on public.workspace_organizations (workspace_id, tier);

select public.apply_updated_at_trigger('workspace_organizations');
