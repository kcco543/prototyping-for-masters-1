/**
 * A board as a card: up to four preview pictures, its title, how many items
 * it has, and Public / Private. Used on your library's home page (all your
 * boards) and on profile pages (only public boards). Server only.
 */

import Link from "next/link";
import type { BoardSummary } from "./lib/boards";
import { boardHref } from "./lib/paths";
import { pictureSrc, signedImageUrls } from "./lib/storage";
import styles from "./styles.module.css";

/** A board, with its preview pictures turned into addresses to show. */
export type BoardCardData = Omit<BoardSummary, "previews"> & { previews: string[] };

/**
 * Turns the boards' preview pictures into addresses. Uploaded ones need
 * signed links (lib/storage.ts), all made in one request. Only call this for
 * boards the visitor may see.
 */
export async function withPreviews(boards: BoardSummary[]): Promise<BoardCardData[]> {
  const signed = await signedImageUrls(boards.flatMap((board) => board.previews.flatMap((picture) => (picture.path ? [picture.path] : []))));
  return boards.map((board) => ({
    ...board,
    previews: board.previews.flatMap((picture) => pictureSrc(picture, signed) ?? []),
  }));
}

export default function BoardCard({ board, showVisibility = true }: { board: BoardCardData; showVisibility?: boolean }) {
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
          {showVisibility && <span className={board.isPublic ? styles.badgePublic : styles.badgePrivate}>{board.isPublic ? "Public" : "Private"}</span>}
        </p>
      </div>
    </Link>
  );
}
