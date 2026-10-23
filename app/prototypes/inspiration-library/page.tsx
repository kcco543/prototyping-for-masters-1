/**
 * Inspiration library: a personal Are.na / Pinterest. Save images and links
 * into boards; keep a board private, or share it with a link.
 *
 * This is the prototype's home page, a SERVER component (no "use client"),
 * so it can ask Better Auth who's visiting before anything is sent to the
 * browser:
 *   - signed out → a short landing page with Sign in and Sign up
 *   - signed in  → your boards, and a "New board" button
 *
 * How the pieces fit together:
 *   lib/auth.ts      Better Auth (accounts, sessions), on the server
 *   lib/session.ts   "who is visiting?" for pages and server actions
 *   lib/boards.ts    every database query for boards and items
 *   actions.ts       what the forms call to change things
 *   schema.sql       the database tables (run once in Supabase)
 *
 * Setup steps are in README.md, and on the page itself until it's connected.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Frame from "./Frame";
import { listBoards, type BoardSummary } from "./lib/boards";
import { boardHref, NEW_BOARD, SIGN_IN, SIGN_UP } from "./lib/paths";
import { attempt } from "./lib/problems";
import { getSession } from "./lib/session";
import { checkSettings } from "./lib/settings";
import { ProblemNotice, SetupNotice } from "./SetupNotice";
import styles from "./styles.module.css";

export const metadata: Metadata = {
  title: "Inspiration library",
  description: "A personal Are.na / Pinterest: save images and links into boards.",
};

// Built fresh for every visit, because it depends on who's signed in.
export const dynamic = "force-dynamic";

export default async function InspirationLibrary() {
  const settings = checkSettings();
  if (!settings.ok) {
    return (
      <Frame>
        <SetupNotice check={settings} />
      </Frame>
    );
  }

  const result = await attempt(async () => {
    const session = await getSession();
    if (!session) return { user: null, boards: [] };
    // Only YOUR boards: the user id comes from the session.
    return { user: session.user, boards: await listBoards(session.user.id) };
  });

  if (!result.ok) {
    return (
      <Frame>
        <ProblemNotice problem={result.problem} />
      </Frame>
    );
  }

  const { user, boards } = result.value;
  return <Frame user={user}>{user ? <YourBoards name={user.name} boards={boards} /> : <Landing />}</Frame>;
}

/* ---------- Signed out: the landing page ---------- */

/** The made-up "pins" on the landing page: just coloured shapes, no pictures. */
const SAMPLE_PINS = [
  { label: "Risograph pink", tone: "pinRose", tall: true },
  { label: "Grotesk, 1957", tone: "pinInk", tall: false },
  { label: "Morning light", tone: "pinSun", tall: false },
  { label: "Moss & clay", tone: "pinMoss", tall: true },
  { label: "Packaging", tone: "pinSky", tall: true },
  { label: "Paper texture", tone: "pinPaper", tall: false },
] as const;

function Landing() {
  return (
    <div className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <p className={styles.eyebrow}>A personal Are.na / Pinterest</p>
        <h1 id="landing-title" className={styles.heroTitle}>
          Keep the things that <em className={styles.heroItalic}>inspire</em> you.
        </h1>
        <p className={styles.heroText}>
          Paste an image or a link, add a note, and gather it into a board. Boards are private until you choose to share one with a link.
        </p>
        <div className={styles.actions}>
          <Link href={SIGN_UP} className={styles.button}>
            Start your library
          </Link>
          <Link href={SIGN_IN} className={styles.buttonQuiet}>
            Sign in
          </Link>
        </div>
      </section>

      <div className={styles.pinboard} aria-hidden="true">
        {SAMPLE_PINS.map((pin) => (
          <div key={pin.label} className={`${styles.pin} ${styles[pin.tone]} ${pin.tall ? styles.pinTall : ""}`}>
            <span className={styles.pinLabel}>{pin.label}</span>
          </div>
        ))}
      </div>

      <ol className={styles.howItWorks}>
        <li className={styles.howStep}>
          <span className={styles.howNumber}>1</span>
          <strong className={styles.howTitle}>Make a board</strong>
          <span className={styles.howText}>“Type specimens”, “Kitchen ideas”, “Thesis references”…</span>
        </li>
        <li className={styles.howStep}>
          <span className={styles.howNumber}>2</span>
          <strong className={styles.howTitle}>Save what you find</strong>
          <span className={styles.howText}>Paste an image address or a link, with a title and a note.</span>
        </li>
        <li className={styles.howStep}>
          <span className={styles.howNumber}>3</span>
          <strong className={styles.howTitle}>Share if you like</strong>
          <span className={styles.howText}>Make a board public and anyone with the link can look (but not change it).</span>
        </li>
      </ol>
    </div>
  );
}

/* ---------- Signed in: your boards ---------- */

function YourBoards({ name, boards }: { name: string; boards: BoardSummary[] }) {
  return (
    <section aria-labelledby="boards-title">
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.eyebrow}>{name}&apos;s library</p>
          <h1 id="boards-title" className={styles.pageTitle}>
            Your boards
          </h1>
        </div>
        <Link href={NEW_BOARD} className={styles.button}>
          + New board
        </Link>
      </div>

      {boards.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No boards yet</p>
          <p className={styles.emptyText}>A board is a collection, like “Colour palettes” or “Good websites”. Make your first one to start saving.</p>
          <Link href={NEW_BOARD} className={styles.button}>
            Make your first board
          </Link>
        </div>
      ) : (
        <ul className={styles.boardGrid}>
          {boards.map((board) => (
            <li key={board.id} className={styles.boardGridItem}>
              <BoardCard board={board} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BoardCard({ board }: { board: BoardSummary }) {
  return (
    <Link href={boardHref(board.id)} className={styles.boardCard}>
      <div className={`${styles.boardPreview} ${styles[`preview${Math.min(board.previews.length, 4)}`]}`}>
        {board.previews.map((src, index) => (
          // Plain <img>: the pictures come from all over the web, so Next.js's
          // <Image> (which needs every website listed in next.config.ts) doesn't fit.
          <img key={`${src}-${index}`} className={styles.boardPreviewImage} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ))}
        {board.previews.length === 0 && <span className={styles.boardPreviewEmpty}>{board.itemCount > 0 ? "Links only" : "Empty"}</span>}
      </div>
      <div className={styles.boardCardBody}>
        <h2 className={styles.boardCardTitle}>{board.title}</h2>
        <p className={styles.boardCardMeta}>
          {board.itemCount} {board.itemCount === 1 ? "item" : "items"}
          <span className={board.isPublic ? styles.badgePublic : styles.badgePrivate}>{board.isPublic ? "Public" : "Private"}</span>
        </p>
      </div>
    </Link>
  );
}
