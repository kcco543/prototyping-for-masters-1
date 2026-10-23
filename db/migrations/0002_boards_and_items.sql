-- =====================================================================
-- 0002 · Your boards and items
--
-- The Inspiration library's own tables. They belong to Better Auth's users
-- (0001 must run first), and every query in
-- app/prototypes/inspiration-library/lib/boards.ts matches these columns.
-- =====================================================================

-- A board is a collection, like "Packaging" or "Type specimens".
create table boards (
  id          uuid primary key default gen_random_uuid(),
  -- Whose board it is: the Better Auth user id. "references" makes it a
  -- foreign key: Postgres refuses a user_id that isn't a real user, and
  -- "on delete cascade" deletes your boards if your account is deleted.
  user_id     text not null references "user" (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  -- Private unless you make it public.
  is_public   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- An item is one saved thing on a board: a picture, a link, or both.
create table items (
  id         uuid primary key default gen_random_uuid(),
  -- "on delete cascade": deleting a board deletes all of its items too.
  board_id   uuid not null references boards (id) on delete cascade,
  user_id    text not null references "user" (id) on delete cascade,
  image_url  text check (char_length(image_url) <= 2048),
  link_url   text check (char_length(link_url) <= 2048),
  title      text not null default '' check (char_length(title) <= 200),
  note       text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  -- Every item needs at least a picture or a link.
  constraint items_image_or_link check (image_url is not null or link_url is not null)
);

-- Indexes are like the index at the back of a book: they let Postgres jump
-- straight to "the boards of this user" or "the items of this board"
-- instead of reading every row. Each one also keeps the rows sorted newest
-- first, which is the order the pages show them in.
create index boards_user_id_idx on boards (user_id, created_at desc);
create index items_board_id_idx on items (board_id, created_at desc);
create index items_user_id_idx on items (user_id);
