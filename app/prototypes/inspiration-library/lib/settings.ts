/**
 * The three private settings this prototype needs, and whether they look right.
 *
 * They live in `.env.local` on your computer (and in Vercel's Environment
 * Variables for the live site). Their names don't start with NEXT_PUBLIC_, so
 * Next.js never sends them to the browser: they only exist on the server.
 *
 *   BETTER_AUTH_SECRET  a long random password Better Auth uses to sign the
 *                       sign-in cookie, so nobody can forge one
 *   BETTER_AUTH_URL     the address the app runs at, e.g. http://localhost:3000
 *   DATABASE_URL        your Supabase Postgres connection string
 *
 * Every page calls `checkSettings()` first. If something is missing or
 * mistyped, the page explains how to fix it instead of crashing
 * (see SetupNotice.tsx).
 */

export const SETTINGS = ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "DATABASE_URL"] as const;

export type Setting = (typeof SETTINGS)[number];

export type SettingsCheck = {
  ok: boolean;
  /** Empty, or not there at all */
  missing: Setting[];
  /** Filled in, but not in a shape that can work */
  invalid: Setting[];
};

/** True if `value` is a web address starting with one of the `protocols`. */
function isAddress(value: string, protocols: string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Checks the settings without using them (nothing connects to anything here). */
export function checkSettings(): SettingsCheck {
  const value = (name: Setting) => process.env[name]?.trim() ?? "";

  const missing = SETTINGS.filter((name) => !value(name));
  const invalid: Setting[] = [];

  const secret = value("BETTER_AUTH_SECRET");
  if (secret && secret.length < 32) invalid.push("BETTER_AUTH_SECRET");

  const url = value("BETTER_AUTH_URL");
  if (url && !isAddress(url, ["http:", "https:"])) invalid.push("BETTER_AUTH_URL");

  // A password with characters like @ # / ? in it breaks the address unless
  // they're "percent-encoded" (the README explains how).
  const database = value("DATABASE_URL");
  if (database && !isAddress(database, ["postgres:", "postgresql:"])) invalid.push("DATABASE_URL");

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid };
}

/**
 * "Sign in with Google" is optional. It's switched on only when both of
 * these are filled in (from Google Cloud Console, see the README):
 *
 *   GOOGLE_CLIENT_ID      identifies this app to Google (not secret on its own)
 *   GOOGLE_CLIENT_SECRET  proves to Google that the request comes from this
 *                         app's server (secret: never in the browser or git)
 *
 * Until then the Google button is hidden and email and password work as usual.
 */
export function googleSignInReady(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/**
 * Uploading images from your computer is optional too. It's switched on
 * only when both of these are filled in (from Supabase, see the README):
 *
 *   SUPABASE_URL         your project's address, https://<ref>.supabase.co
 *   SUPABASE_SECRET_KEY  lets the server use Storage without any access
 *                        rules (secret: never in the browser or git)
 *
 * Until then the upload button is hidden and image addresses work as usual.
 */
export function uploadsReady(): boolean {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  return isAddress(url, ["https:", "http:"]) && Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
}

/**
 * Where this copy of the app is running, so the help text points to the
 * right place. Vercel sets VERCEL=1 on every build and visit.
 */
export const runningOn: "vercel" | "computer" = process.env.VERCEL ? "vercel" : "computer";
