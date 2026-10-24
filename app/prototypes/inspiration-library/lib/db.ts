/**
 * The connection to your Supabase Postgres database. Server only.
 *
 * We talk to Postgres with the `pg` library (also called node-postgres),
 * not with Supabase's own JavaScript library: Supabase is just "a Postgres
 * database in the cloud" here. Both Better Auth (lib/auth.ts) and our own
 * boards and items queries (lib/boards.ts) share this one connection pool.
 *
 * WHAT IS A POOL?
 * Opening a database connection takes a moment (and a password check), so
 * instead of connecting for every query, a Pool keeps a few connections open
 * and lends one out per query. `pool.query(...)` borrows a connection, runs
 * the query and gives it back.
 */

import { Pool } from "pg";

/*
  While you run `npm run dev`, Next.js reloads changed files without
  restarting the server. Keeping the pool on `globalThis` (an object that
  survives those reloads) means each reload reuses the same pool, instead of
  opening a few more connections every time until Supabase says "too many".
*/
const saved = globalThis as typeof globalThis & { inspirationLibraryPool?: Pool };

/** True for a database on your own computer, which doesn't use encryption. */
function isLocal(connectionString: string) {
  try {
    const { hostname } = new URL(connectionString);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

/**
 * The shared pool. It's created the first time it's needed (not when this
 * file is loaded), so the app can still start, and show its setup page,
 * before DATABASE_URL is filled in.
 */
export function getPool(): Pool {
  if (saved.inspirationLibraryPool) return saved.inspirationLibraryPool;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not set (see the README).");

  const pool = new Pool({
    connectionString,
    /*
      Encrypt the connection (TLS), so your data and password can't be read on
      the way to Supabase. Supabase signs its certificate with its own
      authority rather than a public one, so `rejectUnauthorized: false` tells
      `pg` not to look that authority up. The README's "Going further" section
      explains how to check the certificate too.
    */
    ssl: isLocal(connectionString) ? false : { rejectUnauthorized: false },
    // A few connections are plenty for one person's library, and stay well
    // under Supabase's connection limits (each Vercel function gets its own pool).
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  /*
    If Supabase closes an idle connection (it does that now and then), the
    pool reports an "error" event. Without a listener, Node.js treats that
    as a crash. Logging it is enough: the pool simply opens a new connection
    next time.
  */
  pool.on("error", (error) => {
    console.error("[inspiration-library] An idle database connection closed:", error.message);
  });

  saved.inspirationLibraryPool = pool;
  return pool;
}
