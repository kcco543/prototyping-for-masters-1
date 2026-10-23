/**
 * The "New board" page. Signed out? You're sent to sign in first, and come
 * back here afterwards.
 */

import type { Metadata } from "next";
import BoardForm from "../../BoardForm";
import Frame from "../../Frame";
import { HOME, NEW_BOARD } from "../../lib/paths";
import { attempt } from "../../lib/problems";
import { requireUser } from "../../lib/session";
import { checkSettings } from "../../lib/settings";
import { ProblemNotice, SetupNotice } from "../../SetupNotice";
import styles from "../../styles.module.css";

export const metadata: Metadata = { title: "New board · Inspiration library" };

export const dynamic = "force-dynamic";

export default async function NewBoardPage() {
  const settings = checkSettings();
  if (!settings.ok) {
    return (
      <Frame>
        <SetupNotice check={settings} />
      </Frame>
    );
  }

  // Signed out → redirect to the sign-in page (redirect works by throwing, and attempt() lets it through).
  const result = await attempt(() => requireUser(NEW_BOARD));
  if (!result.ok) {
    return (
      <Frame>
        <ProblemNotice problem={result.problem} />
      </Frame>
    );
  }

  return (
    <Frame user={result.value}>
      <section className={styles.formCard} aria-labelledby="new-board-title">
        <p className={styles.eyebrow}>New board</p>
        <h1 id="new-board-title" className={styles.authTitle}>
          What will you collect?
        </h1>
        <BoardForm cancelHref={HOME} />
      </section>
    </Frame>
  );
}
