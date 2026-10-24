/**
 * The prototype's web addresses, in one place.
 */

export const HOME = "/prototypes/inspiration-library";
export const SIGN_IN = `${HOME}/sign-in`;
export const SIGN_UP = `${HOME}/sign-up`;
export const NEW_BOARD = `${HOME}/boards/new`;

export const boardHref = (boardId: string) => `${HOME}/boards/${boardId}`;

/** The sign-in page, remembering where to come back to afterwards. */
export const signInHref = (next?: string) => (next ? `${SIGN_IN}?next=${encodeURIComponent(next)}` : SIGN_IN);

/**
 * Where to go after signing in. The `?next=` part of the address can be
 * edited by anyone, so we only follow it to a page of this prototype.
 * Otherwise a link like `?next=https://evil.example` could send you to
 * another site straight after you sign in (an "open redirect").
 */
export function safeNext(next: string | null | undefined): string {
  if (!next) return HOME;
  const isOurs = next === HOME || next.startsWith(`${HOME}/`) || next.startsWith(`${HOME}?`);
  const isSneaky = next.includes("//") || next.includes("\\");
  return isOurs && !isSneaky ? next : HOME;
}

/** A person's public profile: their public boards. Usernames are already safe in an address (lib/auth.ts). */
export const profileHref = (username: string) => `${HOME}/u/${username}`;

/** The small "save to a board" window the bookmarklet opens (save/page.tsx). */
export const SAVE = `${HOME}/save`;
/** Where to get the bookmarklet (bookmarklet/page.tsx). */
export const BOOKMARKLET = `${HOME}/bookmarklet`;
