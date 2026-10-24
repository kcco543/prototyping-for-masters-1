/**
 * Uploaded pictures, in Supabase Storage. Server only.
 *
 * The pictures live in a PRIVATE bucket, "item-images" (made by
 * db/migrations/0005_uploaded_images.sql). The items table only stores each
 * picture's path, like:
 *
 *   <user id>/<board id>/<random id>.jpg
 *
 * WHO MAY UPLOAD OR DELETE
 * Supabase Storage's own access rules only know people signed in with
 * Supabase Auth, and we use Better Auth, so the bucket has no rules at all:
 * nobody can reach it through Supabase's public API. Only this file can,
 * with SUPABASE_SECRET_KEY, which skips every rule. That makes this file
 * the gatekeeper, so every function here is only called after the session
 * check, and only with paths inside the signed-in user's own folder
 * (see isOwnImagePath below and actions.ts).
 *
 * A picture's folder is the board it was uploaded to. Since an item can be
 * on several boards (db/migrations/0006), that's just where the file lives,
 * not which boards the item is on.
 *
 * HOW AN UPLOAD WORKS (so big files never pass through our server)
 *   1. The browser asks the server: "may I upload a 2 MB JPEG to this board?"
 *   2. The server checks it's your board, picks the path, and asks Supabase
 *      for a one-time upload link for exactly that path (createUploadLink).
 *   3. The browser sends the file straight to Supabase with that link.
 *   4. The form is saved with the path, and the server checks again that
 *      the path is yours and the file is really there.
 *
 * HOW A PICTURE IS SHOWN
 * A private bucket has no public addresses. Each time a page is built, the
 * server makes a "signed" link for each picture: an address with a code in
 * it that works for one hour (signedImageUrls). Only pages that already
 * checked you may see the board ever make these links.
 *
 * Docs: https://supabase.com/docs/guides/storage/uploads/standard-uploads
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { uploadsReady } from "./settings";

export const BUCKET = "item-images";

/** The image types we accept, and the file ending each one gets. No SVG: it can contain code. */
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** 5 MB, the same as the bucket's own limit (migration 0005). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** How long a signed link to a picture keeps working: one hour. */
const SIGNED_URL_SECONDS = 60 * 60;

// One client, kept on globalThis for the same reason as the pool in lib/db.ts.
const saved = globalThis as typeof globalThis & { inspirationLibraryStorage?: ReturnType<typeof createClient> };

function bucket() {
  saved.inspirationLibraryStorage ??= createClient(process.env.SUPABASE_URL!.trim(), process.env.SUPABASE_SECRET_KEY!.trim(), {
    // We only use Storage here, not Supabase Auth: don't keep any session.
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return saved.inspirationLibraryStorage.storage.from(BUCKET);
}

/** Your folder for one board. Every picture you upload to it goes inside. */
function boardFolder(userId: string, boardId: string) {
  return `${userId}/${boardId}/`;
}

/**
 * True if `path` is a picture path inside YOUR folder, in exactly the shape
 * we make: <your id>/<board id>/<random id>.<ending>. The path comes from
 * the browser, so it could be anything, including someone else's folder:
 * this is the check that stops that.
 */
export function isOwnImagePath(path: string, userId: string): boolean {
  const folder = `${userId}/`;
  if (!path.startsWith(folder)) return false;
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const endings = Object.values(IMAGE_TYPES).join("|");
  return new RegExp(`^${uuid}/${uuid}\\.(${endings})$`).test(path.slice(folder.length));
}

/**
 * A one-time link to upload one picture to a fresh path in your folder.
 * Only call this after checking the board is yours.
 */
export async function createUploadLink(userId: string, boardId: string, contentType: string) {
  const path = `${boardFolder(userId, boardId)}${randomUUID()}.${IMAGE_TYPES[contentType]}`;
  const { data, error } = await bucket().createSignedUploadUrl(path);
  if (error) throw error;
  return { path, uploadUrl: data.signedUrl };
}

/** Is there really a file at this path? (The browser says it uploaded one; we check.) */
export async function imageExists(path: string): Promise<boolean> {
  const { data, error } = await bucket().exists(path);
  if (error) throw error;
  return data;
}

/** An uploaded picture's bytes, read straight from the bucket (to find its colour). */
export async function downloadImage(path: string): Promise<Buffer | null> {
  if (!uploadsReady()) return null;
  const { data, error } = await bucket().download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Signed, one-hour links for a list of paths, as a Map from path to link.
 * Only call this for pictures on boards the visitor may see.
 *
 * If Storage can't be reached (or uploading isn't set up), the Map is
 * missing those pictures and each one shows "couldn't be loaded" instead:
 * the rest of the page still works.
 */
export async function signedImageUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0 || !uploadsReady()) return new Map();
  // One request for all of them, rather than one per picture.
  const { data, error } = await bucket().createSignedUrls(unique, SIGNED_URL_SECONDS);
  if (error) {
    console.error("[inspiration-library] Couldn't make links to uploaded pictures:", error.message);
    return new Map();
  }
  return new Map(data.flatMap((entry) => (entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [])));
}

/**
 * The address to show a picture at: its own address if it's from another
 * website, or its signed link if it was uploaded (from signedImageUrls).
 */
export function pictureSrc(picture: { url: string | null; path: string | null }, signed: Map<string, string>): string | null {
  return picture.url ?? (picture.path ? (signed.get(picture.path) ?? null) : null);
}

/**
 * Deletes pictures. A file left behind is only wasted space (nobody can see
 * it without a signed link), so a failure is logged, not shown to you.
 */
export async function removeImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  if (!uploadsReady()) {
    console.error("[inspiration-library] Couldn't delete uploaded pictures: SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
    return;
  }
  const { error } = await bucket().remove(paths);
  if (error) console.error("[inspiration-library] Couldn't delete uploaded pictures:", error.message);
}

/**
 * Every file in your folder for one board: the pictures uploaded there,
 * including ones that were uploaded but never saved to an item. Used when a
 * board is deleted, to find files nothing uses any more (actions.ts).
 */
export async function listBoardFolder(userId: string, boardId: string): Promise<string[]> {
  if (!uploadsReady()) return [];
  const folder = boardFolder(userId, boardId);
  const paths: string[] = [];
  try {
    // A folder lists at most 1,000 files at a time, so keep going until the end.
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await bucket().list(folder.slice(0, -1), { limit: 1000, offset });
      if (error) throw error;
      paths.push(...data.map((file) => folder + file.name));
      if (data.length < 1000) return paths;
    }
  } catch (error) {
    console.error("[inspiration-library] Couldn't list a board's pictures:", error instanceof Error ? error.message : error);
    return paths;
  }
}
