"use server";

/**
 * Server actions: the functions the forms call to change your boards and items.
 *
 * "use server" at the top means these run ONLY on the server. When a form
 * is submitted, the browser sends its fields here as a web request; nothing
 * in here (the database, the session check) is ever sent to the browser.
 *
 * Every action follows the same three steps:
 *   1. Who is this? Ask the session (requireUser). Signed out → sign-in page.
 *   2. Is the form filled in sensibly? (lib/validate.ts)
 *   3. Change the database with the user id FROM THE SESSION. The board or
 *      item id comes from the form, so it could be anyone's, but the query
 *      only matches rows that belong to you (lib/boards.ts).
 *
 * Docs: https://nextjs.org/docs/app/getting-started/updating-data
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteBoard,
  findOwnItem,
  insertBoard,
  insertItem,
  ownsBoard,
  removeItemFromBoard,
  unusedImagePaths,
  updateBoard,
  updateItem,
} from "./lib/boards";
import { boardHref, HOME, NEW_BOARD, SAVE } from "./lib/paths";
import { problemSentence, reportProblem } from "./lib/problems";
import { findDominantColor } from "./lib/dominant-color";
import { requireUser } from "./lib/session";
import { uploadsReady } from "./lib/settings";
import { createUploadLink, IMAGE_TYPES, imageExists, isOwnImagePath, listBoardFolder, MAX_IMAGE_BYTES, removeImages } from "./lib/storage";
import { checkBoard, checkItem, field, isUuid } from "./lib/validate";

/**
 * What a form shows after it's sent (see BoardForm.tsx and ItemForm.tsx):
 * nothing yet, "Saved", or what went wrong, together with what you typed
 * so you don't have to type it again. `at` makes each answer unique, so the
 * form starts afresh after every send.
 */
export type FormState =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | { status: "error"; message: string; values: Record<string, string>; at: number };

/** The text fields the forms have (a checkbox sends "on" when ticked). */
const FIELDS = ["title", "description", "isPublic", "imageUrl", "imagePath", "linkUrl", "note"];

function failed(message: string, form: FormData): FormState {
  const values = Object.fromEntries(FIELDS.map((name) => [name, field(form, name)]));
  return { status: "error", message, values, at: Date.now() };
}

/* ---------- Boards ---------- */

export async function createBoardAction(_previous: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser(NEW_BOARD);

  const checked = checkBoard(form);
  if (!checked.ok) return failed(checked.message, form);

  let boardId: string;
  try {
    boardId = await insertBoard(user.id, checked.value);
  } catch (error) {
    return failed(problemSentence(reportProblem(error)), form);
  }

  revalidatePath(HOME);
  // `redirect` works by throwing, so it goes outside the try…catch above.
  redirect(boardHref(boardId));
}

export async function updateBoardAction(_previous: FormState, form: FormData): Promise<FormState> {
  const boardId = field(form, "boardId");
  const user = await requireUser(isUuid(boardId) ? boardHref(boardId) : HOME);

  const checked = checkBoard(form);
  if (!checked.ok) return failed(checked.message, form);
  if (!isUuid(boardId)) return failed("This board couldn't be found.", form);

  try {
    const changed = await updateBoard(user.id, boardId, checked.value);
    if (!changed) return failed("This board couldn't be found. It may have been deleted.", form);
  } catch (error) {
    return failed(problemSentence(reportProblem(error)), form);
  }

  revalidatePath(boardHref(boardId));
  revalidatePath(HOME);
  return { status: "saved", at: Date.now() };
}

export async function deleteBoardAction(form: FormData): Promise<void> {
  const boardId = field(form, "boardId");
  const user = await requireUser(HOME);

  // Not yours, or already gone: there's nothing to delete either way, so
  // we just go back to your boards.
  const deleted = isUuid(boardId) ? await deleteBoard(user.id, boardId) : null;
  if (deleted && uploadsReady()) {
    // The pictures of the items that were only on this board…
    await removeImages(deleted.imagePaths);
    // …and any other file in this board's folder that no item uses: pictures
    // uploaded but never saved. Files used by items that are still on other
    // boards stay.
    await removeImages(await unusedImagePaths(user.id, await listBoardFolder(user.id, boardId)));
  }

  revalidatePath(HOME);
  redirect(HOME);
}

/* ---------- Uploading a picture ---------- */

export type UploadStart = { ok: true; path: string; uploadUrl: string } | { ok: false; message: string };

/**
 * Step 1 of an upload (see lib/storage.ts): the browser says what it wants
 * to upload, and gets a one-time link to send the file straight to Supabase.
 * Only for your own boards, and only for pictures of the allowed types and
 * size. (Supabase checks the type and size again when the file arrives.)
 */
export async function startImageUploadAction(boardId: string, contentType: string, size: number): Promise<UploadStart> {
  const user = await requireUser(isUuid(boardId) ? boardHref(boardId) : HOME);

  if (!uploadsReady()) return { ok: false, message: "Uploading isn't set up on this site yet (see the README)." };
  if (!(contentType in IMAGE_TYPES)) return { ok: false, message: "Choose a JPEG, PNG, WebP, GIF or AVIF picture." };
  if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE_BYTES) return { ok: false, message: "Choose a picture of 5 MB or less." };
  if (!isUuid(boardId)) return { ok: false, message: "This board couldn't be found." };

  try {
    if (!(await ownsBoard(user.id, boardId))) return { ok: false, message: "This board couldn't be found. It may have been deleted." };
    return { ok: true, ...(await createUploadLink(user.id, boardId, contentType)) };
  } catch (error) {
    console.error("[inspiration-library] Couldn't start an upload:", error instanceof Error ? error.message : error);
    return { ok: false, message: "The picture couldn't be uploaded just now. Please try again." };
  }
}

/**
 * Step 4: before saving an uploaded picture's path, check it's in YOUR
 * folder and the file is really there. Returns what's wrong, or null if all
 * is well.
 */
async function problemWithUpload(path: string, userId: string): Promise<string | null> {
  if (!uploadsReady()) return "Uploading isn't set up on this site yet (see the README).";
  if (!isOwnImagePath(path, userId)) return "That picture couldn't be found. Please upload it again.";
  if (!(await imageExists(path))) return "The picture didn't finish uploading. Please upload it again.";
  return null;
}

/* ---------- Items ---------- */

export async function addItemAction(_previous: FormState, form: FormData): Promise<FormState> {
  const boardId = field(form, "boardId");
  const user = await requireUser(isUuid(boardId) ? boardHref(boardId) : HOME);

  const checked = checkItem(form);
  if (!checked.ok) return failed(checked.message, form);
  if (!isUuid(boardId)) return failed("This board couldn't be found.", form);

  try {
    const uploadProblem = checked.value.imagePath && (await problemWithUpload(checked.value.imagePath, user.id));
    if (uploadProblem) return failed(uploadProblem, form);

    // The picture's main colour, for the "By colour" view (null if there's no picture or it can't be read).
    const color = await findDominantColor({ url: checked.value.imageUrl, path: checked.value.imagePath });
    const added = await insertItem(user.id, boardId, checked.value, color);
    if (!added) return failed("This board couldn't be found. It may have been deleted.", form);
  } catch (error) {
    return failed(problemSentence(reportProblem(error)), form);
  }

  revalidatePath(boardHref(boardId));
  revalidatePath(HOME);
  return { status: "saved", at: Date.now() };
}

export async function updateItemAction(_previous: FormState, form: FormData): Promise<FormState> {
  const itemId = field(form, "itemId");
  const user = await requireUser(HOME);

  const checked = checkItem(form);
  if (!checked.ok) return failed(checked.message, form);
  if (!isUuid(itemId)) return failed("This item couldn't be found.", form);

  // The ticked "Boards" checkboxes: every board the item should be on.
  const boardIds = form.getAll("boardIds").filter((id): id is string => typeof id === "string" && isUuid(id));
  if (boardIds.length === 0) return failed("Tick at least one board. To remove the item, use Remove from this board.", form);

  const notFound = "This item couldn't be found. It may have been deleted.";
  const newPath = checked.value.imagePath;
  let oldPath: string | null;
  let changedBoards: string[];
  try {
    // Which picture does it have now?
    const existing = await findOwnItem(user.id, itemId);
    if (!existing) return failed(notFound, form);
    oldPath = existing.imagePath;

    // Keeping the same picture needs no checks; a new one does.
    if (newPath && newPath !== oldPath) {
      const uploadProblem = await problemWithUpload(newPath, user.id);
      if (uploadProblem) return failed(uploadProblem, form);
    }

    // Same picture as before? Keep its colour. A new picture (or one whose
    // colour couldn't be read last time) gets looked at again.
    const samePicture = existing.imageUrl === checked.value.imageUrl && existing.imagePath === newPath;
    const color =
      samePicture && existing.dominantColor ? existing.dominantColor : await findDominantColor({ url: checked.value.imageUrl, path: newPath });

    const result = await updateItem(user.id, itemId, checked.value, boardIds, color);
    if (!result.ok) return failed(result.reason === "no-boards" ? "Tick at least one of your boards." : notFound, form);
    changedBoards = result.boardIds;
  } catch (error) {
    return failed(problemSentence(reportProblem(error)), form);
  }

  // The old uploaded picture was replaced or removed: delete its file.
  if (oldPath && oldPath !== newPath) await removeImages([oldPath]);

  // Refresh every board it was on before or is on now.
  for (const boardId of changedBoards) revalidatePath(boardHref(boardId));
  revalidatePath(HOME);
  return { status: "saved", at: Date.now() };
}

/**
 * Takes an item off this board. If it isn't on any other board, that
 * deletes it (and its uploaded picture).
 */
export async function removeItemAction(form: FormData): Promise<void> {
  const itemId = field(form, "itemId");
  const boardId = field(form, "boardId");
  const user = await requireUser(HOME);
  if (!isUuid(itemId) || !isUuid(boardId)) return;

  const removed = await removeItemFromBoard(user.id, itemId, boardId);
  if (removed) {
    if (removed.imagePath) await removeImages([removed.imagePath]);
    revalidatePath(boardHref(boardId));
    revalidatePath(HOME);
  }
}

/* ---------- Saving from the bookmarklet ---------- */

/** What the bookmarklet's window shows after you press Save. */
export type SaveLinkState =
  | { status: "idle" }
  | { status: "saved"; boardId: string; at: number }
  | { status: "error"; message: string; at: number };

/**
 * Saves a link (and a title and note) from the bookmarklet's window
 * (save/page.tsx) to one of your boards. The same checks as every other
 * item: who you are comes from the session, the link must be http(s), and
 * insertItem only adds to a board that's yours.
 */
export async function saveLinkAction(_previous: SaveLinkState, form: FormData): Promise<SaveLinkState> {
  const user = await requireUser(SAVE);
  const boardId = field(form, "boardId");
  const failure = (message: string): SaveLinkState => ({ status: "error", message, at: Date.now() });

  // No picture from here: only the link, title and note.
  const checked = checkItem(form);
  if (!checked.ok) return failure(checked.message);
  if (!checked.value.linkUrl) return failure("Add the page's link.");
  if (!isUuid(boardId)) return failure("Choose one of your boards.");

  try {
    const added = await insertItem(user.id, boardId, { ...checked.value, imageUrl: null, imagePath: null }, null);
    if (!added) return failure("That board couldn't be found. It may have been deleted.");
  } catch (error) {
    return failure(problemSentence(reportProblem(error)));
  }

  revalidatePath(boardHref(boardId));
  revalidatePath(HOME);
  return { status: "saved", boardId, at: Date.now() };
}

