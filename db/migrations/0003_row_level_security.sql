-- =====================================================================
-- 0003 · Lock Supabase's automatic API out of every table
--
-- Supabase also shares tables in the "public" schema through its own web
-- API (the "Data API"), which anyone with your project's public
-- anon/publishable key could call. This app doesn't use that API: it
-- connects directly with DATABASE_URL, as the "postgres" user that owns
-- these tables.
--
-- Switching on Row Level Security (RLS) without adding any policies means
-- the Data API sees no rows at all, while the table owner (this app) still
-- can. Without this, your users' emails and password hashes could be
-- readable through that API.
-- =====================================================================

alter table "user" enable row level security;
alter table "session" enable row level security;
alter table "account" enable row level security;
alter table "verification" enable row level security;
alter table "rateLimit" enable row level security;
alter table boards enable row level security;
alter table items enable row level security;
