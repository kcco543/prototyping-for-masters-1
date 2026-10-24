-- =====================================================================
-- 0006 · An item can be on more than one board
--
-- Before: each item had ONE board_id, so it lived on exactly one board.
-- After: a separate "join table", board_items, has one row per
-- (board, item) pair. Put an item on three boards → three rows. The item
-- itself (picture, link, title, note) is stored once, so changing it
-- changes it everywhere.
--
--   boards ──< board_items >── items
--   (one board has many rows; one item has many rows)
--
-- Order matters: create the table, copy every item's current board into
-- it, and only THEN remove items.board_id. It all runs as one migration, so
-- if any step fails, nothing changes.
-- =====================================================================

-- 1. Make (id, user_id) referenceable on both tables, so board_items can
--    insist that a board and an item have the SAME owner (step 2). id is
--    already unique on its own, so these can never fail.
alter table boards add constraint boards_id_user_id_key unique (id, user_id);
alter table items add constraint items_id_user_id_key unique (id, user_id);

-- 2. The join table.
create table board_items (
  board_id uuid not null,
  item_id  uuid not null,
  -- The owner of both. Stored here so the two foreign keys below can check
  -- that the board and the item belong to the same person: Postgres itself
  -- refuses to put your item on someone else's board.
  user_id  text not null,
  -- When the item was put on THIS board, so each board lists its items
  -- newest first, even an old item you've just added.
  added_at timestamptz not null default now(),

  -- The same item can only be on the same board once.
  primary key (board_id, item_id),
  -- "on delete cascade": deleting a board (or an item) removes its rows
  -- here too. Deleting a board does NOT delete the items themselves: the
  -- app deletes the ones that were on no other board (lib/boards.ts).
  foreign key (board_id, user_id) references boards (id, user_id) on delete cascade,
  foreign key (item_id, user_id) references items (id, user_id) on delete cascade
);

-- The primary key already makes "the items on this board" quick. These
-- make "the boards this item is on" and "this board's items, newest
-- first" quick too.
create index board_items_item_id_idx on board_items (item_id);
create index board_items_board_id_added_at_idx on board_items (board_id, added_at desc);

-- 3. Move every existing item into the join table, keeping its board and
--    using its creation time as the time it was added.
insert into board_items (board_id, item_id, user_id, added_at)
select board_id, id, user_id, created_at from items;

-- 4. The old column (with its foreign key and index) is no longer needed.
alter table items drop column board_id;

-- 5. The same lock as every other table (see 0003 and 0004): Supabase's
--    Data API can't see or change anything here. The app connects as the
--    table's owner, so it isn't affected.
alter table board_items enable row level security;
create policy "No Data API access" on board_items for all to anon, authenticated using (false) with check (false);
revoke all on board_items from anon, authenticated;
