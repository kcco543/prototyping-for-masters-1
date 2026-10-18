/**
 * A Constellation of Stories — "My Bookstore" as a celestial atlas.
 * Every book in the Notion database is a star; every genre, a constellation.
 *
 * How it fits together:
 *
 *   1. This page is a SERVER component (there's no "use client" at the top).
 *      It runs on the server, where it can safely use your Notion token, and
 *      reads every book with `getShelf()` from notion.ts.
 *   2. The books are passed to <Library>, which runs in the browser and holds
 *      the two views: the star map (SkyMap.tsx) and the bookshelf
 *      (Bookshelf.tsx), plus each book's page (BookFolio.tsx).
 *   3. If something is missing or wrong (no token yet, database not shared…),
 *      the page explains how to fix it instead of showing books.
 *
 * Setup steps are in README.md, and on the page itself until it's connected.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";
import BackHome from "../../components/back-home/BackHome";
import { instrumentSans } from "../../fonts";
import type { Problem } from "./books";
import { cormorant } from "./fonts";
import { Library, SamplePreview } from "./Library";
import { Masthead } from "./Masthead";
import { getShelf } from "./notion";
import { Starfield } from "./Starfield";
import styles from "./styles.module.css";

export const metadata: Metadata = {
  title: "A Constellation of Stories · My Bookstore",
  description: "Every book is a world. Together, they form a universe. My bookstore, from a Notion database, as a celestial atlas.",
};

/*
  Fetch fresh books from Notion at most once a minute. In between, visitors
  get the page that was already built, which is quick and keeps us well
  under Notion's rate limits. A change in Notion (a new book, a new genre)
  shows up here within about a minute. (While running `npm run dev`, every
  refresh fetches fresh books.)

  Keep this well under an hour: cover pictures uploaded to Notion come with
  links that stop working after one hour.
*/
export const revalidate = 60;

export default async function ConstellationOfStories() {
  const shelf = await getShelf();
  const fonts = `${instrumentSans.className} ${cormorant.variable}`;

  if (shelf.ok && shelf.books.length > 0) {
    const chartedAt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
      new Date(),
    );
    return (
      <div className={fonts}>
        <Library
          books={shelf.books}
          sourceName={shelf.name}
          chartedAt={chartedAt}
          notice={shelf.missing.length > 0 ? <MissingProperties missing={shelf.missing} available={shelf.available} /> : undefined}
        />
      </div>
    );
  }

  // Not connected, a problem, or an empty database: explain, under the same title
  return (
    <div className={`${styles.page} ${fonts}`}>
      <Starfield />
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <BackHome accent="#c6a76b" surface="#162034" ink="#f1e8d8" />
        </div>
        <Masthead mode="plain" />

        {!shelf.ok && (
          <>
            <ProblemCard problem={shelf.problem} missingSettings={shelf.missingSettings} />
            {shelf.problem === "not_configured" && <SamplePreview />}
          </>
        )}

        {shelf.ok && (
          <section className={styles.notice} aria-labelledby="empty-title">
            <h2 id="empty-title" className={styles.noticeTitle}>
              The sky is still dark
            </h2>
            <p className={styles.noticeText}>
              The database is connected, but it has no books yet. Add one in Notion, then refresh this page: it will appear as the first star of
              its genre&apos;s constellation.
            </p>
          </section>
        )}

        <footer className={styles.footer}>
          Books come from a Notion database through the Notion API (version 2026-03-11). Changes in Notion appear here within about a minute.
        </footer>
      </div>
    </div>
  );
}

/* ---------- "Heads up: your database has no … property" ---------- */

function MissingProperties({ missing, available }: { missing: string[]; available: string[] }) {
  return (
    <details className={styles.hint}>
      <summary className={styles.hintSummary}>
        Heads up: {missing.length === 1 ? "a property wasn’t" : `${missing.length} properties weren’t`} found in Notion
      </summary>
      <p className={styles.hintText}>
        Your database has no {missing.map((name) => `“${name}”`).join(", ")} {missing.length === 1 ? "property" : "properties"}, so{" "}
        {missing.length === 1 ? "it stays" : "they stay"} empty here. Its properties are: {available.map((name) => `“${name}”`).join(", ")}. To use a
        different name, change <code className={styles.code}>PROPERTY_NAMES</code> in <code className={styles.code}>notion.ts</code>.
      </p>
    </details>
  );
}

/* ---------- When the books can't load ---------- */

const code = (text: string) => <code className={styles.code}>{text}</code>;

/** What went wrong, and how to fix it, for each problem notion.ts can report. */
const PROBLEMS: Record<Problem, { title: string; body: ReactNode }> = {
  not_configured: {
    title: "Connect your Notion database",
    body: (
      <ol className={styles.steps}>
        <li className={styles.step}>
          Open Notion&apos;s{" "}
          <a className={styles.link} href="https://app.notion.com/developers/connections" target="_blank" rel="noreferrer">
            Developer portal
          </a>
          , choose <strong>Internal connections</strong>, then <strong>Create a new connection</strong>. Name it “My bookshelf” and pick your
          workspace. (Only workspace owners can do this. The README describes an alternative: a personal access token.)
        </li>
        <li className={styles.step}>
          On the connection&apos;s <strong>Configuration</strong> tab, make sure <strong>Read content</strong> is allowed, and copy the API token.
        </li>
        <li className={styles.step}>
          Let it see your reading list: open the database in Notion, click <strong>•••</strong> (top right) → <strong>Connections</strong> →{" "}
          <strong>+ Add connection</strong>, and choose “My bookshelf”.
        </li>
        <li className={styles.step}>
          Copy the database&apos;s link: <strong>•••</strong> → <strong>Copy link</strong>.
        </li>
        <li className={styles.step}>
          Open {code(".env.local")} in the project&apos;s top folder (next to {code("package.json")}) and add two lines, pasting straight after
          each equals sign:
          <pre className={styles.preBlock}>{"NOTION_TOKEN=paste_the_token_here\nNOTION_DATABASE_ID=paste_the_link_here"}</pre>
        </li>
        <li className={styles.step}>Save the file and refresh this page. If this message is still here, stop the dev server and start it again.</li>
      </ol>
    ),
  },
  bad_link: {
    title: "That doesn't look like a database link",
    body: (
      <p className={styles.noticeText}>
        {code("NOTION_DATABASE_ID")} in {code(".env.local")} should be the database&apos;s link (in Notion: <strong>•••</strong> →{" "}
        <strong>Copy link</strong>) or its 32-character ID. Check that the whole link was pasted.
      </p>
    ),
  },
  unauthorized: {
    title: "Notion didn't accept the token",
    body: (
      <p className={styles.noticeText}>
        Check that {code("NOTION_TOKEN")} in {code(".env.local")} was copied completely, with no spaces or quotes. If you refreshed the token in
        Notion, or it was a personal access token that has expired, paste the new one.
      </p>
    ),
  },
  not_found: {
    title: "Notion can't find the database",
    body: (
      <p className={styles.noticeText}>
        Usually this means the database hasn&apos;t been shared with your connection yet: open it in Notion, click <strong>•••</strong> →{" "}
        <strong>Connections</strong> → <strong>+ Add connection</strong>, and choose your connection. Also check that the link is to the database
        itself, not to a page that shows a linked copy of it (those can&apos;t be read through the API).
      </p>
    ),
  },
  restricted: {
    title: "The connection isn't allowed to read",
    body: (
      <p className={styles.noticeText}>
        In Notion&apos;s Developer portal, open your connection&apos;s <strong>Configuration</strong> tab and allow <strong>Read content</strong>.
      </p>
    ),
  },
  no_table: {
    title: "This database has no table inside",
    body: <p className={styles.noticeText}>Notion found the database, but it has no data source (table) to read. Check the link points to your reading list.</p>,
  },
  rate_limited: {
    title: "Too many requests",
    body: <p className={styles.noticeText}>Notion asked us to slow down. Wait a minute, then refresh.</p>,
  },
  unavailable: {
    title: "Couldn't reach Notion",
    body: (
      <p className={styles.noticeText}>
        Check your internet connection and refresh. If it keeps happening, the terminal running {code("npm run dev")} shows the exact error.
      </p>
    ),
  },
};

function ProblemCard({ problem, missingSettings }: { problem: Problem; missingSettings?: string[] }) {
  const { title, body } = PROBLEMS[problem];
  return (
    <section className={`${styles.notice} ${problem === "not_configured" ? "" : styles.noticeProblem}`} aria-labelledby="problem-title">
      <h2 id="problem-title" className={styles.noticeTitle}>
        {title}
      </h2>
      {missingSettings && missingSettings.length > 0 && (
        <p className={styles.noticeText}>
          Missing from {code(".env.local")}:{" "}
          {missingSettings.map((name, index) => (
            <span key={name}>
              {index > 0 && ", "}
              <code className={styles.code}>{name}</code>
            </span>
          ))}
        </p>
      )}
      {body}
    </section>
  );
}
