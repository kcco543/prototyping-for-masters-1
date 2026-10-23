/**
 * Better Auth: sign up, sign in, sign out and sessions. Server only.
 *
 * Better Auth is a library that does the security-sensitive parts of
 * accounts for us: it hashes passwords (with scrypt), creates a session when
 * you sign in, and puts a signed, httpOnly cookie in your browser that
 * proves who you are on every later visit.
 *
 * It stores everything in four tables in your database (user, session,
 * account, verification), plus rateLimit for the rate limiter below. Their
 * SQL is at the top of schema.sql.
 *
 * Its web address, /api/auth/..., is set up in app/api/auth/[...all]/route.ts.
 * The browser side (the sign in and sign up forms) uses lib/auth-client.ts.
 *
 * Docs: https://better-auth.com/docs/installation
 */

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getPool } from "./db";

function createAuth() {
  return betterAuth({
    appName: "Inspiration library",

    /*
      The secret and the app's address aren't written here: Better Auth reads
      them from BETTER_AUTH_SECRET and BETTER_AUTH_URL in `.env.local`. The
      address also tells Better Auth which website may send it sign-in
      requests (its "trusted origin"), which protects against other sites
      submitting forms on your behalf (CSRF).
    */

    // A `pg` Pool, handed straight to Better Auth (see lib/db.ts).
    database: getPool(),

    emailAndPassword: {
      enabled: true,
      // Long passwords are the best protection against guessing.
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },

    /*
      Rate limiting: at most 5 sign-in attempts and 3 sign-ups per minute from
      one IP address, so nobody can try thousands of passwords. It's switched
      on for the live site and off during `npm run dev`. The counts are kept
      in the database ("rateLimit" table) rather than in memory, because on
      Vercel each request can run on a different, short-lived server.
    */
    rateLimit: {
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
      },
    },

    advanced: {
      // Fetch the session and its user in one query instead of two.
      database: { joins: true },
    },

    // Lets Better Auth refresh the session cookie from Next.js server
    // actions too. It must stay the LAST plugin in this list.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** What `getSession()` returns for a signed-in visitor: `{ session, user }`. */
export type Session = Auth["$Infer"]["Session"];

// Kept on globalThis for the same reason as the pool in lib/db.ts.
const saved = globalThis as typeof globalThis & { inspirationLibraryAuth?: Auth };

/**
 * The Better Auth instance. It's created the first time a page or the API
 * route needs it, not when this file is loaded. That way `next build` (and
 * a live site whose settings aren't filled in yet) never needs the secret or
 * the database: pages check `missingSettings()` before calling this.
 */
export function getAuth(): Auth {
  saved.inspirationLibraryAuth ??= createAuth();
  return saved.inspirationLibraryAuth;
}

/**
 * Before its first request, Better Auth checks that its tables exist, and
 * remembers the answer. If they were missing, forgetting this instance means
 * the next visit creates a new one, which checks again: so after you run
 * schema.sql, a refresh is enough (no restart needed). See lib/problems.ts.
 */
export function forgetAuth() {
  saved.inspirationLibraryAuth = undefined;
}
