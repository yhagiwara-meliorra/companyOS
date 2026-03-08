-- Company Builder OS / AI CEO scaffold schema
-- Target: Supabase Postgres
-- Notes:
--   - Uses auth.users for identity
--   - Uses one "thread" UUID as both the application thread ID and the LangGraph thread_id
--   - Keeps Decision Packet as the canonical JSON document while also extracting first-class review fields for filtering and approvals

create extension if not exists pgcrypto;

create type public.thread_type as enum (
  'company_strategy',
  'new_product',
  'service_addition',
  'go_to_market',
  'legal_policy_change',
  'pricing_change',
  'partnership',
  'other'
);

create type public.thread_status as enum (
  'open',
  'in_review',
  'approved',
  'rejected',
  'archived'
);

create type public.packet_status as enum (
  'draft',
  'review_required',
  'approved',
  'rejected'
);

create type public.artifact_type as enum (
  'prd',
  'build_plan',
  'gtm_brief',
  'legal_change_request',
  'pricing_memo'
);

create type public.artifact_status as enum (
  'queued',
  'running',
  'completed',
  'failed'
);

create type public.approval_status as enum (
  'pending',
  'approved',
  'rejected',
  'superseded'
);

create type public.message_role as enum (
  'system',
  'user',
  'assistant',
  'tool'
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id),
  thread_type public.thread_type not null,
  status public.thread_status not null default 'open',
  title text not null,
  raw_user_input text not null,
  constitution_snapshot text not null,
  summary text,
  last_message_at timestamptz,
  langgraph_thread_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  role public.message_role not null,
  actor_name text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_packets (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null check (version > 0),
  status public.packet_status not null default 'draft',
  title text not null,
  summary text not null,
  packet_json jsonb not null,
  constitution_decision text not null,
  approval_required boolean not null default false,
  approval_reasons text[] not null default '{}',
  estimated_cost_impact_jpy integer,
  changes_ceo_ai_design boolean not null default false,
  legal_trigger_required boolean not null default false,
  final_decision text not null check (final_decision in ('go', 'hold', 'reject')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (thread_id, version)
);

create table if not exists public.packet_artifact_requests (
  id uuid primary key default gen_random_uuid(),
  decision_packet_id uuid not null references public.decision_packets(id) on delete cascade,
  artifact_type public.artifact_type not null,
  status public.artifact_status not null default 'queued',
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  unique (decision_packet_id, artifact_type)
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  decision_packet_id uuid references public.decision_packets(id) on delete set null,
  request_id uuid references public.packet_artifact_requests(id) on delete set null,
  artifact_type public.artifact_type not null,
  title text not null,
  content_markdown text,
  content_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  status public.artifact_status not null default 'completed',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  decision_packet_id uuid not null references public.decision_packets(id) on delete cascade,
  status public.approval_status not null default 'pending',
  reasons text[] not null default '{}',
  requested_by uuid references auth.users(id),
  reviewer_id uuid references auth.users(id),
  reviewed_at timestamptz,
  review_comment text,
  edited_packet_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.legal_change_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.threads(id) on delete cascade,
  decision_packet_id uuid references public.decision_packets(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'drafted', 'approved', 'closed')),
  trigger_reason text not null,
  impacted_documents text[] not null default '{}',
  request_payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  owner_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graph_runs (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  decision_packet_id uuid references public.decision_packets(id) on delete set null,
  run_status text not null check (run_status in ('running', 'waiting_human', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_memberships_user_id on public.memberships(user_id);
create index if not exists idx_threads_org_id on public.threads(organization_id);
create index if not exists idx_threads_created_by on public.threads(created_by);
create index if not exists idx_threads_thread_type on public.threads(thread_type);
create index if not exists idx_thread_messages_thread_id_created_at on public.thread_messages(thread_id, created_at);
create index if not exists idx_decision_packets_thread_id on public.decision_packets(thread_id);
create index if not exists idx_decision_packets_org_id on public.decision_packets(organization_id);
create index if not exists idx_decision_packets_status on public.decision_packets(status);
create index if not exists idx_packet_artifact_requests_packet_id on public.packet_artifact_requests(decision_packet_id);
create index if not exists idx_artifacts_thread_id on public.artifacts(thread_id);
create index if not exists idx_artifacts_packet_id on public.artifacts(decision_packet_id);
create index if not exists idx_approvals_packet_id on public.approvals(decision_packet_id);
create index if not exists idx_legal_change_requests_thread_id on public.legal_change_requests(thread_id);
create index if not exists idx_graph_runs_thread_id on public.graph_runs(thread_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger trg_threads_updated_at
before update on public.threads
for each row execute function public.set_updated_at();

create trigger trg_decision_packets_updated_at
before update on public.decision_packets
for each row execute function public.set_updated_at();

create trigger trg_artifacts_updated_at
before update on public.artifacts
for each row execute function public.set_updated_at();

create trigger trg_approvals_updated_at
before update on public.approvals
for each row execute function public.set_updated_at();

create trigger trg_legal_change_requests_updated_at
before update on public.legal_change_requests
for each row execute function public.set_updated_at();

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
  );
$$;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.decision_packets enable row level security;
alter table public.packet_artifact_requests enable row level security;
alter table public.artifacts enable row level security;
alter table public.approvals enable row level security;
alter table public.legal_change_requests enable row level security;
alter table public.graph_runs enable row level security;

create policy "orgs_select_member"
on public.organizations for select
using (public.is_org_member(id));

create policy "memberships_select_member"
on public.memberships for select
using (public.is_org_member(organization_id));

create policy "threads_select_member"
on public.threads for select
using (public.is_org_member(organization_id));

create policy "threads_insert_member"
on public.threads for insert
with check (public.is_org_member(organization_id));

create policy "threads_update_member"
on public.threads for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "thread_messages_select_member"
on public.thread_messages for select
using (
  exists (
    select 1 from public.threads t
    where t.id = thread_messages.thread_id
      and public.is_org_member(t.organization_id)
  )
);

create policy "thread_messages_insert_member"
on public.thread_messages for insert
with check (
  exists (
    select 1 from public.threads t
    where t.id = thread_messages.thread_id
      and public.is_org_member(t.organization_id)
  )
);

create policy "decision_packets_select_member"
on public.decision_packets for select
using (public.is_org_member(organization_id));

create policy "decision_packets_insert_member"
on public.decision_packets for insert
with check (public.is_org_member(organization_id));

create policy "decision_packets_update_member"
on public.decision_packets for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "packet_artifact_requests_select_member"
on public.packet_artifact_requests for select
using (
  exists (
    select 1 from public.decision_packets dp
    where dp.id = packet_artifact_requests.decision_packet_id
      and public.is_org_member(dp.organization_id)
  )
);

create policy "packet_artifact_requests_insert_member"
on public.packet_artifact_requests for insert
with check (
  exists (
    select 1 from public.decision_packets dp
    where dp.id = packet_artifact_requests.decision_packet_id
      and public.is_org_member(dp.organization_id)
  )
);

create policy "artifacts_select_member"
on public.artifacts for select
using (public.is_org_member(organization_id));

create policy "artifacts_insert_member"
on public.artifacts for insert
with check (public.is_org_member(organization_id));

create policy "artifacts_update_member"
on public.artifacts for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "approvals_select_member"
on public.approvals for select
using (public.is_org_member(organization_id));

create policy "approvals_insert_member"
on public.approvals for insert
with check (public.is_org_member(organization_id));

create policy "approvals_update_member"
on public.approvals for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "legal_change_requests_select_member"
on public.legal_change_requests for select
using (public.is_org_member(organization_id));

create policy "legal_change_requests_insert_member"
on public.legal_change_requests for insert
with check (public.is_org_member(organization_id));

create policy "legal_change_requests_update_member"
on public.legal_change_requests for update
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "graph_runs_select_member"
on public.graph_runs for select
using (
  exists (
    select 1 from public.threads t
    where t.id = graph_runs.thread_id
      and public.is_org_member(t.organization_id)
  )
);

create policy "graph_runs_insert_member"
on public.graph_runs for insert
with check (
  exists (
    select 1 from public.threads t
    where t.id = graph_runs.thread_id
      and public.is_org_member(t.organization_id)
  )
);

create table if not exists public.langgraph_checkpoints (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  parent_checkpoint_id text,
  checkpoint_json text not null,
  metadata_json text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);

create table if not exists public.langgraph_writes (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  task_id text not null,
  idx integer not null,
  channel text not null,
  value_json text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx),
  foreign key (thread_id, checkpoint_ns, checkpoint_id)
    references public.langgraph_checkpoints(thread_id, checkpoint_ns, checkpoint_id)
    on delete cascade
);

create index if not exists idx_langgraph_checkpoints_thread_ns
  on public.langgraph_checkpoints(thread_id, checkpoint_ns, checkpoint_id desc);

create index if not exists idx_langgraph_writes_thread_ns_checkpoint
  on public.langgraph_writes(thread_id, checkpoint_ns, checkpoint_id);

-- Bootstrap note:
-- The first organization + owner membership is often created via service role,
-- an admin script, or an onboarding edge function before normal RLS applies.
