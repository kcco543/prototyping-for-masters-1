/**
 * Better Auth's browser side, used by the sign in, sign up and sign out
 * buttons. It sends requests to /api/auth/... on the same website, where
 * Better Auth checks them (see app/api/auth/[...all]/route.ts).
 *
 * There are no secrets in here: the browser only ever gets the session
 * cookie, which it can't read or change (it's "httpOnly" and signed).
 *
 * Docs: https://better-auth.com/docs/concepts/client
 */

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

// No `baseURL` needed: the auth routes live on the same website as the pages.
// usernameClient adds signIn.username(…) and lets signUp / updateUser take a
// username (the server side is the username plugin in lib/auth.ts).
export const authClient = createAuthClient({ plugins: [usernameClient()] });
