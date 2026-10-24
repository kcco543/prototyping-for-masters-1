/**
 * What the pages show instead of your boards when something isn't set up:
 *
 *   <SetupNotice>    a setting is missing or mistyped (lib/settings.ts)
 *   <ProblemNotice>  the settings are there, but the database said no
 *                    (lib/problems.ts)
 *
 * The help points to `.env.local` on your computer, or to Vercel's
 * Environment Variables on the live site.
 */

import type { ReactNode } from "react";
import type { Problem } from "./lib/problems";
import { runningOn, type Setting, type SettingsCheck } from "./lib/settings";
import styles from "./styles.module.css";

const code = (text: string) => <code className={styles.code}>{text}</code>;

/** Why a filled-in setting can't work, and how to fix it. */
const INVALID: Record<Setting, ReactNode> = {
  BETTER_AUTH_SECRET: <>is shorter than 32 characters. Make a new one with {code("openssl rand -base64 32")} in Terminal.</>,
  BETTER_AUTH_URL: <>should be a full web address, like {code("http://localhost:3000")}.</>,
  DATABASE_URL: (
    <>
      should start with {code("postgresql://")}. If your database password contains symbols such as {code("@ # / ? %")}, they have to be
      written in a special way inside the address (the README explains how).
    </>
  ),
};

/** Where the settings live, and how to make the app read them again. */
function WhereSettingsLive() {
  const computer = (
    <li className={styles.step}>
      <strong>On your computer:</strong> open {code(".env.local")} in the project&apos;s top folder (next to {code("package.json")}). Paste each
      value straight after its equals sign, with no spaces or quotes, and save. Then stop the dev server (Ctrl+C) and run {code("npm run dev")}{" "}
      again.
    </li>
  );
  const vercel = (
    <li className={styles.step}>
      <strong>On the live site (Vercel):</strong> your project → <strong>Settings</strong> → <strong>Environment Variables</strong>. Add the
      three names as <strong>Key</strong> and their values as <strong>Value</strong>, with {code("BETTER_AUTH_URL")} set to this site&apos;s own
      address (for example {code("https://my-site.vercel.app")}). Then redeploy: <strong>Deployments</strong> → the newest one →{" "}
      <strong>Redeploy</strong>.
    </li>
  );
  return runningOn === "vercel" ? (
    <>
      {vercel}
      {computer}
    </>
  ) : (
    <>
      {computer}
      {vercel}
    </>
  );
}

export function SetupNotice({ check }: { check: SettingsCheck }) {
  return (
    <section className={styles.notice} aria-labelledby="setup-title">
      <p className={styles.eyebrow}>Almost there</p>
      <h1 id="setup-title" className={styles.noticeTitle}>
        Finish setting up your library
      </h1>

      {check.missing.length > 0 && (
        <p className={styles.noticeText}>
          {check.missing.length === 1 ? "This setting is" : "These settings are"} still empty:{" "}
          {check.missing.map((name, index) => (
            <span key={name}>
              {index > 0 && ", "}
              {code(name)}
            </span>
          ))}
          .
        </p>
      )}
      {check.invalid.map((name) => (
        <p key={name} className={styles.noticeText}>
          {code(name)} {INVALID[name]}
        </p>
      ))}

      <ol className={styles.steps}>
        {check.missing.includes("BETTER_AUTH_SECRET") && (
          <li className={styles.step}>
            {code("BETTER_AUTH_SECRET")}: a long random password. Make one by running {code("openssl rand -base64 32")} in Terminal.
          </li>
        )}
        {check.missing.includes("BETTER_AUTH_URL") && (
          <li className={styles.step}>
            {code("BETTER_AUTH_URL")}: the address the app runs at. On your computer that&apos;s {code("http://localhost:3000")}.
          </li>
        )}
        {check.missing.includes("DATABASE_URL") && (
          <li className={styles.step}>
            {code("DATABASE_URL")}: in Supabase, open your project, click <strong>Connect</strong> (at the top), and copy the{" "}
            <strong>Session pooler</strong> connection string. Replace {code("[YOUR-PASSWORD]")} in it with your database password.
          </li>
        )}
        <WhereSettingsLive />
        <li className={styles.step}>
          Create the tables, once: in Supabase, open the <strong>SQL Editor</strong>, paste the whole of {code("schema.sql")} (in this
          prototype&apos;s folder) and click <strong>Run</strong>.
        </li>
      </ol>
      <p className={styles.noticeFoot}>The README in this prototype&apos;s folder walks through every step.</p>
    </section>
  );
}

const logs =
  runningOn === "vercel" ? (
    <>your Vercel project&apos;s Logs</>
  ) : (
    <>the terminal running {code("npm run dev")}</>
  );

const PROBLEMS: Record<Problem, { title: string; body: ReactNode }> = {
  no_tables: {
    title: "The database is empty",
    body: (
      <p className={styles.noticeText}>
        The connection works, but the tables aren&apos;t there yet. In Supabase, open the <strong>SQL Editor</strong> → <strong>New query</strong>,
        paste the whole of {code("schema.sql")} (in this prototype&apos;s folder), and click <strong>Run</strong>. Then refresh this page. (Still
        here after a second refresh? Restart {code("npm run dev")}, or redeploy on Vercel: Better Auth checks the tables when it starts.)
      </p>
    ),
  },
  wrong_password: {
    title: "Supabase didn't accept the password",
    body: (
      <p className={styles.noticeText}>
        Copy the connection string into {code("DATABASE_URL")} again (Supabase → <strong>Connect</strong> → <strong>Session pooler</strong>), and
        replace {code("[YOUR-PASSWORD]")}, square brackets included, with your database password. Forgotten it? Reset it under{" "}
        <strong>Project Settings</strong> → <strong>Database</strong>. Symbols in the password, like {code("@ # / ?")}, need to be written in a
        special way (see the README).
      </p>
    ),
  },
  unreachable: {
    title: "Couldn't reach the database",
    body: (
      <p className={styles.noticeText}>
        Check the address in {code("DATABASE_URL")}. Use the <strong>Session pooler</strong> string: the &quot;Direct connection&quot; one
        only works on networks that support IPv6. Free Supabase projects also pause after a week without use; if yours shows
        &quot;Paused&quot;, click <strong>Restore</strong> and try again in a minute.
      </p>
    ),
  },
  certificate: {
    title: "The secure connection didn't work",
    body: (
      <p className={styles.noticeText}>
        Remove anything like {code("?sslmode=require")} from the end of {code("DATABASE_URL")}. The app already encrypts the connection (see{" "}
        {code("lib/db.ts")}).
      </p>
    ),
  },
  unknown: {
    title: "Something went wrong",
    body: (
      <p className={styles.noticeText}>
        Something unexpected happened while reading from the database. The details are in {logs}, on a line starting with{" "}
        {code("[inspiration-library]")}. Refresh the page to try again.
      </p>
    ),
  },
};

export function ProblemNotice({ problem }: { problem: Problem }) {
  const { title, body } = PROBLEMS[problem];
  return (
    <section className={`${styles.notice} ${styles.noticeProblem}`} aria-labelledby="problem-title">
      <p className={styles.eyebrow}>Database</p>
      <h1 id="problem-title" className={styles.noticeTitle}>
        {title}
      </h1>
      {body}
      {problem !== "unknown" && (
        <p className={styles.noticeFoot}>
          The exact error is in {logs}, on a line starting with {code("[inspiration-library]")}.
        </p>
      )}
    </section>
  );
}
