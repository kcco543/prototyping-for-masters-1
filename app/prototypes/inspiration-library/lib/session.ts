/**
 * "Who is visiting?" Asked on the server, on every page and in every server
 * action that reads or changes your boards. Server only.
 *
 * THE GOLDEN RULE: the user id always comes from here, never from the
 * browser. A form could send `userId=someone-else` (anyone can edit what
 * their browser sends), but it can't fake the session: Better Auth looks
 * up the signed session cookie in the database and tells us whose it is.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth, type Session } from "./auth";
import { signInHref } from "./paths";

/**
 * The visitor's session (`{ session, user }`), or null when signed out.
 *
 * `cache` means that if a page asks several times while it's being built
 * (say, for the page title and for the page itself), Better Auth only
 * checks once.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  return getAuth().api.getSession({ headers: await headers() });
});

/**
 * The signed-in user. Signed-out visitors are sent to the sign-in page, and
 * come back to `returnTo` afterwards.
 */
export async function requireUser(returnTo?: string): Promise<Session["user"]> {
  const session = await getSession();
  if (!session) redirect(signInHref(returnTo));
  return session.user;
}
