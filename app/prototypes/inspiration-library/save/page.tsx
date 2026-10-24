/**
 * The bookmarklet's small window: "Save this page to a board".
 *
 * The bookmarklet (bookmarklet/page.tsx) opens this page in a popup window,
 * with the website's address and title in the address of this page:
 *
 *   /prototypes/inspiration-library/save?url=https%3A%2F%2F…&title=…
 *
 * Those two values only fill in the form: they come from another website,
 * so nothing is saved until YOU choose a board and press Save, and the
 * server checks them like any other form (actions.ts → saveLinkAction).
 * React shows them as plain text, so a page title containing HTML can't
 * do anything.
 *
 * Signed out? The window shows a "Sign in" link that comes back here, with
 * the same address and title, afterwards.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Frame from "../Frame";
import { listBoardTitles } from "../lib/boards";
import { NEW_BOARD, SAVE, signInHref } from "../lib/paths";
import { attempt } from "../lib/problems";
import { getSession } from "../lib/session";
import { checkSettings } from "../lib/settings";
import { LIMITS } from "../lib/validate";
import SaveForm from "../SaveForm";
import { ProblemNotice, SetupNotice } from "../SetupNotice";
import styles from "../styles.module.css";

export const metadata: Metadata = { title: "Save to a board · Inspiration library" };

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ url?: string | string[]; title?: string | string[] }> };

/** One value from the address, as text, cut to `max` characters. */
function param(value: string | string[] | undefined, max: number) {
  return (typeof value === "string" ? value.trim() : "").slice(0, max);
}

export default async function SavePage({ searchParams }: Props) {
  const settings = checkSettings();
  if (!settings.ok) {
    return (
      <Frame bare>
        <SetupNotice check={settings} />
      </Frame>
    );
  }

  const query = await searchParams;
  const url = param(query.url, LIMITS.url);
  const title = param(query.title, LIMITS.itemTitle);

  const result = await attempt(async () => {
    const session = await getSession();
    return { user: session?.user ?? null, boards: session ? await listBoardTitles(session.user.id) : [] };
  });
  if (!result.ok) {
    return (
      <Frame bare>
        <ProblemNotice problem={result.problem} />
      </Frame>
    );
  }
  const { user, boards } = result.value;

  // This page's own address, to come back to after signing in.
  const here = `${SAVE}?${new URLSearchParams({ url, title }).toString()}`;

  return (
    <Frame bare>
      <section className={styles.saveCard} aria-labelledby="save-title">
        <p className={styles.eyebrow}>Inspiration library</p>
        <h1 id="save-title" className={styles.saveTitle}>
          Save to a board
        </h1>

        {!user ? (
          <>
            <p className={styles.authText}>Sign in to save this page to one of your boards.</p>
            <Link className={styles.button} href={signInHref(here)}>
              Sign in
            </Link>
          </>
        ) : boards.length === 0 ? (
          <>
            <p className={styles.authText}>You don&apos;t have any boards yet. Make one, then click the bookmarklet again.</p>
            {/* Opens in your main browser window, not in this small one. */}
            <a className={styles.button} href={NEW_BOARD} target="_blank" rel="noopener">
              Make a board
            </a>
          </>
        ) : (
          <SaveForm boards={boards} url={url} title={title} />
        )}
      </section>
    </Frame>
  );
}
