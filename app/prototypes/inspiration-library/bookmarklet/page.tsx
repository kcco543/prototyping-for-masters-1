/**
 * Get the bookmarklet: a button you drag to your bookmarks bar. Clicking
 * that bookmark on any website opens a small window to save the page's link
 * and title to one of your boards (save/page.tsx). The button itself is
 * BookmarkletLink.tsx.
 */

import type { Metadata } from "next";
import Frame from "../Frame";
import { attempt } from "../lib/problems";
import { getSession } from "../lib/session";
import { checkSettings } from "../lib/settings";
import BookmarkletLink from "../BookmarkletLink";
import styles from "../styles.module.css";

export const metadata: Metadata = { title: "Save from any website · Inspiration library" };

export const dynamic = "force-dynamic";

export default async function BookmarkletPage() {
  // Only for the top bar (Sign in / Sign out): the instructions are the same for everyone.
  const result = checkSettings().ok ? await attempt(getSession) : null;
  const user = result?.ok ? (result.value?.user ?? null) : undefined;

  return (
    <Frame user={user}>
      <section className={styles.formCard} aria-labelledby="bookmarklet-title">
        <p className={styles.eyebrow}>Save from any website</p>
        <h1 id="bookmarklet-title" className={styles.authTitle}>
          The bookmarklet
        </h1>
        <p className={styles.authText}>
          A button for your bookmarks bar. On any website, click it to save that page&apos;s link and title to one of your boards.
        </p>

        <div className={styles.bookmarkletStage}>
          <BookmarkletLink />
        </div>

        <ol className={styles.steps}>
          <li>
            <strong>Show your bookmarks bar</strong>, if you can&apos;t see it: press <kbd className={styles.kbd}>⌘ Cmd</kbd> +{" "}
            <kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>B</kbd> on a Mac, or <kbd className={styles.kbd}>Ctrl</kbd> +{" "}
            <kbd className={styles.kbd}>Shift</kbd> + <kbd className={styles.kbd}>B</kbd> on Windows.
          </li>
          <li>
            <strong>Drag the button above</strong> onto the bookmarks bar and let go.
          </li>
          <li>
            <strong>On any website</strong>, click the new bookmark. A small window opens with the page&apos;s link and title filled in.
          </li>
          <li>
            <strong>Choose a board</strong>, add a note if you like, and press <strong>Save</strong>.
          </li>
        </ol>

        <p className={styles.hint}>
          It remembers the board you used last. If nothing happens when you click it, your browser may be blocking pop-up windows: allow
          them for the website you&apos;re on. On a phone, bookmarks bars don&apos;t exist, so this only works on a computer.
        </p>
      </section>
    </Frame>
  );
}
