/**
 * My bookshelf — the only file that talks to Notion.
 *
 * It runs on the server only (page.tsx calls it while building the page).
 * That matters because of the token: it is read from `.env.local`, and since
 * its name doesn't start with NEXT_PUBLIC_, Next.js never sends it to the
 * browser. (The Notion SDK even refuses to use a token inside a browser.)
 *
 * HOW NOTION ORGANISES A DATABASE (API version 2026-03-11)
 * Since 2025, a Notion database is a container that holds one or more
 * "data sources": the actual tables with rows and properties. So reading
 * the books takes two steps:
 *
 *   1. Retrieve the database           → find the id of its data source
 *   2. Query that data source          → get the rows (each row is a "page")
 *
 * Each row is then boiled down to our small `Book` shape (see books.ts).
 *
 * Docs: https://developers.notion.com/reference/query-a-data-source
 */

import {
  APIErrorCode,
  Client,
  collectPaginatedAPI,
  isFullDatabase,
  isFullDataSource,
  isFullPage,
  isNotionClientError,
  LogLevel,
  type PageObjectResponse,
  type RichTextItemResponse,
} from "@notionhq/client";
import type { Book, NotionColor, Problem, Shelf } from "./books";

/**
 * The Notion API version this prototype is written for. Notion sends every
 * response in the shape of the version you ask for, so pinning it means a
 * future Notion update can't silently change the data. (The SDK on its own
 * would still ask for the older 2025-09-03.)
 */
export const NOTION_VERSION = "2026-03-11";

/**
 * The names of your database's properties. If yours are called something
 * else (say "Writer" instead of "Author"), change them here. Upper and lower
 * case don't matter. The title doesn't need a name: every Notion database
 * has exactly one title property, and it's found automatically.
 */
export const PROPERTY_NAMES = {
  author: "Author",
  genre: "Genre",
  cover: "Cover Image",
  rating: "Rating",
  review: "Review",
};

/* ---------- Reading one property ---------- */

type Property = PageObjectResponse["properties"][string];

/** Finds a property by name, ignoring upper/lower case and stray spaces. */
function named(properties: PageObjectResponse["properties"], name: string): Property | undefined {
  const wanted = name.trim().toLowerCase();
  for (const [key, value] of Object.entries(properties)) {
    if (key.trim().toLowerCase() === wanted) return value;
  }
  return undefined;
}

/** Joins Notion's formatted text pieces into plain text. */
const plain = (parts: RichTextItemResponse[]) => parts.map((part) => part.plain_text).join("");

/**
 * Any property as text. Most of yours are text already, but this also copes
 * if, say, Author was made a Select or a Person instead of Text.
 */
function textOf(property: Property | undefined): string {
  switch (property?.type) {
    case "title":
      return plain(property.title).trim();
    case "rich_text":
      return plain(property.rich_text).trim();
    case "select":
      return property.select?.name ?? "";
    case "multi_select":
      return property.multi_select.map((option) => option.name).join(", ");
    case "people":
      return property.people.map((person) => ("name" in person ? person.name : "") ?? "").filter(Boolean).join(", ");
    case "url":
      return property.url ?? "";
    default:
      return "";
  }
}

/** The Genre option and its colour. (Works for Select, Multi-select or Status.) */
function genreOf(property: Property | undefined): Book["genre"] {
  let option: { name: string; color: string } | null | undefined = null;
  if (property?.type === "select") option = property.select;
  else if (property?.type === "multi_select") option = property.multi_select[0];
  else if (property?.type === "status") option = property.status;
  return option ? { name: option.name, color: option.color as NotionColor } : null;
}

/**
 * The cover picture's address.
 *
 * A "Files & media" property can hold two kinds of file:
 *   - "external": a link to a picture somewhere on the web. It never changes.
 *   - "file": a picture uploaded to Notion. Notion hands out a temporary link
 *     that only works for ONE HOUR. That's why page.tsx fetches fresh links
 *     every minute instead of saving them.
 * A URL or Text property containing a link also works.
 */
function pictureOf(property: Property | undefined): string | null {
  if (property?.type === "files") {
    for (const file of property.files) {
      if (file.type === "file") return file.file.url;
      if (file.type === "external") return file.external.url;
    }
  }
  if (property?.type === "url") return property.url;
  const text = textOf(property);
  return /^https?:\/\//.test(text) ? text : null;
}

/** If the Cover Image property is empty, the page's own cover (set with "Add cover" in Notion) is used. */
function pageCoverOf(page: PageObjectResponse): string | null {
  if (page.cover?.type === "external") return page.cover.external.url;
  if (page.cover?.type === "file") return page.cover.file.url;
  return null;
}

/**
 * The rating as a number. Your Rating is a Number property, but this also
 * understands a Select like "⭐⭐⭐⭐" or text like "4.5", which many Notion
 * reading-list templates use.
 */
function ratingOf(property: Property | undefined): number | null {
  if (property?.type === "number") return property.number;
  if (property?.type === "formula" && property.formula.type === "number") return property.formula.number;
  const text = textOf(property);
  const stars = text.match(/[⭐★]/gu)?.length ?? 0;
  if (stars > 0) return stars;
  const number = Number.parseFloat(text);
  return Number.isFinite(number) ? number : null;
}

/** One row of the database → one tidy Book. */
function toBook(page: PageObjectResponse): Book {
  const properties = page.properties;
  const title = Object.values(properties).find((property) => property.type === "title");
  return {
    id: page.id,
    title: textOf(title) || "Untitled",
    author: textOf(named(properties, PROPERTY_NAMES.author)),
    genre: genreOf(named(properties, PROPERTY_NAMES.genre)),
    cover: pictureOf(named(properties, PROPERTY_NAMES.cover)) ?? pageCoverOf(page),
    rating: ratingOf(named(properties, PROPERTY_NAMES.rating)),
    review: textOf(named(properties, PROPERTY_NAMES.review)),
    addedAt: page.created_time,
    url: page.url,
  };
}

/* ---------- Finding the database ---------- */

/**
 * Finds the database ID in what you pasted into NOTION_DATABASE_ID. That can
 * be the whole link ("Copy link" in Notion) or just the ID, with or without
 * dashes. In a link, the ID is the 32 characters at the end of the address,
 * just before any "?". (What comes after "?v=" is the id of a view, not of
 * the database, so it's ignored.)
 */
export function databaseIdFrom(text: string): string | null {
  const beforeQuestionMark = text.trim().split(/[?#]/)[0];
  const lastPart = beforeQuestionMark.split("/").filter(Boolean).pop() ?? "";
  const withDashes = lastPart.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (withDashes) return withDashes[0].replace(/-/g, "");
  return lastPart.match(/[0-9a-f]{32}$/i)?.[0] ?? null;
}

/** A problem we spotted ourselves (not an error from Notion). */
class ShelfError extends Error {
  problem: Problem;
  constructor(problem: Problem) {
    super(problem);
    this.problem = problem;
  }
}

/**
 * Step 1: from the database, find its data source (the table with the rows).
 *
 * If what you pasted is a data source ID instead (Notion's "Copy data source
 * ID"), the database lookup fails, so we try it as a data source directly.
 */
async function findTable(notion: Client, id: string): Promise<{ dataSourceId: string; name: string }> {
  try {
    const database = await notion.databases.retrieve({ database_id: id });
    if (!isFullDatabase(database)) throw new ShelfError("not_found");
    // A database can hold several data sources. A reading list has one: use the first.
    const table = database.data_sources[0];
    if (!table) throw new ShelfError("no_table");
    return { dataSourceId: table.id, name: plain(database.title) || table.name };
  } catch (error) {
    if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
      const source = await notion.dataSources.retrieve({ data_source_id: id }).catch(() => null);
      if (source) return { dataSourceId: source.id, name: isFullDataSource(source) ? plain(source.title) : "" };
    }
    throw error;
  }
}

/** Turns an error into a problem the page can explain. */
function problemFrom(error: unknown): Problem {
  if (error instanceof ShelfError) return error.problem;
  if (isNotionClientError(error)) {
    switch (error.code) {
      case APIErrorCode.Unauthorized:
        return "unauthorized";
      case APIErrorCode.ObjectNotFound:
        return "not_found";
      case APIErrorCode.RestrictedResource:
        return "restricted";
      case APIErrorCode.RateLimited:
        return "rate_limited";
      case APIErrorCode.ValidationError:
      case APIErrorCode.InvalidRequestURL:
        return "bad_link";
    }
  }
  return "unavailable";
}

/* ---------- The whole shelf ---------- */

/** Reads every book from your Notion database. Never throws: problems come back as `{ ok: false }`. */
export async function getShelf(): Promise<Shelf> {
  // NOTION_API_KEY works too: that's the name Notion's own examples use.
  const token = (process.env.NOTION_TOKEN || process.env.NOTION_API_KEY)?.trim();
  const link = process.env.NOTION_DATABASE_ID?.trim();

  const missingSettings = [!token && "NOTION_TOKEN", !link && "NOTION_DATABASE_ID"].filter((name): name is string => !!name);
  if (!token || !link) return { ok: false, problem: "not_configured", missingSettings };

  const databaseId = databaseIdFrom(link);
  if (!databaseId) return { ok: false, problem: "bad_link" };

  const notion = new Client({
    auth: token,
    notionVersion: NOTION_VERSION,
    timeoutMs: 20_000,
    // Only real errors in the terminal. (Otherwise the SDK warns every time the
    // database-or-data-source check in findTable() takes its second route.)
    logLevel: LogLevel.ERROR,
  });

  try {
    const { dataSourceId, name } = await findTable(notion, databaseId);

    // Step 2: every row, newest first. Notion sends at most 100 rows per
    // request; collectPaginatedAPI keeps asking for the next batch until it
    // has them all.
    const rows = await collectPaginatedAPI(notion.dataSources.query, {
      data_source_id: dataSourceId,
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });
    // A query can also return partial rows (or sub-tables, in wikis). Keep only full pages.
    const pages = rows.filter(isFullPage);

    // Which of your property names did we not find? (All rows share the same properties.)
    const first = pages[0]?.properties ?? {};
    const missing = pages.length ? Object.values(PROPERTY_NAMES).filter((name) => !named(first, name)) : [];

    return { ok: true, name, books: pages.map(toBook), missing, available: Object.keys(first) };
  } catch (error) {
    // The real error goes to the terminal running `npm run dev`, to help with debugging.
    // (Notion's error messages never contain the token.)
    console.error("[my-bookshelf] Couldn't read the Notion database:", isNotionClientError(error) ? `${error.code}: ${error.message}` : error);
    return { ok: false, problem: problemFrom(error) };
  }
}
