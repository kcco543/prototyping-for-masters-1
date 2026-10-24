-- =====================================================================
-- 0004 · Say "no" to the Data API explicitly
--
-- After 0003, Supabase's security advisor reported "RLS Enabled No Policy"
-- for every table. Row Level Security with no policies already blocks the
-- Data API completely, but the advisor can't tell whether that was on
-- purpose. These policies make it explicit:
--
--   anon           a visitor using your project's public key (not signed in)
--   authenticated  a visitor signed in with Supabase Auth (this app uses
--                  Better Auth instead, so nobody is ever this role)
--
-- "using (false) with check (false)" means: never show a row, and never
-- accept a new or changed one. This app isn't affected: it connects as the
-- "postgres" user, which owns the tables and isn't anon or authenticated.
--
-- The revoke lines take away those two roles' permission to touch the
-- tables at all, a second lock behind the first.
-- =====================================================================

create policy "No Data API access" on "user" for all to anon, authenticated using (false) with check (false);
create policy "No Data API access" on "session" for all to anon, authenticated using (false) with check (false);
create policy "No Data API access" on "account" for all to anon, authenticated using (false) with check (false);
create policy "No Data API access" on "verification" for all to anon, authenticated using (false) with check (false);
create policy "No Data API access" on "rateLimit" for all to anon, authenticated using (false) with check (false);
create policy "No Data API access" on boards for all to anon, authenticated using (false) with check (false);
create policy "No Data API access" on items for all to anon, authenticated using (false) with check (false);

revoke all on "user", "session", "account", "verification", "rateLimit", boards, items from anon, authenticated;
