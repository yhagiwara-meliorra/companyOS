-- ============================================================
-- Migration 002: Helper functions & triggers
-- (テーブル非依存のものだけ。テーブル依存関数は 003b で定義)
-- ============================================================

-- ── 1. auto-update updated_at ────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── 2. create profile on new auth user ──────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- ── 3. convenience: apply updated_at trigger to a table ─────
create or replace function public.apply_updated_at_trigger(tbl text)
returns void as $$
begin
  execute format(
    'create trigger set_updated_at before update on public.%I '
    'for each row execute function public.set_updated_at();',
    tbl
  );
end;
$$ language plpgsql;
