/**
 * A public profile: /prototypes/inspiration-library/u/<username>
 *
 * Shows that person's PUBLIC boards, and nothing else: not their private
 * boards (not even how many there are), their name or their email. The
 * rule lives in the database query, listPublicBoards in lib/boards.ts
 * (`where … and is_public`), so a private board can't appear here by
 * accident. Anyone can visit, signed in or not; the owner sees the same
 * page as everyone else.
 *
 * Usernames come from the username plugin (lib/auth.ts). An unknown
 * username shows "No one here" (not-found.tsx in this folder).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import BoardCard, { withPreviews } from "../../BoardCard";
import Frame from "../../Frame";
import { findProfile, listPublicBoards } from "../../lib/boards";
import { HOME } from "../../lib/paths";
import { attempt } from "../../lib/problems";
import { getSession } from "../../lib/session";
import { checkSettings } from "../../lib/settings";
import { ProblemNotice, SetupNotice } from "../../SetupNotice";
import styles from "../../styles.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ username: string }> };

/** The same rules as the username plugin: anything else can't be anyone's username. */
function looksLikeUsername(value: string) {
  return /^[A-Za-z0-9_.]{3,30}$/.test(value);
}

/** The person, their public boards, and who's visiting (for the top bar). Shared by the title and the page. */
const loadProfile = cache(async (username: string) => {
  const session = await getSession();
  const profile = await findProfile(username);
  const boards = profile ? await withPreviews(await listPublicBoards(profile.id)) : [];
  return { user: session?.user ?? null, profile, boards };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  if (!checkSettings().ok || !looksLikeUsername(username)) return { title: "Inspiration library" };
  const result = await attempt(() => loadProfile(username));
  const profile = result.ok ? result.value.profile : null;
  return { title: profile ? `@${profile.displayUsername} · Inspiration library` : "Not found · Inspiration library" };
}

export default async function ProfilePage({ params }: Props) {
  const settings = checkSettings();
  if (!settings.ok) {
    return (
      <Frame>
        <SetupNotice check={settings} />
      </Frame>
    );
  }

  const { username } = await params;
  if (!looksLikeUsername(username)) notFound();

  const result = await attempt(() => loadProfile(username));
  if (!result.ok) {
    return (
      <Frame>
        <ProblemNotice problem={result.problem} />
      </Frame>
    );
  }

  const { user, profile, boards } = result.value;
  if (!profile) notFound();
  const isYou = user?.id === profile.id;

  return (
    <Frame user={user}>
      <section aria-labelledby="profile-title">
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>Public boards</p>
            <h1 id="profile-title" className={styles.pageTitle}>
              @{profile.displayUsername}
            </h1>
          </div>
        </div>

        {isYou && (
          <p className={styles.profileIntro}>
            This is what everyone sees: only your public boards. Your private boards are on{" "}
            <Link className={styles.textLink} href={HOME}>
              your library&apos;s home page
            </Link>
            .
          </p>
        )}

        {boards.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No public boards yet</p>
            <p className={styles.emptyText}>
              {isYou ? "Open a board, choose Edit board, and tick Public board to show it here." : "Nothing is shared here yet."}
            </p>
          </div>
        ) : (
          <ul className={styles.boardGrid}>
            {boards.map((board) => (
              <li key={board.id} className={styles.boardGridItem}>
                {/* Every board here is public, so the Public / Private badge would only repeat itself. */}
                <BoardCard board={board} showVisibility={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Frame>
  );
}
