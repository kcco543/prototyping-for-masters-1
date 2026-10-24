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
 * SQL is at the top of schema.sql. The username plugin (below) adds two
 * columns to "user" (db/migrations/0009).
 *
 * Its web address, /api/auth/..., is set up in app/api/auth/[...all]/route.ts.
 * The browser side (the sign in and sign up forms) uses lib/auth-client.ts.
 *
 * Docs: https://better-auth.com/docs/installation
 */

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { getPool } from "./db";
import { googleSignInReady } from "./settings";

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
      "Sign in with Google", only when GOOGLE_CLIENT_ID and
      GOOGLE_CLIENT_SECRET are filled in (see lib/settings.ts).

      How it works: the button sends you to Google, Google asks you to pick
      an account and agree, then sends you back to
      /api/auth/callback/google with a one-time code. Better Auth swaps that
      code (plus the client secret) for your name and email, then signs you
      in, creating your account the first time. Google's details go in the
      `account` table (providerId "google"), next to any password account.

      Same email as an existing email-and-password account? Better Auth only
      joins them when that email has been verified, which ours never are (we
      don't send verification emails). Otherwise someone could sign up with
      YOUR email first and later share your account when you use Google. So
      instead you get a "sign in with your password" message (AuthForm.tsx).
    */
    socialProviders: googleSignInReady()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!.trim(),
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
            // Always show Google's account picker, so on a shared computer
            // you choose which Google account to use.
            prompt: "select_account",
          },
        }
      : {},

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
        "/sign-in/username": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        // Checking which usernames are free, without making it a quick way
        // to list everyone's.
        "/is-username-available": { window: 60, max: 20 },
      },
    },

    advanced: {
      // Fetch the session and its user in one query instead of two.
      database: { joins: true },
    },

    plugins: [
      /*
        Usernames, for public profiles at /u/<username> (u/[username]/page.tsx).
        The plugin adds two columns to the "user" table:
          username         always lower case, so "Mia" and "mia" are the
                           same person; unique, so nobody can take yours
          displayUsername  how you typed it, like "Mia_Studio", for showing
        It checks every new or changed username: 3–30 characters, only
        letters, numbers, _ and . (so it's safe in a web address), and not
        already taken. It also lets you sign in with your username instead
        of your email.
        Docs: https://better-auth.com/docs/plugins/username
      */
      username({ minUsernameLength: 3, maxUsernameLength: 30 }),
      // Lets Better Auth refresh the session cookie from Next.js server
      // actions too. It must stay the LAST plugin in this list.
      nextCookies(),
    ],
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
