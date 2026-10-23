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
import { deleteBoard, deleteItem, insertBoard, insertItem, updateBoard, updateItem } from "./lib/boards";
import { boardHref, HOME, NEW_BOARD } from "./lib/paths";
import { problemSentence, reportProblem } from "./lib/problems";
import { requireUser } from "./lib/session";
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
const FIELDS = ["title", "description", "isPublic", "imageUrl", "linkUrl", "note"];

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
  if (isUuid(boardId)) await deleteBoard(user.id, boardId);

  revalidatePath(HOME);
  redirect(HOME);
}

/* ---------- Items ---------- */

export async function addItemAction(_previous: FormState, form: FormData): Promise<FormState> {
  const boardId = field(form, "boardId");
  const user = await requireUser(isUuid(boardId) ? boardHref(boardId) : HOME);

  const checked = checkItem(form);
  if (!checked.ok) return failed(checked.message, form);
  if (!isUuid(boardId)) return failed("This board couldn't be found.", form);

  try {
    const added = await insertItem(user.id, boardId, checked.value);
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

  let boardId: string | null;
  try {
    boardId = await updateItem(user.id, itemId, checked.value);
  } catch (error) {
    return failed(problemSentence(reportProblem(error)), form);
  }
  if (!boardId) return failed("This item couldn't be found. It may have been deleted.", form);

  revalidatePath(boardHref(boardId));
  revalidatePath(HOME);
  return { status: "saved", at: Date.now() };
}

export async function deleteItemAction(form: FormData): Promise<void> {
  const itemId = field(form, "itemId");
  const user = await requireUser(HOME);
  if (!isUuid(itemId)) return;

  const boardId = await deleteItem(user.id, itemId);
  if (boardId) {
    revalidatePath(boardHref(boardId));
    revalidatePath(HOME);
  }
}
