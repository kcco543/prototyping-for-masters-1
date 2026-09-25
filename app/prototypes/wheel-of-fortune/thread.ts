/**
 * Turns an answer sentence into ONE continuous piece of yarn.
 *
 * 1. Lay the sentence out in single-stroke cursive (see glyphs.ts), wrapping
 *    it onto a few centred lines.
 * 2. Walk through every pen stroke of every letter, in reading order.
 * 3. Join everything into a single thread:
 *    - a "lead" curve from the yarn ball (at the cat's paw) to the first letter,
 *    - the letter strokes themselves,
 *    - "slack" curves wherever the pen would normally lift (between words,
 *      to dot an i, to cross a t). These sag a little, like loose yarn.
 *
 * The result is a list of segments, each a polyline with its length, so the
 * page can "unravel" the yarn by revealing it a little more every frame and
 * roll the ball along the tip.
 */

import { GLYPHS } from "./glyphs";

export type Pt = [number, number];

export type Segment = {
  kind: "lead" | "letter" | "slack";
  pts: Pt[];
  /** cumulative length at each point, starting from 0 */
  acc: number[];
  len: number;
  /** distance along the whole thread where this segment starts */
  start: number;
  d: string;
};

export type Thread = { segments: Segment[]; total: number; lines: string[] };

/* ---------- helpers ---------- */

/** Small repeatable random numbers, so each answer's wobble is stable. */
function seeded(seedText: string) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** A glyph's path "M x y L x y … M …" → list of strokes (lists of points). */
function glyphStrokes(ch: string): Pt[][] {
  const g = GLYPHS[ch] ?? GLYPHS["?"];
  return g[1]
    .split("M")
    .map((part) => part.replace(/L/g, " ").trim())
    .filter(Boolean)
    .map((part) => {
      const n = part.split(/\s+/).map(Number);
      const pts: Pt[] = [];
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      return pts;
    });
}

const advance = (ch: string) => (GLYPHS[ch] ?? GLYPHS["?"])[0];
const textWidth = (t: string) => [...t].reduce((w, ch) => w + advance(ch), 0);

/** Greedy word wrap, in font units. */
function wrap(text: string, maxUnits: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && textWidth(test) > maxUnits) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Sample a quadratic Bézier curve into points (excluding the first point). */
function quad(a: Pt, c: Pt, b: Pt, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** Sample a cubic Bézier curve into points (excluding the first point). */
function cubic(a: Pt, c1: Pt, c2: Pt, b: Pt, steps: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
      u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
    ]);
  }
  return out;
}

function makeSegment(kind: Segment["kind"], pts: Pt[], start: number): Segment {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
  const d = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");
  return { kind, pts, acc, len: acc[acc.length - 1], start, d };
}

/* ---------- main ---------- */

export type Layout = {
  /** Stage width */
  width: number;
  /** y of the first line's baseline */
  top: number;
  /** widest a line may be, in stage units */
  maxWidth: number;
  /** most lines allowed */
  maxLines: number;
  /** biggest letter scale (stage units per font unit) */
  maxScale: number;
};

export function buildThread(text: string, from: Pt, layout: Layout): Thread {
  const rand = seeded(text);

  // Find the largest scale at which the sentence fits in the allowed lines
  let s = layout.maxScale;
  let lines = wrap(text, layout.maxWidth / s);
  // (also avoid ending on a lonely little word like "it.")
  const orphan = (ls: string[]) => ls.length > 1 && !ls[ls.length - 1].includes(" ") && ls[ls.length - 1].length <= 3;
  while (lines.length > layout.maxLines || lines.some((l) => textWidth(l) * s > layout.maxWidth) || (orphan(lines) && s > layout.maxScale * 0.6)) {
    s *= 0.94;
    lines = wrap(text, layout.maxWidth / s);
  }
  // Balance the lines: find the narrowest width that still needs the same
  // number of lines, so we get "Absolutely. / Go for it." rather than an
  // orphan like "Absolutely. Go for / it."
  if (lines.length > 1) {
    let lo = Math.max(...text.split(" ").map(textWidth));
    let hi = layout.maxWidth / s;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (wrap(text, mid).length <= lines.length) hi = mid;
      else lo = mid;
    }
    lines = wrap(text, hi);
  }
  const lineHeight = 1000 * s * 1.3;

  // Every pen stroke of every letter, converted to stage coordinates
  const strokes: Pt[][] = [];
  lines.forEach((line, li) => {
    const baseline = layout.top + li * lineHeight;
    let penX = layout.width / 2 - (textWidth(line) * s) / 2;
    for (const ch of line) {
      for (const stroke of glyphStrokes(ch)) {
        // font y points up; the screen's y points down → flip it.
        // A tiny random wobble makes it feel hand-laid rather than printed.
        strokes.push(stroke.map(([x, y]) => [penX + x * s + (rand() - 0.5) * 0.8, baseline - y * s + (rand() - 0.5) * 0.8]));
      }
      penX += advance(ch) * s;
    }
  });

  const segments: Segment[] = [];
  let total = 0;
  const push = (kind: Segment["kind"], pts: Pt[]) => {
    const seg = makeSegment(kind, pts, total);
    segments.push(seg);
    total += seg.len;
  };

  // Lead: the ball rolls out from the paw, swings down and around BELOW the
  // cat (never across it), and arrives at the first letter
  const first = strokes[0][0];
  push("lead", [
    from,
    ...cubic(from, [from[0] + 150, from[1] + 150], [first[0] - 30, first[1] - 110], first, 80),
  ]);

  let current: Pt[] = [strokes[0][0]];
  for (let i = 0; i < strokes.length; i++) {
    const stroke = strokes[i];
    const last = current[current.length - 1];
    const gap = dist(last, stroke[0]);
    if (gap < 4) {
      // letters that (almost) touch: keep going in one line
      current.push(...stroke.slice(gap < 0.5 ? 1 : 0));
    } else {
      // pen lift → finish this letter run, add a slack loop of yarn
      if (current.length > 1) push("letter", current);
      const mid: Pt = [(last[0] + stroke[0][0]) / 2, (last[1] + stroke[0][1]) / 2];
      const sag = Math.min(70, 10 + gap * 0.22);
      const steps = Math.max(6, Math.round(gap / 6));
      push("slack", [last, ...quad(last, [mid[0], mid[1] + sag], stroke[0], steps)]);
      current = [...stroke];
    }
  }
  if (current.length > 1) push("letter", current);

  return { segments, total, lines };
}

/** Where along the thread is distance `d`? Returns the point and the segment index. */
export function pointAt(thread: Thread, d: number): { pt: Pt; seg: number } {
  const { segments } = thread;
  const target = Math.max(0, Math.min(d, thread.total));
  // binary search for the segment
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (segments[mid].start <= target) lo = mid;
    else hi = mid - 1;
  }
  const seg = segments[lo];
  const local = target - seg.start;
  // binary search inside the segment
  let a = 0;
  let b = seg.acc.length - 1;
  while (a < b - 1) {
    const m = (a + b) >> 1;
    if (seg.acc[m] <= local) a = m;
    else b = m;
  }
  const span = seg.acc[b] - seg.acc[a] || 1;
  const t = Math.min(1, Math.max(0, (local - seg.acc[a]) / span));
  const p = seg.pts[a];
  const q = seg.pts[b];
  return { pt: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], seg: lo };
}
