-- WebVault: make per-user bookmark and category changes available to Supabase Realtime.
-- This migration is idempotent and is safe to run once in the Supabase SQL editor.

do $$
begin
  alter publication supabase_realtime add table public.categories;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.sites;
exception
  when duplicate_object then null;
end;
$$;
