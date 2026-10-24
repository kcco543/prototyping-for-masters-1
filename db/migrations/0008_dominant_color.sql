-- =====================================================================
-- 0008 · Each picture's dominant colour
--
-- When an item with a picture is saved, the server finds the picture's
-- most common colour (lib/dominant-color.ts) and stores it here as a hex
-- code like "#d4532f". The board's "By colour" view sorts items by it.
--
-- It's empty (null) for items without a picture, and for pictures the
-- server couldn't read (for example, a website that refused to send it).
-- =====================================================================

alter table items
  add column dominant_color text check (dominant_color ~ '^#[0-9a-f]{6}$');
