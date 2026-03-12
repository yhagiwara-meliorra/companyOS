-- =============================================================
-- INVITATIONS TABLE
-- =============================================================
-- Invite links for org member onboarding.
-- Owner/admin generates a token → recipient uses it to join.

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  role        public.membership_role_enum not null default 'member',
  created_by  uuid not null references public.profiles(id),
  expires_at  timestamptz not null default (now() + interval '7 days'),
  max_uses    int default 1,
  use_count   int not null default 0,
  used_by     uuid references public.profiles(id),
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_invitations_org on public.invitations(org_id);
create index idx_invitations_token on public.invitations(token);

-- RLS: org members can view their org's invitations
alter table public.invitations enable row level security;

create policy "org members can view invitations"
  on public.invitations for select
  using (
    org_id in (
      select org_id from public.memberships
      where profile_id = auth.uid()
    )
  );

create policy "owner/admin can insert invitations"
  on public.invitations for insert
  with check (
    org_id in (
      select org_id from public.memberships
      where profile_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );
