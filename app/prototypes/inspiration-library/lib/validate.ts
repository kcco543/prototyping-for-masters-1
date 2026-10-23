/**
 * Checking what the forms send, on the server.
 *
 * The forms in the browser already say "required" and so on, but anyone can
 * send a server action anything they like (it's just a web request), so the
 * server checks everything again before it goes near the database. The
 * database double-checks the lengths too (see the `check` rules in schema.sql).
 */

export type BoardInput = {
  title: string;
  description: string;
  isPublic: boolean;
};

export type ItemInput = {
  imageUrl: string | null;
  linkUrl: string | null;
  title: string;
  note: string;
};

/** Either the checked input, or a sentence saying what to fix. */
export type Checked<T> = { ok: true; value: T } | { ok: false; message: string };

/** The same limits as schema.sql. */
export const LIMITS = { boardTitle: 120, description: 1000, itemTitle: 200, note: 2000, url: 2048 };

/** A text field from the form, with spaces trimmed from both ends. */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Ids in this app are UUIDs, like 3f0c…-…; anything else can't be a real board or item. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * A web address, cleaned up: "" → null (no address), "are.na" → "https://are.na/".
 *
 * Only http and https are allowed. That matters: a link like
 * `javascript:alert(1)` would run code when someone clicks it, and links on
 * public boards are clicked by other people.
 */
export function webAddress(text: string): string | null | "invalid" {
  if (!text) return null;
  // No "https://" in front? Assume it (people often paste "example.com/page").
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "invalid";
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return "invalid";
    const clean = url.toString();
    return clean.length <= LIMITS.url ? clean : "invalid";
  } catch {
    return "invalid";
  }
}

export function checkBoard(form: FormData): Checked<BoardInput> {
  const title = field(form, "title");
  const description = field(form, "description");

  if (!title) return { ok: false, message: "Give your board a title." };
  if (title.length > LIMITS.boardTitle) return { ok: false, message: `Keep the title under ${LIMITS.boardTitle} characters.` };
  if (description.length > LIMITS.description) return { ok: false, message: `Keep the description under ${LIMITS.description} characters.` };

  // A checkbox only appears in the form data when it's ticked.
  return { ok: true, value: { title, description, isPublic: form.get("isPublic") === "on" } };
}

export function checkItem(form: FormData): Checked<ItemInput> {
  const imageUrl = webAddress(field(form, "imageUrl"));
  const linkUrl = webAddress(field(form, "linkUrl"));
  const title = field(form, "title");
  const note = field(form, "note");

  if (imageUrl === "invalid") return { ok: false, message: "The image address should be a web address starting with https://" };
  if (linkUrl === "invalid") return { ok: false, message: "The link should be a web address starting with https://" };
  if (!imageUrl && !linkUrl) return { ok: false, message: "Paste an image address, a link, or both." };
  if (title.length > LIMITS.itemTitle) return { ok: false, message: `Keep the title under ${LIMITS.itemTitle} characters.` };
  if (note.length > LIMITS.note) return { ok: false, message: `Keep the note under ${LIMITS.note} characters.` };

  return { ok: true, value: { imageUrl, linkUrl, title, note } };
}
