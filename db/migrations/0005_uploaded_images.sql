-- =====================================================================
-- 0005 · Upload images from your computer
--
-- The files themselves go in Supabase Storage, in a PRIVATE bucket called
-- "item-images". The items table only stores where each file is (its
-- "path"), never the picture itself.
--
-- Who may upload or delete? Supabase Storage's own access rules ("policies"
-- on storage.objects) can only recognise people signed in with Supabase
-- Auth, and this app uses Better Auth. So nobody gets direct access: there
-- are no storage policies, which means Supabase's public API can't read,
-- upload or delete anything in this bucket. Only the app's server, which
-- holds SUPABASE_SECRET_KEY, can. It checks who you are first, and only
-- ever lets you upload or delete files under your own folder:
--
--   <your user id>/<board id>/<random id>.<jpg|png|webp|gif|avif>
-- =====================================================================

-- The bucket. `public = false` means every picture needs a signed,
-- short-lived link to be seen. Supabase itself also refuses files over
-- 5 MB, or anything that isn't one of these image types. (No SVG: an SVG
-- file can contain code.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
);

-- Where an uploaded picture is, inside the bucket. An item has either an
-- image address from another website (image_url) or an uploaded picture
-- (image_path), never both.
alter table items
  add column image_path text
    check (image_path ~ '^[A-Za-z0-9_-]{1,64}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif|avif)$');

-- Every item still needs something to show: a picture (either kind) or a link.
alter table items drop constraint items_image_or_link;
alter table items
  add constraint items_image_or_link
    check (image_url is not null or image_path is not null or link_url is not null),
  add constraint items_one_kind_of_image
    check (image_url is null or image_path is null);
