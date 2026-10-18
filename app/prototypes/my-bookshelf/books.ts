/**
 * A Constellation of Stories — what one book looks like inside this prototype.
 *
 * Notion describes a book with a lot of extra detail (ids, colours, text
 * formatting, timestamps…). `notion.ts` boils each one down to this small,
 * tidy `Book`, and the page only ever deals with that. Both files import
 * these types, so they always agree on the shape.
 */

/** The ten colours a Notion select option can have. */
export type NotionColor = "default" | "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red";

export type Book = {
  id: string;
  title: string;
  author: string;
  /** The Genre option, with the colour you gave it in Notion. null if not set. */
  genre: { name: string; color: NotionColor } | null;
  /** A link to the cover picture, or null (the page then draws a cover). */
  cover: string | null;
  /** Usually 1 to 5 (see RATING_OUT_OF). null if not rated yet. */
  rating: number | null;
  /** The review, as plain text. Line breaks are kept. */
  review: string;
  /** When the book was added to Notion (an ISO date, e.g. "2026-10-16T09:30:00.000Z"). */
  addedAt: string;
  /** The book's own page in Notion, for the "Open in Notion" link. (Just an address, not a password.) */
  url: string | null;
};

/** The top of the rating scale: how many stars a perfect book gets. */
export const RATING_OUT_OF = 5;

/** Everything that can stop the shelf from loading. The page explains each one. */
export type Problem =
  | "not_configured" // .env.local is missing the token or the database link
  | "bad_link" // NOTION_DATABASE_ID doesn't contain a database ID
  | "unauthorized" // Notion didn't accept the token
  | "not_found" // the database doesn't exist, or the connection can't see it
  | "restricted" // the connection isn't allowed to read content
  | "no_table" // the database has no data source (table) inside it
  | "rate_limited" // too many requests in a short time
  | "unavailable"; // Notion couldn't be reached

/** What the page gets from notion.ts: either the books, or the reason there aren't any. */
export type Shelf =
  | {
      ok: true;
      /** The database's name in Notion, e.g. "Reading list". */
      name: string;
      books: Book[];
      /** Property names we looked for but didn't find (e.g. ["Author"]). */
      missing: string[];
      /** Every property name the database does have, to help fix a mismatch. */
      available: string[];
    }
  | {
      ok: false;
      problem: Problem;
      /** For "not_configured": which settings are missing from .env.local. */
      missingSettings?: string[];
    };

/*
  A genre's colour in Notion (the colour of its Select option) becomes its
  constellation's accent on the star map: see ACCENTS in sky.ts.
*/
