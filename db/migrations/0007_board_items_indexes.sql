-- =====================================================================
-- 0007 · Indexes for board_items' "same owner" foreign keys
--
-- Supabase's performance advisor flagged the two foreign keys added in
-- 0006, (board_id, user_id) and (item_id, user_id), as having no index
-- with exactly those columns. When a board or an item is deleted, Postgres
-- uses these foreign keys to find the board_items rows to remove ("on
-- delete cascade"); an index lets it jump straight to them instead of
-- reading the whole table.
--
-- The (item_id, user_id) index also does the job of the old item_id-only
-- index, so that one goes.
-- =====================================================================

create index board_items_board_id_user_id_idx on board_items (board_id, user_id);
create index board_items_item_id_user_id_idx on board_items (item_id, user_id);
drop index board_items_item_id_idx;
