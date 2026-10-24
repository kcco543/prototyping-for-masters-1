/**
 * Every query for boards and items. Server only.
 *
 * HOW THE RULES ARE ENFORCED
 * - Only pages and server actions call these functions, and they always
 *   pass the user id from the session (lib/session.ts), never one from the
 *   browser.
 * - Changing something always includes `user_id = <you>` in the query
 *   itself. If the board or item isn't yours, the query simply matches
 *   nothing: there's no separate "check, then change" step that could be
 *   forgotten.
 * - A private board is only found for its owner (see findViewableBoard).
 *
 * BOARDS AND ITEMS: MANY TO MANY
 * An item can be on several boards. The item itself (picture, link, title,
 * note) is one row in `items`; which boards it's on is in the join table
 * `board_items`, one row per (board, item) pair (db/migrations/0006).
 * Postgres itself refuses a row that pairs your item with someone else's
 * board. Every item is on at least one board: taking it off its last board
 * deletes it (removeItemFromBoard, deleteBoard).
 *
 * Some changes need several queries that must all happen or none at all
 * (for example "take it off this board, and delete it if that was its last
 * board"). Those run inside a TRANSACTION (see `transaction` below).
 *
 * The `$1, $2…` placeholders are filled in by `pg` from the list after the
 * query. Never paste values into the SQL text yourself: placeholders are
 * what stops "SQL injection" (someone typing SQL into a form field).
 */

import type { PoolClient } from "pg";
import { getPool } from "./db";
import type { BoardInput, ItemInput } from "./validate";

export type Board = {
  id: string;
  userId: string;
  title: string;
  description: string;
  isPublic: boolean;
  createdAt: Date;
};

/** Who a profile page is about: only what's public. */
export type Profile = { id: string; username: string; displayUsername: string };

/** A picture: an address on another website, or an uploaded file's path in Supabase Storage. */
export type PictureRef = { url: string | null; path: string | null };

/** A board on the home page: with how many items it has and a few pictures to preview. */
export type BoardSummary = Board & {
  itemCount: number;
  previews: PictureRef[];
};

export type Item = {
  id: string;
  imageUrl: string | null;
  /** An uploaded picture's path in Supabase Storage (see lib/storage.ts) */
  imagePath: string | null;
  linkUrl: string | null;
  title: string;
  note: string;
  /** The picture's most common colour, like "#d4532f" (lib/dominant-color.ts), or null */
  dominantColor: string | null;
  createdAt: Date;
  /**
   * Every board this item is on. Only filled in for the item's owner (it's
   * empty for everyone else), so visitors to a public board can't find out
   * about your other boards.
   */
  boardIds: string[];
};

// "as userId" etc. renames the columns to the camelCase names JavaScript uses.
const BOARD_COLUMNS = `b.id, b.user_id as "userId", b.title, b.description, b.is_public as "isPublic", b.created_at as "createdAt"`;
const ITEM_COLUMNS = `i.id, i.image_url as "imageUrl", i.image_path as "imagePath", i.link_url as "linkUrl", i.title, i.note, i.dominant_color as "dominantColor", i.created_at as "createdAt"`;

/**
 * Runs `work` as one transaction: either every query in it happens, or (if
 * anything throws) none of them do. A transaction needs all its queries on
 * the same connection, so we borrow one from the pool for the whole time.
 */
async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/* ---------- Reading ---------- */

/**
 * Someone's boards, newest first, each with its item count and up to 4
 * recently added pictures. `onlyPublic` leaves out private boards: that's
 * what a profile page shows (listPublicBoards).
 */
async function boardSummaries(userId: string, onlyPublic: boolean): Promise<BoardSummary[]> {
  const { rows } = await getPool().query<BoardSummary>(
    `select ${BOARD_COLUMNS},
       (select count(*)::int from board_items bi where bi.board_id = b.id) as "itemCount",
       array(
         select json_build_object('url', i.image_url, 'path', i.image_path)
         from board_items bi join items i on i.id = bi.item_id
         where bi.board_id = b.id and (i.image_url is not null or i.image_path is not null)
         order by bi.added_at desc limit 4
       ) as previews
     from boards b
     where b.user_id = $1 and (b.is_public or not $2)
     order by b.created_at desc`,
    [userId, onlyPublic],
  );
  return rows;
}

/** All your boards (private and public): for your library's home page. */
export function listBoards(userId: string): Promise<BoardSummary[]> {
  return boardSummaries(userId, false);
}

/** Only someone's PUBLIC boards: for their profile page. Private boards are never in the answer. */
export function listPublicBoards(userId: string): Promise<BoardSummary[]> {
  return boardSummaries(userId, true);
}

/**
 * The person with this username, or null. Usernames are stored in lower
 * case, so "/u/Mia" finds "mia". Only the id and usernames come back: never
 * their email or name.
 */
export async function findProfile(username: string): Promise<Profile | null> {
  const { rows } = await getPool().query<Profile>(
    `select id, username, coalesce("displayUsername", username) as "displayUsername"
     from "user" where username = lower($1)`,
    [username],
  );
  return rows[0] ?? null;
}

/** A board owner's username (null if they haven't chosen one), for "by @username" on public boards. */
export async function ownerUsername(userId: string): Promise<{ username: string; displayUsername: string } | null> {
  const { rows } = await getPool().query<{ username: string; displayUsername: string }>(
    `select username, coalesce("displayUsername", username) as "displayUsername"
     from "user" where id = $1 and username is not null`,
    [userId],
  );
  return rows[0] ?? null;
}

/** Just the ids and titles of your boards, newest first: for "Which boards is it on?" */
export async function listBoardTitles(userId: string): Promise<Pick<Board, "id" | "title">[]> {
  const { rows } = await getPool().query<Pick<Board, "id" | "title">>(
    `select id, title from boards where user_id = $1 order by created_at desc`,
    [userId],
  );
  return rows;
}

/**
 * A board, if this visitor may see it: it's public, or it's theirs.
 * `viewerId` is null for signed-out visitors.
 *
 * A private board belonging to someone else comes back as null, exactly like
 * a board that doesn't exist, so the page shows the same "not found" for
 * both and nobody can even tell that a private board is there.
 */
export async function findViewableBoard(boardId: string, viewerId: string | null): Promise<Board | null> {
  const { rows } = await getPool().query<Board>(
    `select ${BOARD_COLUMNS} from boards b
     where b.id = $1 and (b.is_public or b.user_id = $2)`,
    [boardId, viewerId],
  );
  return rows[0] ?? null;
}

/**
 * The items on a board, most recently added first. It takes the board found
 * by findViewableBoard (not just an id), as a reminder to check that first.
 */
export async function listItems(board: Board, viewerId: string | null): Promise<Item[]> {
  const { rows } = await getPool().query<Item>(
    `select ${ITEM_COLUMNS},
       case when i.user_id = $2
         then array(select x.board_id::text from board_items x where x.item_id = i.id)
         else '{}'::text[]
       end as "boardIds"
     from board_items bi join items i on i.id = bi.item_id
     where bi.board_id = $1
     order by bi.added_at desc`,
    [board.id, viewerId],
  );
  return rows;
}

/** Is this board yours? Used before handing out an upload link for it. */
export async function ownsBoard(userId: string, boardId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(`select 1 from boards where id = $1 and user_id = $2`, [boardId, userId]);
  return rowCount === 1;
}

/** The picture you saved now on one of your items, and its colour. Null if the item isn't yours. */
export type OwnItemPicture = { imageUrl: string | null; imagePath: string | null; dominantColor: string | null };

export async function findOwnItem(userId: string, itemId: string): Promise<OwnItemPicture | null> {
  const { rows } = await getPool().query<OwnItemPicture>(
    `select image_url as "imageUrl", image_path as "imagePath", dominant_color as "dominantColor"
     from items where id = $1 and user_id = $2`,
    [itemId, userId],
  );
  return rows[0] ?? null;
}

/** Which of these uploaded pictures no item uses any more (so their files can go). */
export async function unusedImagePaths(userId: string, paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { rows } = await getPool().query<{ path: string }>(
    `select p.path from unnest($2::text[]) as p(path)
     where not exists (select 1 from items i where i.user_id = $1 and i.image_path = p.path)`,
    [userId, paths],
  );
  return rows.map((row) => row.path);
}

/* ---------- Changing: always "where … and user_id = <you>" ---------- */

/** Creates a board and returns its new id. */
export async function insertBoard(userId: string, input: BoardInput): Promise<string> {
  const { rows } = await getPool().query<{ id: string }>(
    `insert into boards (user_id, title, description, is_public)
     values ($1, $2, $3, $4)
     returning id`,
    [userId, input.title, input.description, input.isPublic],
  );
  return rows[0].id;
}

/** Returns false if there's no such board, or it isn't yours. */
export async function updateBoard(userId: string, boardId: string, input: BoardInput): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `update boards set title = $3, description = $4, is_public = $5
     where id = $1 and user_id = $2`,
    [boardId, userId, input.title, input.description, input.isPublic],
  );
  return rowCount === 1;
}

/**
 * Deletes one of your boards, and the items that were ONLY on this board.
 * Items that are also on other boards stay there. Returns the uploaded
 * pictures of the deleted items (so their files can go too), or null if
 * the board isn't yours.
 */
export async function deleteBoard(userId: string, boardId: string): Promise<{ imagePaths: string[] } | null> {
  return transaction(async (client) => {
    // 1. Which of its items are on no other board?
    const { rows: onlyHere } = await client.query<{ itemId: string }>(
      `select bi.item_id as "itemId" from board_items bi
       where bi.board_id = $1 and bi.user_id = $2
         and not exists (select 1 from board_items o where o.item_id = bi.item_id and o.board_id <> $1)`,
      [boardId, userId],
    );

    // 2. Delete the board. "on delete cascade" removes its board_items rows.
    const { rowCount } = await client.query(`delete from boards where id = $1 and user_id = $2`, [boardId, userId]);
    if (rowCount !== 1) return null;

    // 3. Delete the items that were only on it.
    const { rows: gone } = await client.query<{ imagePath: string | null }>(
      `delete from items where user_id = $1 and id = any($2::uuid[])
       returning image_path as "imagePath"`,
      [userId, onlyHere.map((row) => row.itemId)],
    );
    return { imagePaths: gone.flatMap((row) => (row.imagePath ? [row.imagePath] : [])) };
  });
}

/**
 * Creates an item on one of your boards, but only if the board is yours:
 * everything is built from `select … from boards where id = <board> and
 * user_id = <you>`, so for anyone else's board there's nothing to insert.
 * One statement makes the item AND its board_items row.
 */
export async function insertItem(userId: string, boardId: string, input: ItemInput, dominantColor: string | null): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `with board as (
       select id, user_id from boards where id = $1 and user_id = $2
     ), item as (
       insert into items (user_id, image_url, image_path, link_url, title, note, dominant_color)
       select user_id, $3, $4, $5, $6, $7, $8 from board
       returning id, user_id
     )
     insert into board_items (board_id, item_id, user_id)
     select board.id, item.id, item.user_id from board, item`,
    [boardId, userId, input.imageUrl, input.imagePath, input.linkUrl, input.title, input.note, dominantColor],
  );
  return rowCount === 1;
}

/** What updateItem did: which boards to refresh, or why it couldn't. */
export type ItemUpdate = { ok: true; boardIds: string[] } | { ok: false; reason: "not-found" | "no-boards" };

/**
 * Changes one of your items, and which of your boards it's on. `boardIds`
 * are the boards it should be on afterwards: it's taken off the others and
 * put on new ones. Boards that aren't yours are ignored (and Postgres would
 * refuse them anyway). It must end up on at least one board.
 */
export async function updateItem(
  userId: string,
  itemId: string,
  input: ItemInput,
  boardIds: string[],
  dominantColor: string | null,
): Promise<ItemUpdate> {
  return transaction<ItemUpdate>(async (client) => {
    const { rowCount } = await client.query(
      `update items set image_url = $3, image_path = $4, link_url = $5, title = $6, note = $7, dominant_color = $8
       where id = $1 and user_id = $2`,
      [itemId, userId, input.imageUrl, input.imagePath, input.linkUrl, input.title, input.note, dominantColor],
    );
    if (rowCount !== 1) return { ok: false, reason: "not-found" };

    // Take it off the boards that aren't ticked any more…
    const { rows: removed } = await client.query<{ boardId: string }>(
      `delete from board_items where item_id = $1 and user_id = $2 and board_id <> all($3::uuid[])
       returning board_id as "boardId"`,
      [itemId, userId, boardIds],
    );
    // …and put it on the newly ticked ones (only boards that are yours).
    await client.query(
      `insert into board_items (board_id, item_id, user_id)
       select b.id, $1, b.user_id from boards b
       where b.id = any($3::uuid[]) and b.user_id = $2
       on conflict (board_id, item_id) do nothing`,
      [itemId, userId, boardIds],
    );

    const { rows: now } = await client.query<{ boardId: string }>(`select board_id as "boardId" from board_items where item_id = $1`, [itemId]);
    // On no boards at all? Undo everything (throwing rolls the transaction back).
    if (now.length === 0) throw new NoBoardsLeft();

    return { ok: true, boardIds: [...new Set([...removed, ...now].map((row) => row.boardId))] };
  }).catch((error): ItemUpdate => {
    if (error instanceof NoBoardsLeft) return { ok: false, reason: "no-boards" };
    throw error;
  });
}

class NoBoardsLeft extends Error {}

/**
 * Takes one of your items off one of your boards. If that was the last
 * board it was on, the item is deleted, and its uploaded picture is
 * returned so the file can go too. Null if there was nothing to remove.
 */
export async function removeItemFromBoard(
  userId: string,
  itemId: string,
  boardId: string,
): Promise<{ itemDeleted: boolean; imagePath: string | null } | null> {
  return transaction(async (client) => {
    const { rowCount } = await client.query(`delete from board_items where board_id = $1 and item_id = $2 and user_id = $3`, [
      boardId,
      itemId,
      userId,
    ]);
    if (rowCount !== 1) return null;

    const { rows } = await client.query<{ imagePath: string | null }>(
      `delete from items i
       where i.id = $1 and i.user_id = $2
         and not exists (select 1 from board_items x where x.item_id = i.id)
       returning image_path as "imagePath"`,
      [itemId, userId],
    );
    return { itemDeleted: rows.length === 1, imagePath: rows[0]?.imagePath ?? null };
  });
}
