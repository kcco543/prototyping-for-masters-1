/**
 * When the database can't be used, work out why, so the page can say how to
 * fix it (see SetupNotice.tsx) instead of showing a blank error. Server only.
 */

import { unstable_rethrow } from "next/navigation";
import { forgetAuth } from "./auth";

export type Problem =
  /** The tables from schema.sql don't exist (yet) */
  | "no_tables"
  /** Supabase didn't accept the user name or password in DATABASE_URL */
  | "wrong_password"
  /** Couldn't reach the database at all */
  | "unreachable"
  /** The connection's encryption certificate couldn't be checked */
  | "certificate"
  /** Anything else */
  | "unknown";

/** The `code` property errors from `pg` and Node.js carry, if any. */
function codeOf(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "";
}

const NETWORK_CODES = ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"];

/**
 * Sorts an error into one of the problems above. Better Auth wraps database
 * errors in its own error, with the original one as its `cause`, so we look
 * a few levels deep.
 */
export function problemFrom(error: unknown): Problem {
  let current = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const code = codeOf(current);
    const message = current instanceof Error ? current.message : String(current);

    // Better Auth compares the tables with what it needs before its first request.
    if (code === "SCHEMA_MISMATCH") return "no_tables";
    // Postgres error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
    if (code === "42P01" || code === "42703") return "no_tables"; // "undefined table" / "undefined column"
    if (code === "28P01" || code === "28000" || /tenant or user not found/i.test(message)) return "wrong_password";
    if (NETWORK_CODES.includes(code) || /timeout|terminated unexpectedly/i.test(message)) return "unreachable";
    if (/CERT|SSL|TLS/.test(code) || /certificate/i.test(message)) return "certificate";

    current = (current as { cause?: unknown }).cause;
  }
  return "unknown";
}

/**
 * Runs `work` and catches database trouble, so the page can explain it.
 *
 * `unstable_rethrow` lets Next.js's own "errors" through untouched: calling
 * `redirect()` or `notFound()` works by throwing, and so does the check Next.js
 * uses to see which pages must be built fresh for every visit.
 */
export async function attempt<T>(work: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; problem: Problem }> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, problem: reportProblem(error) };
  }
}

/**
 * Sorts the error (see problemFrom) and writes the details to the terminal
 * running `npm run dev` (or to Vercel's Logs): the original error's code and
 * message only, because some errors also carry the whole connection string,
 * password and all.
 */
export function reportProblem(error: unknown): Problem {
  const problem = problemFrom(error);
  let root = error;
  for (let depth = 0; depth < 5 && (root as { cause?: unknown } | null)?.cause; depth++) root = (root as { cause: unknown }).cause;
  console.error(`[inspiration-library] ${problem}:`, codeOf(root), root instanceof Error ? root.message : String(root));

  // Better Auth remembers "the tables are missing" until it's restarted. Start
  // a fresh copy on the next visit instead, so that once you've run
  // schema.sql, refreshing the page is enough.
  if (codeOf(root) === "SCHEMA_MISMATCH") forgetAuth();
  return problem;
}

/** One sentence for a form, when saving didn't work. */
export function problemSentence(problem: Problem): string {
  switch (problem) {
    case "no_tables":
      return "The database has no tables yet. Run schema.sql in Supabase's SQL Editor (see the README), then try again.";
    case "wrong_password":
    case "unreachable":
    case "certificate":
      return "Couldn't reach the database. Check DATABASE_URL (see the README), then try again.";
    default:
      return "Something went wrong while saving. Please try again.";
  }
}
