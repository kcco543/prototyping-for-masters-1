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
 * The `$1, $2…` placeholders are filled in by `pg` from the list after the
 * query. Never paste values into the SQL text yourself: placeholders are
 * what stops "SQL injection" (someone typing SQL into a form field).
 */

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

/** A board on the home page: with how many items it has and a few pictures to preview. */
export type BoardSummary = Board & {
  itemCount: number;
  previews: string[];
};

export type Item = {
  id: string;
  boardId: string;
  imageUrl: string | null;
  linkUrl: string | null;
  title: string;
  note: string;
  createdAt: Date;
};

// "as userId" etc. renames the columns to the camelCase names JavaScript uses.
const BOARD_COLUMNS = `b.id, b.user_id as "userId", b.title, b.description, b.is_public as "isPublic", b.created_at as "createdAt"`;
const ITEM_COLUMNS = `i.id, i.board_id as "boardId", i.image_url as "imageUrl", i.link_url as "linkUrl", i.title, i.note, i.created_at as "createdAt"`;

/* ---------- Reading ---------- */

/** Your boards, newest first, each with its item count and up to 4 recent pictures. */
export async function listBoards(userId: string): Promise<BoardSummary[]> {
  const { rows } = await getPool().query<BoardSummary>(
    `select ${BOARD_COLUMNS},
       (select count(*)::int from items i where i.board_id = b.id) as "itemCount",
       array(
         select i.image_url from items i
         where i.board_id = b.id and i.image_url is not null
         order by i.created_at desc limit 4
       ) as previews
     from boards b
     where b.user_id = $1
     order by b.created_at desc`,
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
 * The items of a board, newest first. It takes the board found by
 * findViewableBoard (not just an id), as a reminder to check that first.
 */
export async function listItems(board: Board): Promise<Item[]> {
  const { rows } = await getPool().query<Item>(
    `select ${ITEM_COLUMNS} from items i
     where i.board_id = $1
     order by i.created_at desc`,
    [board.id],
  );
  return rows;
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

/** Deletes a board, and (thanks to "on delete cascade" in schema.sql) all its items. */
export async function deleteBoard(userId: string, boardId: string): Promise<boolean> {
  const { rowCount } = await getPool().query(`delete from boards where id = $1 and user_id = $2`, [boardId, userId]);
  return rowCount === 1;
}

/**
 * Adds an item to a board, but only if the board is yours: the item is
 * built from `select … from boards where id = <board> and user_id = <you>`,
 * so for anyone else's board there's nothing to insert.
 */
export async function insertItem(userId: string, boardId: string, input: ItemInput): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `insert into items (board_id, user_id, image_url, link_url, title, note)
     select b.id, b.user_id, $3, $4, $5, $6
     from boards b
     where b.id = $1 and b.user_id = $2`,
    [boardId, userId, input.imageUrl, input.linkUrl, input.title, input.note],
  );
  return rowCount === 1;
}

/** Changes one of your items. Returns its board's id (to refresh that page), or null if it isn't yours. */
export async function updateItem(userId: string, itemId: string, input: ItemInput): Promise<string | null> {
  const { rows } = await getPool().query<{ boardId: string }>(
    `update items set image_url = $3, link_url = $4, title = $5, note = $6
     where id = $1 and user_id = $2
     returning board_id as "boardId"`,
    [itemId, userId, input.imageUrl, input.linkUrl, input.title, input.note],
  );
  return rows[0]?.boardId ?? null;
}

/** Deletes one of your items. Returns its board's id, or null if it isn't yours. */
export async function deleteItem(userId: string, itemId: string): Promise<string | null> {
  const { rows } = await getPool().query<{ boardId: string }>(
    `delete from items where id = $1 and user_id = $2
     returning board_id as "boardId"`,
    [itemId, userId],
  );
  return rows[0]?.boardId ?? null;
}
