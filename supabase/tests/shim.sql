-- =============================================================================
-- Supabase environment shim — used ONLY by supabase/tests/schema.mjs
--
-- This is not deployed anywhere. It exists so the migration files can be
-- executed against a real PostgreSQL (PGlite: PostgreSQL compiled to
-- WebAssembly) on any laptop, with no cloud Supabase project, no Docker and
-- no database server to install.
--
-- A real Supabase project already provides every object created here. The shim
-- recreates only the pieces the migrations touch, so a failure in the output
-- is a failure in OUR SQL rather than a missing platform feature.
--
-- What it fakes:
--   auth.users            the accounts table our host_id / user_id FKs point at
--   auth.uid()            reads the same `request.jwt.claim.sub` GUC that
--                         PostgREST sets, so RLS policies behave identically
--   anon / authenticated  the two roles the Supabase API switches into
--   supabase_realtime     the publication that Realtime listens on
--
-- IMPORTANT — why every access-control test does `set role`:
-- PostgreSQL does not apply Row Level Security to a table's owner, nor to a
-- superuser. The migrations are applied as superuser (exactly as Supabase's
-- `postgres` role does), so a test that queried as superuser would pass no
-- matter how broken the policies were. schema.mjs therefore switches into
-- `authenticated` or `anon` before asserting anything about access.
-- =============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

-- Same contract as Supabase's auth.uid(): the current request's subject claim,
-- or NULL for an anonymous request.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
end
$$;

-- Supabase provisions this publication when a project is created.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
