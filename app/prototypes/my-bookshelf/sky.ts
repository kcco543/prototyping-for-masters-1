/**
 * A Constellation of Stories — the star chart, worked out from your books.
 *
 * This file is pure arithmetic: no React, no browser, no Notion. It takes the
 * books that notion.ts read from your database and answers two questions.
 *
 *   catalogue()  Which constellation does each book belong to? (One per
 *                Genre.) What is its Greek letter (α for the highest-rated
 *                book in its constellation, β for the next…)? What is each
 *                constellation called, and what colour is it?
 *
 *   chart()      Where does every star sit on the map? Which lines join them?
 *                Where is the dotted region around each constellation?
 *
 * HOW THE NOTION FIELDS ARE USED
 *   Title   → the star's label
 *   Genre   → its constellation (a new genre in Notion = a new constellation)
 *   Author  → extra dotted arcs between books by the same author
 *   Rating  → how brightly the star glows, and its Greek letter
 *   Cover   → the little book floating at the star (drawn in SkyMap.tsx)
 *
 * STABLE POSITIONS
 * Nothing here uses Math.random(). Every "random" choice comes from a number
 * worked out from the book's Notion id (a hash), so a book always lands in
 * the same place, on every refresh and on every computer. Books are placed
 * oldest first, so a new book in Notion becomes a new star at the end of its
 * constellation, and the stars already there stay where they are.
 */

import { RATING_OUT_OF, type Book, type NotionColor } from "./books";

/* ---------- Types ---------- */

export type Point = { x: number; y: number };
export type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** A constellation's poetic name: "Telescopium", "Telescopii" (as in "α Telescopii"), "the Far-Seeing Glass" */
export type Lore = { latin: string; genitive: string; epithet: string };

/** One book, as a star in the catalogue. */
export type Entry = {
  book: Book;
  /** Which constellation: the Genre's name, or "" for books without a genre. */
  key: string;
  /** Its letter in the constellation, brightest first: α, β, γ… (after ω: 25, 26…) */
  letter: string;
  /** The letter and the constellation's Latin name together, like a real star: "α Telescopii" */
  designation: string;
  /** 1 = brightest in its constellation, 2 = second… */
  rank: number;
  /** 0 to 1, from the rating. Unrated books get a middling glow. */
  brightness: number;
};

export type ConstellationInfo = {
  key: string;
  /** The genre as shown on the page: "Science Fiction" */
  genre: string;
  /** I, II, III…, in the order the genres first appeared in your database */
  numeral: string;
  lore: Lore;
  /** The constellation's accent colour (from the genre's colour in Notion) */
  accent: string;
  /** Its books, brightest first */
  entries: Entry[];
  meanRating: number | null;
};

export type Catalogue = {
  constellations: ConstellationInfo[];
  /** Every star, by book id */
  entries: Map<string, Entry>;
  byKey: Map<string, ConstellationInfo>;
};

/** A star with its place on the map. */
export type Placed = Entry & Point;

export type Figure = {
  info: ConstellationInfo;
  /** Its stars, brightest first (also the keyboard Tab order) */
  stars: Placed[];
  /** The dotted region around it, as an SVG path */
  region: string;
  /** Where the name goes: the bottom-centre of the label, just above the region */
  label: Point;
  /** Everything that belongs to it (stars, region and name), for zooming to it */
  box: Box;
};

export type Link = {
  id: string;
  from: Placed;
  to: Placed;
  /** "figure": the constellation's lines. "author": a dotted arc between books by the same author. */
  kind: "figure" | "author";
  /** The constellation (for "figure" lines) */
  key: string;
  /** SVG path */
  path: string;
};

export type Chart = {
  figures: Figure[];
  stars: Map<string, Placed>;
  links: Link[];
  /** Everything on the map */
  box: Box;
  /** Radius of the faint coordinate circles drawn behind everything */
  radius: number;
};

/** Wide screens spread constellations sideways; tall phone screens stack them. */
export type Orientation = "landscape" | "portrait";

/* ---------- Small helpers ---------- */

/** Turns text into a whole number (FNV-1a hash). The same text always gives the same number. */
export function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

/** A predictable "random" number generator (mulberry32): the same seed always gives the same numbers, from 0 to 1. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 3 → "III" */
export function roman(value: number): string {
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = value;
  let out = "";
  for (const [amount, letters] of table) {
    while (rest >= amount) {
      out += letters;
      rest -= amount;
    }
  }
  return out;
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to"]);

/** "science fiction" → "Science Fiction" (Notion keeps genres exactly as you typed them) */
export function titleCase(text: string): string {
  return text
    .split(/(\s+|-)/)
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

/** Lower case, no accents: "Gabriel García Márquez" → "gabriel garcia marquez". For searching and matching authors. */
export function plainText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const added = (book: Book) => Date.parse(book.addedAt) || 0;

/* ---------- Names and colours ---------- */

/*
  Each genre is matched to a real (or historical) constellation whose name
  suits it: mysteries go to the Lynx (named because you need a lynx's eyes
  to see it), horror to the Raven, memoirs to the Swan… The first pattern
  that matches wins, so the more specific ones come first ("non-fiction"
  before "fiction"). Add your own lines to rename a constellation.
*/
const LORE: (Lore & { match: RegExp })[] = [
  { match: /non[\s-]?fiction/, latin: "Circinus", genitive: "Circini", epithet: "the Compass" },
  { match: /sci(ence)?[\s-]?fi|speculative/, latin: "Telescopium", genitive: "Telescopii", epithet: "the Far-Seeing Glass" },
  { match: /fantas|fairy|myth|magic/, latin: "Draco", genitive: "Draconis", epithet: "the Dragon" },
  { match: /memoir|autobiog|diar/, latin: "Cygnus", genitive: "Cygni", epithet: "the Swan" },
  { match: /biog/, latin: "Perseus", genitive: "Persei", epithet: "the Hero" },
  { match: /myster|crime|detect|noir/, latin: "Lynx", genitive: "Lyncis", epithet: "the Keen-Eyed Lynx" },
  { match: /thrill|suspense|spy/, latin: "Sagitta", genitive: "Sagittae", epithet: "the Arrow" },
  { match: /horror|gothic|ghost/, latin: "Corvus", genitive: "Corvi", epithet: "the Raven" },
  { match: /romanc|love/, latin: "Corona Borealis", genitive: "Coronae Borealis", epithet: "Ariadne’s Crown" },
  { match: /poe(m|t)|verse/, latin: "Lyra", genitive: "Lyrae", epithet: "the Lyre" },
  { match: /drama|plays|theat/, latin: "Gemini", genitive: "Geminorum", epithet: "the Twins" },
  { match: /classic/, latin: "Aquila", genitive: "Aquilae", epithet: "the Eagle" },
  { match: /histor/, latin: "Horologium", genitive: "Horologii", epithet: "the Clock" },
  { match: /philos/, latin: "Noctua", genitive: "Noctuae", epithet: "the Owl" },
  { match: /young adult|\bya\b|teen|coming[\s-]of[\s-]age/, latin: "Monoceros", genitive: "Monocerotis", epithet: "the Unicorn" },
  { match: /child|kid|picture/, latin: "Lepus", genitive: "Leporis", epithet: "the Hare" },
  { match: /graphic|comic|manga|\bart\b|design|photo/, latin: "Pictor", genitive: "Pictoris", epithet: "the Painter’s Easel" },
  { match: /travel|adventure|explor/, latin: "Argo Navis", genitive: "Argus Navis", epithet: "the Ship Argo" },
  { match: /dystop|\bwar\b|military/, latin: "Lupus", genitive: "Lupi", epithet: "the Wolf" },
  { match: /self|help|wellness|psych/, latin: "Columba", genitive: "Columbae", epithet: "the Dove" },
  { match: /science|nature|math|physics|biolog/, latin: "Microscopium", genitive: "Microscopii", epithet: "the Microscope" },
  { match: /food|cook|essay/, latin: "Crater", genitive: "Crateris", epithet: "the Cup" },
  { match: /literar|literature/, latin: "Cassiopeia", genitive: "Cassiopeiae", epithet: "the Seated Queen" },
  { match: /fiction|novel|stor/, latin: "Pegasus", genitive: "Pegasi", epithet: "the Winged Horse" },
];

/** For genres that match nothing above (or whose constellation is taken): picked by the genre's hash. */
const SPARE_LORE: Lore[] = [
  { latin: "Vela", genitive: "Velorum", epithet: "the Sails" },
  { latin: "Delphinus", genitive: "Delphini", epithet: "the Dolphin" },
  { latin: "Phoenix", genitive: "Phoenicis", epithet: "the Firebird" },
  { latin: "Pyxis", genitive: "Pyxidis", epithet: "the Mariner’s Compass" },
  { latin: "Grus", genitive: "Gruis", epithet: "the Crane" },
  { latin: "Carina", genitive: "Carinae", epithet: "the Keel" },
  { latin: "Ara", genitive: "Arae", epithet: "the Altar" },
  { latin: "Fornax", genitive: "Fornacis", epithet: "the Furnace" },
  { latin: "Volans", genitive: "Volantis", epithet: "the Flying Fish" },
  { latin: "Sextans", genitive: "Sextantis", epithet: "the Sextant" },
  { latin: "Norma", genitive: "Normae", epithet: "the Carpenter’s Square" },
  { latin: "Reticulum", genitive: "Reticuli", epithet: "the Net" },
  { latin: "Caelum", genitive: "Caeli", epithet: "the Chisel" },
  { latin: "Tucana", genitive: "Tucanae", epithet: "the Toucan" },
  { latin: "Camelopardalis", genitive: "Camelopardalis", epithet: "the Giraffe" },
  { latin: "Musca", genitive: "Muscae", epithet: "the Fly" },
];

/** Books with no Genre in Notion gather here. */
const UNCHARTED: Lore = { latin: "Nebula Incognita", genitive: "Nebulae Incognitae", epithet: "the Uncharted Mist" };

/**
 * Accent colours, one for each of Notion's ten tag colours, muted so they
 * sit quietly on the night sky. A genre you coloured purple in Notion
 * becomes a lavender constellation here.
 */
export const ACCENTS: Record<NotionColor, string> = {
  default: "#c6a76b", // antique gold
  gray: "#aeb1c2", // silver
  brown: "#bc8f70", // old copper
  orange: "#d39c69", // amber
  yellow: "#d8c47f", // pale gold
  green: "#8db6a3", // sea glass
  blue: "#8eabd2", // steel blue
  purple: "#a597cc", // lavender
  pink: "#d09db2", // dusty rose
  red: "#c9857e", // rosewood
};

/** If two genres share a Notion colour, the second takes the next free colour from this list. */
const ACCENT_ORDER: NotionColor[] = ["default", "purple", "blue", "green", "pink", "orange", "yellow", "red", "brown", "gray"];

const GREEK = "αβγδεζηθικλμνξοπρστυφχψω";

/* ---------- The catalogue: constellations, letters, colours ---------- */

/** Groups the books into constellations (one per genre) and names their stars. */
export function catalogue(books: Book[]): Catalogue {
  // 1. Group the books by genre
  const groups = new Map<string, { color: NotionColor | null; books: Book[] }>();
  for (const book of books) {
    const key = book.genre?.name.trim() ?? "";
    const group = groups.get(key) ?? { color: book.genre?.color ?? null, books: [] };
    group.books.push(book);
    groups.set(key, group);
  }

  // 2. Order the genres by when their first book was added, so a new genre
  //    joins the end and the existing constellations keep their numbers.
  //    Books without a genre always come last.
  const firstAdded = (list: Book[]) => Math.min(...list.map(added));
  const ordered = [...groups.entries()].sort(([keyA, a], [keyB, b]) => {
    if (!keyA !== !keyB) return keyA ? -1 : 1;
    return firstAdded(a.books) - firstAdded(b.books) || keyA.localeCompare(keyB);
  });

  // 3. Name, colour and letter each one
  const usedNames = new Set<string>();
  const usedColors = new Set<string>();
  const constellations: ConstellationInfo[] = ordered.map(([key, group], index) => {
    const numeral = roman(index + 1);
    const lore = key ? loreFor(key, usedNames, numeral) : UNCHARTED;
    usedNames.add(lore.latin);

    const accent = accentFor(group.color, usedColors);
    usedColors.add(accent);

    // Brightest first: highest rating, then the earliest added
    const sorted = [...group.books].sort(
      (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || added(a) - added(b) || a.title.localeCompare(b.title),
    );
    const entries: Entry[] = sorted.map((book, rank) => {
      const letter = GREEK[rank] ?? String(rank + 1);
      return {
        book,
        key,
        letter,
        designation: `${letter} ${lore.genitive}`,
        rank: rank + 1,
        brightness: book.rating === null ? 0.55 : clamp(book.rating / RATING_OUT_OF, 0, 1),
      };
    });

    const ratings = group.books.flatMap((book) => (book.rating === null ? [] : [book.rating]));
    return {
      key,
      genre: key ? titleCase(key) : "Uncatalogued",
      numeral,
      lore,
      accent,
      entries,
      meanRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    };
  });

  return {
    constellations,
    entries: new Map(constellations.flatMap((info) => info.entries.map((entry) => [entry.book.id, entry] as const))),
    byKey: new Map(constellations.map((info) => [info.key, info])),
  };
}

function loreFor(genre: string, used: Set<string>, numeral: string): Lore {
  const text = plainText(genre);
  const match = LORE.find((lore) => lore.match.test(text) && !used.has(lore.latin));
  if (match) return { latin: match.latin, genitive: match.genitive, epithet: match.epithet };
  const spare = SPARE_LORE.filter((lore) => !used.has(lore.latin));
  if (spare.length) return spare[hash(text) % spare.length];
  return { latin: `Asterism ${numeral}`, genitive: `Asterismi ${numeral}`, epithet: "a nameless asterism" };
}

function accentFor(color: NotionColor | null, used: Set<string>): string {
  const preferred = ACCENTS[color ?? "default"] ?? ACCENTS.default;
  if (!used.has(preferred)) return preferred;
  return ACCENT_ORDER.map((name) => ACCENTS[name]).find((accent) => !used.has(accent)) ?? preferred;
}

/* ---------- The chart: where everything goes ---------- */

/** The size of a book cover on the map, in map units (at 100% zoom, pixels). */
export const COVER = { width: 54, height: 81 };

const STEP = 150; // usual distance between two joined stars
const MIN_GAP = 136; // no two stars closer than this
const CLEARANCE = 58; // a line must pass at least this far from other stars
const REGION = 84; // how far the dotted region reaches around each star
const GAP = 34; // empty sky between constellations
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈ 137.5°, spreads things evenly (as in a sunflower)

/** Where each part of a constellation's name sits, measured up from its label point. */
export const LABEL_LINES = { kicker: -48, name: -19, epithet: 0 };
const LABEL_HEIGHT = 62;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const crossProduct = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function distanceToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1) : 0;
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Do two line segments cross? (Touching at an end doesn't count.) */
function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  return crossProduct(c, d, a) * crossProduct(c, d, b) < 0 && crossProduct(a, b, c) * crossProduct(a, b, d) < 0;
}

function boxOf(points: Point[], pad = 0): Box {
  return {
    minX: Math.min(...points.map((p) => p.x)) - pad,
    minY: Math.min(...points.map((p) => p.y)) - pad,
    maxX: Math.max(...points.map((p) => p.x)) + pad,
    maxY: Math.max(...points.map((p) => p.y)) + pad,
  };
}

function joinBoxes(boxes: Box[]): Box {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

/** A rough width for a constellation's name, so neighbours leave room for it. */
function labelWidth(info: ConstellationInfo) {
  return Math.max(info.genre.length * 15, (info.numeral.length + info.lore.latin.length) * 11 + 40, info.lore.epithet.length * 8 + 70);
}

/**
 * Draws one constellation's figure, like joining the dots.
 *
 * The oldest book is the first star. Each newer book attaches to an
 * earlier star (usually the previous one, sometimes an older one, which
 * makes branches) a step away, turning a little each time, so the figure
 * winds like a real constellation. If the spot is taken, or the new line
 * would cross another line, it tries the next angle round.
 */
function drawFigure(info: ConstellationInfo) {
  const books = [...info.entries].sort((a, b) => added(a.book) - added(b.book) || a.book.id.localeCompare(b.book.id));
  const points: Point[] = [];
  const headings: number[] = [];
  const degree: number[] = [];
  const links: [number, number][] = [];
  const start = seeded(hash(info.key || "uncharted"))() * Math.PI * 2;

  books.forEach((entry, index) => {
    if (index === 0) {
      points.push({ x: 0, y: 0 });
      headings.push(start);
      degree.push(0);
      return;
    }
    const random = seeded(hash(entry.book.id));
    let parent = index - 1;
    if (index >= 2 && random() < 0.34) parent = Math.floor(random() * (index - 1));
    if (degree[parent] >= 3) parent = index - 1;
    const turn = (0.3 + random() * 0.8) * (random() < 0.5 ? -1 : 1);
    const heading = index === 1 ? start : headings[parent] + turn;
    const length = STEP * (0.94 + random() * 0.24);

    const spot = findSpot(points, links, parent, heading, length);
    points.push(spot.point);
    headings.push(spot.heading);
    degree.push(1);
    degree[parent]++;
    links.push([parent, index]);
  });

  return { books, points, links };
}

const TURNS = [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.45, -1.45, 1.9, -1.9, 2.5, -2.5, Math.PI];

function findSpot(points: Point[], links: [number, number][], parent: number, heading: number, length: number) {
  const from = points[parent];
  for (const stretch of [1, 1.2, 1.45, 1.75, 2.1, 2.6]) {
    for (const turn of TURNS) {
      const angle = heading + turn;
      const point = { x: from.x + Math.cos(angle) * length * stretch, y: from.y + Math.sin(angle) * length * stretch };
      const roomy = points.every((other, index) => {
        if (distance(point, other) < MIN_GAP) return false;
        return index === parent || distanceToSegment(other, from, point) >= CLEARANCE;
      });
      const uncrossed = links.every(([a, b]) => a === parent || b === parent || !segmentsCross(from, point, points[a], points[b]));
      if (roomy && uncrossed) return { point, heading: angle };
    }
  }
  // Very crowded: go straight out, far beyond the others
  const far = length * 3;
  return { point: { x: from.x + Math.cos(heading) * far, y: from.y + Math.sin(heading) * far }, heading };
}

/** The outline around a group of points (the "gift-wrapping" shape), using Andrew's monotone chain. */
function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (sorted.length < 3) return sorted;
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const point of list) {
      while (out.length >= 2 && crossProduct(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

const pair = (p: Point) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

/** A closed, softly rounded SVG path through the points (curving through the middle of each side). */
function smoothPath(points: Point[]): string {
  const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let path = `M${pair(mid(points[points.length - 1], points[0]))}`;
  points.forEach((point, index) => {
    path += `Q${pair(point)} ${pair(mid(point, points[(index + 1) % points.length]))}`;
  });
  return `${path}Z`;
}

/** The dotted region: a soft outline around a circle drawn round every star (a little lower, to include the title). */
function regionAround(points: Point[]) {
  const ring: Point[] = [];
  for (const point of points) {
    for (let step = 0; step < 24; step++) {
      const angle = (step / 24) * Math.PI * 2;
      ring.push({ x: point.x + Math.cos(angle) * REGION, y: point.y + 10 + Math.sin(angle) * REGION });
    }
  }
  return { path: smoothPath(convexHull(ring)), box: boxOf(ring) };
}

/**
 * Turns a figure so its longest direction runs roughly sideways, with a
 * small tilt of its own so the constellations don't all line up like
 * rulers. Sideways suits both screens: wide screens obviously, and on a
 * phone the map's free space (between the title and the strip of covers)
 * is nearly square, so sideways figures stacked a few deep fit best.
 * The longest direction is found from how the points spread out (the
 * "principal axis", from their covariance).
 */
function alignFigure(points: Point[], seed: number): Point[] {
  if (points.length < 2) return points;
  const mean = { x: points.reduce((sum, p) => sum + p.x, 0) / points.length, y: points.reduce((sum, p) => sum + p.y, 0) / points.length };
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const p of points) {
    xx += (p.x - mean.x) ** 2;
    yy += (p.y - mean.y) ** 2;
    xy += (p.x - mean.x) * (p.y - mean.y);
  }
  const longest = 0.5 * Math.atan2(2 * xy, xx - yy);
  const tilt = ((seed % 1000) / 1000 - 0.5) * 0.6; // up to ±17°
  const turn = tilt - longest;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return points.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}

/**
 * Lays out the whole sky.
 *
 * Each constellation is drawn on its own first, then they're placed one by
 * one along a spiral (turning by the golden angle each time, so they spread
 * evenly round the middle), each in the first spot that doesn't touch the
 * ones already placed. On a wide screen the spiral is stretched sideways; on
 * a phone, a little up and down.
 */
export function chart(catalogueData: Catalogue, orientation: Orientation): Chart {
  const stretch = orientation === "portrait" ? { x: 0.9, y: 1.1 } : { x: 1.32, y: 0.76 };

  // 1. Draw each figure, turn it to suit the screen, and centre it on its own middle
  const drafts = catalogueData.constellations.map((info) => {
    const figure = drawFigure(info);
    const turned = alignFigure(figure.points, hash(info.key || "uncharted"));
    const box = boxOf(turned);
    const middle = { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 };
    const points = turned.map((p) => ({ x: p.x - middle.x, y: p.y - middle.y }));
    const labelTop = Math.min(...points.map((p) => p.y)) + 10 - REGION - 14 - LABEL_HEIGHT;
    const radius = Math.max(
      ...points.map((p) => Math.hypot(p.x, p.y + 10) + REGION + 6),
      Math.hypot(labelWidth(info) / 2, labelTop),
    );
    return { info, ...figure, points, radius };
  });

  // 2. Place the figures along a spiral, each where it fits
  const centres: Point[] = [];
  drafts.forEach((figure, index) => {
    if (index === 0) {
      centres.push({ x: 0, y: 0 });
      return;
    }
    const firstAngle = index * GOLDEN_ANGLE + 0.9;
    for (let step = 0; ; step++) {
      const angle = firstAngle + step * 0.11;
      const reach = step * 4;
      const spot = { x: Math.cos(angle) * reach * stretch.x, y: Math.sin(angle) * reach * stretch.y };
      const free = centres.every((centre, other) => distance(spot, centre) >= drafts[other].radius + figure.radius + GAP);
      if (free || step > 5000) {
        centres.push(spot);
        return;
      }
    }
  });

  // 3. Centre the whole sky on (0, 0): measure it once, then shift every centre
  const layOut = (shift: Point) => figuresAt(drafts, centres.map((c) => ({ x: c.x + shift.x, y: c.y + shift.y })));
  const trial = layOut({ x: 0, y: 0 });
  const whole = joinBoxes(trial.figures.map((figure) => figure.box));
  const { figures, stars } = layOut({ x: -(whole.minX + whole.maxX) / 2, y: -(whole.minY + whole.maxY) / 2 });

  // 4. The lines: each figure's own joins, then dotted arcs between books by the same author
  const links: Link[] = [];
  const joined = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`);
  drafts.forEach((figure) => {
    for (const [a, b] of figure.links) {
      const from = stars.get(figure.books[a].book.id)!;
      const to = stars.get(figure.books[b].book.id)!;
      const id = pairKey(from.book.id, to.book.id);
      joined.add(id);
      links.push({ id, from, to, kind: "figure", key: figure.info.key, path: `M${pair(from)}L${pair(to)}` });
    }
  });

  const byAuthor = new Map<string, Placed[]>();
  for (const star of stars.values()) {
    const author = plainText(star.book.author).replace(/[^a-z]/g, "");
    if (!author) continue;
    byAuthor.set(author, [...(byAuthor.get(author) ?? []), star]);
  }
  for (const group of byAuthor.values()) {
    // Join them in the order they were added, one after another (never all to all)
    group.sort((a, b) => added(a.book) - added(b.book));
    for (let index = 1; index < group.length; index++) {
      const from = group[index - 1];
      const to = group[index];
      const id = pairKey(from.book.id, to.book.id);
      if (joined.has(id)) continue;
      // A gentle arc, so it can't be mistaken for a constellation line
      const length = Math.max(1, distance(from, to));
      const bend = (hash(id) % 2 ? 1 : -1) * Math.min(160, length * 0.22);
      const control = {
        x: (from.x + to.x) / 2 + (-(to.y - from.y) / length) * bend,
        y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * bend,
      };
      links.push({ id: `author:${id}`, from, to, kind: "author", key: "", path: `M${pair(from)}Q${pair(control)} ${pair(to)}` });
    }
  }

  const box = joinBoxes(figures.map((figure) => figure.box));
  const radius = Math.max(520, Math.hypot(box.maxX - box.minX, box.maxY - box.minY) / 2 + 150);
  return { figures, stars, links, box, radius };
}

type Draft = ReturnType<typeof drawFigure> & { info: ConstellationInfo; radius: number };

/** Puts each drawn figure at its centre: the stars' final positions, the dotted regions and the names. */
function figuresAt(drafts: Draft[], centres: Point[]) {
  const stars = new Map<string, Placed>();
  const figures: Figure[] = drafts.map((draft, index) => {
    const centre = centres[index];
    const absolute = draft.points.map((p) => ({ x: p.x + centre.x, y: p.y + centre.y }));
    draft.books.forEach((entry, order) => stars.set(entry.book.id, { ...entry, ...absolute[order] }));

    const region = regionAround(absolute);
    const middleX = (Math.min(...absolute.map((p) => p.x)) + Math.max(...absolute.map((p) => p.x))) / 2;
    const label = { x: middleX, y: region.box.minY - 14 };
    const width = labelWidth(draft.info);
    const labelBox = { minX: label.x - width / 2, maxX: label.x + width / 2, minY: label.y - LABEL_HEIGHT, maxY: label.y };
    return {
      info: draft.info,
      stars: draft.info.entries.map((entry) => stars.get(entry.book.id)!),
      region: region.path,
      label,
      box: joinBoxes([region.box, labelBox]),
    };
  });
  return { figures, stars };
}
