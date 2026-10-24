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
 * board.
 *
 * Two views, chosen with `?view=` in the address:
 *   (none)        newest first, in a masonry grid, with the editing tools
 *   ?view=color   by colour: square tiles sorted round the colour wheel
 *                 like a gradient, using each picture's dominant colour
 *                 (lib/color.ts, lib/dominant-color.ts) Even if someone rebuilt the forms by hand, the server actions would
 * still refuse, because they check ownership again (actions.ts).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { deleteBoardAction, removeItemAction } from "../../actions";
import BoardForm from "../../BoardForm";
import ConfirmButton from "../../ConfirmButton";
import CopyLinkButton from "../../CopyLinkButton";
import Frame from "../../Frame";
import ItemForm from "../../ItemForm";
import ItemImage from "../../ItemImage";
import { findViewableBoard, listBoardTitles, listItems, ownerUsername, type Board, type Item } from "../../lib/boards";
import { sortByColor } from "../../lib/color";
import { boardHref, HOME, profileHref, SIGN_UP } from "../../lib/paths";
import { attempt } from "../../lib/problems";
import { getSession } from "../../lib/session";
import { checkSettings, uploadsReady } from "../../lib/settings";
import { pictureSrc, signedImageUrls } from "../../lib/storage";
import { isUuid } from "../../lib/validate";
import { ProblemNotice, SetupNotice } from "../../SetupNotice";
import shared from "../../styles.module.css";
import styles from "../../boards.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ boardId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
};

/** An item, with the address to show its picture at (or null if it has none, or it can't be shown). */
type ShownItem = Item & { imageSrc: string | null };

/**
 * Who's visiting, the board (if they may see it) and its items.
 * `cache` lets the page title and the page share one trip to the database.
 */
const loadBoard = cache(async (boardId: string) => {
  const session = await getSession();
  const board = await findViewableBoard(boardId, session?.user.id ?? null);
  const viewerId = session?.user.id ?? null;
  const items = board ? await listItems(board, viewerId) : [];
  // For the owner's "Boards" checklist when editing an item.
  const yourBoards = board && viewerId === board.userId ? await listBoardTitles(viewerId) : [];
  // Uploaded pictures are private: make a signed one-hour link for each
  // (lib/storage.ts). This only runs once findViewableBoard has said this
  // visitor may see the board.
  const signed = await signedImageUrls(items.flatMap((item) => (item.imagePath ? [item.imagePath] : [])));
  const shown: ShownItem[] = items.map((item) => ({ ...item, imageSrc: pictureSrc({ url: item.imageUrl, path: item.imagePath }, signed) }));
  // "by @username" on a public board, linking to its owner's profile (which
  // only lists public boards). Private boards don't need it.
  const owner = board?.isPublic ? await ownerUsername(board.userId) : null;
  return { user: session?.user ?? null, board, items: shown, yourBoards, owner };
});

/** The browser tab shows the board's title, but only to people who may see the board. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { boardId } = await params;
  if (!checkSettings().ok || !isUuid(boardId)) return { title: "Inspiration library" };
  const result = await attempt(() => loadBoard(boardId));
  const board = result.ok ? result.value.board : null;
  return { title: board ? `${board.title} · Inspiration library` : "Not found · Inspiration library" };
}

export default async function BoardPage({ params, searchParams }: Props) {
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

  const { user, board, items, yourBoards, owner } = result.value;
  // Doesn't exist, or it's someone else's private board: the same page for both.
  if (!board) notFound();

  const isOwner = user?.id === board.userId;
  const byColor = (await searchParams).view === "color";
  const uploads = uploadsReady();
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
        {owner && (
          <p className={shared.byLine}>
            by{" "}
            <Link className={shared.textLink} href={profileHref(owner.username)}>
              @{owner.displayUsername}
            </Link>
          </p>
        )}
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
            <ItemForm mode="add" boardId={board.id} uploads={uploads} />
          </section>

          <details className={styles.settingsPanel}>
            <summary className={styles.settingsSummary}>Edit board</summary>
            <div className={styles.settingsBody}>
              <BoardForm board={board} />
              <form action={deleteBoardAction} className={styles.dangerZone}>
                <input type="hidden" name="boardId" value={board.id} />
                <p className={styles.dangerText}>
                  Deleting the board also deletes its items, except those that are on other boards too. This can&apos;t be undone.
                </p>
                <ConfirmButton
                  className={shared.buttonDanger}
                  question={`Delete “${board.title}”? Its items are deleted too, unless they're also on another board. This can't be undone.`}
                >
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
            {isOwner ? "Add a picture or a link above to save the first item." : "This board doesn't have any items yet."}
          </p>
        </div>
      ) : (
        <>
          <ViewSwitch boardId={board.id} byColor={byColor} />
          {byColor ? (
            <ColorView items={items} board={board} isOwner={isOwner} />
          ) : (
            <ul className={styles.masonry} aria-label={`Items on ${board.title}`}>
              {items.map((item) => (
                <li key={item.id} className={styles.masonryItem}>
                  <ItemCard item={item} board={board} isOwner={isOwner} uploads={uploads} yourBoards={yourBoards} />
                </li>
              ))}
            </ul>
          )}
        </>
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

type ItemCardProps = {
  item: ShownItem;
  /** The board this card is shown on */
  board: Board;
  isOwner: boolean;
  uploads: boolean;
  yourBoards: { id: string; title: string }[];
};

function ItemCard({ item, board, isOwner, uploads, yourBoards }: ItemCardProps) {
  // Also on other boards? Then "remove" only takes it off this one.
  const onOtherBoards = item.boardIds.length > 1;
  // Clicking the picture opens the link, or the picture itself if there's no link.
  const opens = item.linkUrl ?? item.imageSrc;

  return (
    <article className={styles.itemCard}>
      {item.imageUrl || item.imagePath ? (
        <a
          className={styles.itemImageLink}
          href={opens ?? undefined}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          // The picture's own colour fills the space while it loads.
          style={item.dominantColor ? { backgroundColor: item.dominantColor } : undefined}
        >
          <ItemImage src={item.imageSrc} alt={item.title} />
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
            {/* A new upload goes in this board's folder (lib/storage.ts). */}
            <ItemForm mode="edit" boardId={board.id} uploads={uploads} item={item} imageSrc={item.imagePath ? item.imageSrc : null} boards={yourBoards} />
            <form action={removeItemAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="boardId" value={board.id} />
              {onOtherBoards ? (
                <ConfirmButton
                  className={shared.buttonDangerSmall}
                  question={`Remove this item from “${board.title}”? It stays on its other ${item.boardIds.length - 1 === 1 ? "board" : "boards"}.`}
                >
                  Remove from this board
                </ConfirmButton>
              ) : (
                <ConfirmButton className={shared.buttonDangerSmall} question="Delete this item? It isn't on any other board. This can't be undone.">
                  Delete item
                </ConfirmButton>
              )}
            </form>
          </div>
        </details>
      )}
    </article>
  );
}

/* ---------- The "By colour" view ---------- */

/** "Newest first" or "By colour": two links, so each view has its own address you can share. */
function ViewSwitch({ boardId, byColor }: { boardId: string; byColor: boolean }) {
  return (
    <nav className={styles.viewSwitch} aria-label="Arrange the board">
      <Link href={boardHref(boardId)} className={byColor ? styles.viewOption : styles.viewOptionActive} aria-current={byColor ? undefined : "page"}>
        Newest first
      </Link>
      <Link
        href={`${boardHref(boardId)}?view=color`}
        className={byColor ? styles.viewOptionActive : styles.viewOption}
        aria-current={byColor ? "page" : undefined}
      >
        By colour
      </Link>
    </nav>
  );
}

function ColorView({ items, board, isOwner }: { items: ShownItem[]; board: Board; isOwner: boolean }) {
  const sorted = sortByColor(items);
  const colors = sorted.flatMap((item) => item.dominantColor ?? []);
  const missing = items.length - colors.length;

  return (
    <section aria-label={`Items on ${board.title}, arranged by colour`}>
      {/* The whole board's palette as one strip: every colour, in order, blended together. */}
      {colors.length > 0 && (
        <div
          className={styles.gradientBar}
          style={{ background: colors.length === 1 ? colors[0] : `linear-gradient(to right, ${colors.join(", ")})` }}
          aria-hidden="true"
        />
      )}

      <ul className={styles.colorGrid}>
        {sorted.map((item) => (
          <li key={item.id} className={styles.colorTile} style={item.dominantColor ? { backgroundColor: item.dominantColor } : undefined}>
            <a
              className={styles.colorTileLink}
              href={item.linkUrl ?? item.imageSrc ?? undefined}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              title={[item.title, item.dominantColor].filter(Boolean).join(" · ") || undefined}
            >
              {item.imageSrc ? (
                <ItemImage src={item.imageSrc} alt={item.title} fill />
              ) : (
                <span className={styles.colorTileText}>{item.title || (item.linkUrl ? siteName(item.linkUrl) : "No picture")}</span>
              )}
              {item.dominantColor && <span className={styles.colorTileHex}>{item.dominantColor}</span>}
            </a>
          </li>
        ))}
      </ul>

      <p className={styles.colorNote}>
        Sorted by each picture&apos;s main colour, round the colour wheel, then greys from light to dark.
        {missing > 0 && ` ${missing} ${missing === 1 ? "item has" : "items have"} no colour (no picture, or it couldn't be read) and ${missing === 1 ? "comes" : "come"} last.`}
        {isOwner && " To edit items, switch to Newest first."}
      </p>
    </section>
  );
}
