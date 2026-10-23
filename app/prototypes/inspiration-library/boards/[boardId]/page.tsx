/**
 * A board's page: its items in a masonry grid (like Pinterest), and, for
 * the board's owner only, the tools to add, edit and delete.
 *
 * Who sees what:
 *   - the owner        everything, with the editing tools
 *   - anyone else      a PUBLIC board, without any editing tools
 *                      (signed in or not); a PRIVATE board → "not found"
 *
 * The rule lives in the database query (findViewableBoard in lib/boards.ts),
 * and the editing tools are only drawn when the session's user owns the
 * board. Even if someone rebuilt the forms by hand, the server actions would
 * still refuse, because they check ownership again (actions.ts).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { deleteBoardAction, deleteItemAction } from "../../actions";
import BoardForm from "../../BoardForm";
import ConfirmButton from "../../ConfirmButton";
import CopyLinkButton from "../../CopyLinkButton";
import Frame from "../../Frame";
import ItemForm from "../../ItemForm";
import ItemImage from "../../ItemImage";
import { findViewableBoard, listItems, type Item } from "../../lib/boards";
import { HOME, SIGN_UP } from "../../lib/paths";
import { attempt } from "../../lib/problems";
import { getSession } from "../../lib/session";
import { checkSettings } from "../../lib/settings";
import { isUuid } from "../../lib/validate";
import { ProblemNotice, SetupNotice } from "../../SetupNotice";
import shared from "../../styles.module.css";
import styles from "../../boards.module.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ boardId: string }> };

/**
 * Who's visiting, the board (if they may see it) and its items.
 * `cache` lets the page title and the page share one trip to the database.
 */
const loadBoard = cache(async (boardId: string) => {
  const session = await getSession();
  const board = await findViewableBoard(boardId, session?.user.id ?? null);
  const items = board ? await listItems(board) : [];
  return { user: session?.user ?? null, board, items };
});

/** The browser tab shows the board's title, but only to people who may see the board. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { boardId } = await params;
  if (!checkSettings().ok || !isUuid(boardId)) return { title: "Inspiration library" };
  const result = await attempt(() => loadBoard(boardId));
  const board = result.ok ? result.value.board : null;
  return { title: board ? `${board.title} · Inspiration library` : "Not found · Inspiration library" };
}

export default async function BoardPage({ params }: Props) {
  const settings = checkSettings();
  if (!settings.ok) {
    return (
      <Frame>
        <SetupNotice check={settings} />
      </Frame>
    );
  }

  const { boardId } = await params;
  // Not even shaped like a board id? Then there's no such board.
  if (!isUuid(boardId)) notFound();

  const result = await attempt(() => loadBoard(boardId));
  if (!result.ok) {
    return (
      <Frame>
        <ProblemNotice problem={result.problem} />
      </Frame>
    );
  }

  const { user, board, items } = result.value;
  // Doesn't exist, or it's someone else's private board: the same page for both.
  if (!board) notFound();

  const isOwner = user?.id === board.userId;
  const count = `${items.length} ${items.length === 1 ? "item" : "items"}`;

  return (
    <Frame user={user}>
      <header className={styles.boardHeader}>
        {isOwner && (
          <Link href={HOME} className={styles.backLink}>
            ← Your boards
          </Link>
        )}
        <h1 className={styles.boardTitle}>{board.title}</h1>
        {board.description && <p className={styles.boardDescription}>{board.description}</p>}
        <div className={styles.boardMeta}>
          <span>{count}</span>
          <span className={board.isPublic ? shared.badgePublic : shared.badgePrivate}>{board.isPublic ? "Public" : "Private"}</span>
          {isOwner && <span className={styles.metaNote}>{board.isPublic ? "Anyone with the link can see it." : "Only you can see it."}</span>}
          {board.isPublic && <CopyLinkButton />}
        </div>
      </header>

      {isOwner && (
        <div className={styles.ownerTools}>
          <section className={styles.addPanel} aria-labelledby="add-title">
            <h2 id="add-title" className={styles.panelTitle}>
              Add to this board
            </h2>
            <ItemForm mode="add" boardId={board.id} />
          </section>

          <details className={styles.settingsPanel}>
            <summary className={styles.settingsSummary}>Edit board</summary>
            <div className={styles.settingsBody}>
              <BoardForm board={board} />
              <form action={deleteBoardAction} className={styles.dangerZone}>
                <input type="hidden" name="boardId" value={board.id} />
                <p className={styles.dangerText}>Deleting the board also deletes its {count}. This can&apos;t be undone.</p>
                <ConfirmButton className={shared.buttonDanger} question={`Delete “${board.title}” and its ${count}? This can't be undone.`}>
                  Delete board
                </ConfirmButton>
              </form>
            </div>
          </details>
        </div>
      )}

      {items.length === 0 ? (
        <div className={shared.empty}>
          <p className={shared.emptyTitle}>Nothing here yet</p>
          <p className={shared.emptyText}>
            {isOwner ? "Paste an image address or a link above to save the first item." : "This board doesn't have any items yet."}
          </p>
        </div>
      ) : (
        <ul className={styles.masonry} aria-label={`Items on ${board.title}`}>
          {items.map((item) => (
            <li key={item.id} className={styles.masonryItem}>
              <ItemCard item={item} isOwner={isOwner} />
            </li>
          ))}
        </ul>
      )}

      {!user && (
        <p className={styles.visitorNote}>
          Collect your own images and links.{" "}
          <Link className={shared.textLink} href={SIGN_UP}>
            Start an inspiration library
          </Link>
        </p>
      )}
    </Frame>
  );
}

/** "www.are.na/blog" → "are.na" */
function siteName(address: string) {
  try {
    return new URL(address).hostname.replace(/^www\./, "");
  } catch {
    return address;
  }
}

function ItemCard({ item, isOwner }: { item: Item; isOwner: boolean }) {
  // Clicking the picture opens the link, or the picture itself if there's no link.
  const opens = item.linkUrl ?? item.imageUrl;

  return (
    <article className={styles.itemCard}>
      {item.imageUrl ? (
        <a className={styles.itemImageLink} href={opens ?? undefined} target="_blank" rel="noopener noreferrer nofollow ugc">
          <ItemImage src={item.imageUrl} alt={item.title} />
        </a>
      ) : (
        // A link without a picture: a typographic card with the website's name.
        <a className={styles.itemLinkOnly} href={item.linkUrl ?? undefined} target="_blank" rel="noopener noreferrer nofollow ugc">
          <span className={styles.itemLinkOnlySite}>{item.linkUrl ? siteName(item.linkUrl) : ""}</span>
          <span className={styles.itemLinkOnlyArrow} aria-hidden="true">
            ↗
          </span>
        </a>
      )}

      {(item.title || item.note || item.linkUrl) && (
        <div className={styles.itemBody}>
          {item.title && <h3 className={styles.itemTitle}>{item.title}</h3>}
          {item.note && <p className={styles.itemNote}>{item.note}</p>}
          {item.linkUrl && (
            <a className={styles.itemSite} href={item.linkUrl} target="_blank" rel="noopener noreferrer nofollow ugc">
              {siteName(item.linkUrl)} ↗
            </a>
          )}
        </div>
      )}

      {isOwner && (
        <details className={styles.itemTools}>
          <summary className={styles.itemToolsSummary}>Edit</summary>
          <div className={styles.itemToolsBody}>
            <ItemForm mode="edit" item={item} />
            <form action={deleteItemAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <ConfirmButton className={shared.buttonDangerSmall} question="Delete this item? This can't be undone.">
                Delete item
              </ConfirmButton>
            </form>
          </div>
        </details>
      )}
    </article>
  );
}
