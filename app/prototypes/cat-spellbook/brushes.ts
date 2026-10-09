/**
 * The five brushes.
 *
 * Every stroke is saved as plain data (see `Stroke`), and `drawStroke` can
 * repaint any stroke from that data at any canvas size. That is what makes
 * undo / redo / clear / resize simple: change the list, repaint.
 *
 * Positions are stored "normalised" (0–1 across the page) so a drawing
 * keeps its shape when the window is resized. Sizes are multiplied by
 * `unit` (page width ÷ 1000) for the same reason.
 */

import type p5 from "p5";

export type BrushId = "quill" | "paw" | "yarn" | "stardust" | "tail";

/** A point on a line brush. `w` is a width factor (≈0.4–1.6) used by the quill. */
export type Pt = { x: number; y: number; w: number };

/** A stamped shape: paw prints and stars. r = size factor, a = angle, k = variant. */
export type Mark = { x: number; y: number; r: number; a: number; k: number };

export type Stroke = {
  brush: BrushId;
  color: string;
  /** brush size in "design pixels" (the page is 1000 design pixels wide) */
  size: number;
  pts: Pt[];
  marks: Mark[];
};

export const BRUSHES: { id: BrushId; name: string; hint: string }[] = [
  { id: "quill", name: "Magic Quill", hint: "Smooth ink that thins as you speed up" },
  { id: "paw", name: "Paw Stamp", hint: "A trail of little paw prints" },
  { id: "yarn", name: "Yarn Brush", hint: "A soft, lazy thread of yarn" },
  { id: "stardust", name: "Stardust", hint: "Small stars and sparkles" },
  { id: "tail", name: "Cat Tail", hint: "A swishy, striped tail" },
];

/** The spellbook palette */
export const INK = {
  midnight: "#1f2a4a",
  parchment: "#f3ead7",
  pink: "#c98a8f",
  sage: "#8fa58a",
  gold: "#b8974f",
  plum: "#6b4a6e",
  sepia: "#5a4636",
};

export const PALETTE: { name: string; value: string }[] = [
  { name: "Midnight blue", value: INK.midnight },
  { name: "Muted pink", value: INK.pink },
  { name: "Sage green", value: INK.sage },
  { name: "Antique gold", value: INK.gold },
  { name: "Plum", value: INK.plum },
  { name: "Sepia", value: INK.sepia },
];

/** p5.Graphics has the same drawing methods as p5, so one type covers both. */
type Surface = p5;

/** Mix a colour towards another (t = 0 → a, 1 → b). */
function mix(p: p5, a: string, b: string, t: number) {
  return p.lerpColor(p.color(a), p.color(b), t);
}

/* ---------- 1. Magic Quill: a smooth line whose width gently varies ---------- */
function drawQuill(g: Surface, s: Stroke, W: number, H: number, unit: number) {
  const base = s.size * unit;
  g.noFill();
  g.stroke(s.color);
  g.strokeCap(g.ROUND);
  if (s.pts.length === 1) {
    g.strokeWeight(base);
    g.point(s.pts[0].x * W, s.pts[0].y * H);
    return;
  }
  for (let i = 1; i < s.pts.length; i++) {
    const a = s.pts[i - 1];
    const b = s.pts[i];
    g.strokeWeight(Math.max(0.6, base * (a.w + b.w) * 0.5));
    g.line(a.x * W, a.y * H, b.x * W, b.y * H);
  }
}

/* ---------- 2. Paw Stamp ---------- */
function drawPaws(g: Surface, s: Stroke, W: number, H: number, unit: number) {
  g.noStroke();
  g.fill(s.color);
  for (const m of s.marks) {
    const k = (s.size * unit * m.r) / 9;
    g.push();
    g.translate(m.x * W, m.y * H);
    g.rotate(m.a + Math.PI / 2);
    g.scale(k);
    g.ellipse(0, 3.5, 12, 10); // main pad
    g.ellipse(-7.5, -4.5, 4.6, 5.8); // four toe beans
    g.ellipse(-2.7, -8.8, 4.6, 5.8);
    g.ellipse(2.7, -8.8, 4.6, 5.8);
    g.ellipse(7.5, -4.5, 4.6, 5.8);
    g.pop();
  }
}

/* ---------- 3. Yarn Brush: a soft continuous thread with a twisted texture ---------- */
function drawYarn(p: p5, g: Surface, s: Stroke, W: number, H: number, unit: number) {
  const pts = s.pts;
  if (!pts.length) return;
  const wgt = Math.max(1.2, s.size * unit * 0.8);
  g.noFill();
  g.strokeCap(g.ROUND);
  g.strokeJoin(g.ROUND);
  g.stroke(s.color);
  g.strokeWeight(wgt);
  g.beginShape();
  g.curveVertex(pts[0].x * W, pts[0].y * H);
  for (const q of pts) g.curveVertex(q.x * W, q.y * H);
  g.curveVertex(pts[pts.length - 1].x * W, pts[pts.length - 1].y * H);
  g.endShape();

  // little slanted ticks across the thread make it read as twisted wool
  g.stroke(mix(p, s.color, INK.parchment, 0.5));
  g.strokeWeight(Math.max(0.7, wgt * 0.2));
  for (let i = 1; i < pts.length - 1; i += 2) {
    const dx = (pts[i + 1].x - pts[i - 1].x) * W;
    const dy = (pts[i + 1].y - pts[i - 1].y) * H;
    const ang = Math.atan2(dy, dx) + 1.0;
    const len = wgt * 0.36;
    const x = pts[i].x * W;
    const y = pts[i].y * H;
    g.line(x - Math.cos(ang) * len, y - Math.sin(ang) * len, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  }
}

/* ---------- 4. Stardust: four-pointed stars and tiny dots ---------- */
export function starShape(g: Surface, x: number, y: number, r: number, rot: number) {
  g.push();
  g.translate(x, y);
  g.rotate(rot);
  g.beginShape();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.3;
    const a = (i * Math.PI) / 4;
    g.vertex(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  g.endShape(g.CLOSE);
  g.pop();
}

function drawStardust(p: p5, g: Surface, s: Stroke, W: number, H: number, unit: number) {
  g.noStroke();
  const soft = mix(p, s.color, INK.parchment, 0.35);
  for (const m of s.marks) {
    const r = s.size * unit * m.r;
    if (m.k === 2) g.fill(soft);
    else g.fill(s.color);
    if (m.k === 1) g.ellipse(m.x * W, m.y * H, r * 0.55, r * 0.55);
    else starShape(g, m.x * W, m.y * H, r, m.a);
  }
}

/* ---------- 5. Cat Tail: thick at the base, thin at the tip, with stripes ---------- */
function drawTail(p: p5, g: Surface, s: Stroke, W: number, H: number, unit: number) {
  const pts = s.pts;
  const n = pts.length;
  if (!n) return;
  const base = s.size * unit * 2.3;
  const stripe = mix(p, s.color, INK.midnight, 0.4);
  const band = Math.max(6, s.size * unit * 2.4); // stripe spacing along the tail
  g.noFill();
  g.strokeCap(g.ROUND);
  let travelled = 0;
  if (n === 1) {
    g.stroke(s.color);
    g.strokeWeight(base);
    g.point(pts[0].x * W, pts[0].y * H);
    return;
  }
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const t = i / (n - 1);
    travelled += Math.hypot((b.x - a.x) * W, (b.y - a.y) * H);
    if (Math.floor(travelled / band) % 3 === 2) g.stroke(stripe);
    else g.stroke(s.color);
    g.strokeWeight(Math.max(1.5, base * (1 - 0.78 * Math.pow(t, 0.85)))); // taper towards the tip
    g.line(a.x * W, a.y * H, b.x * W, b.y * H);
  }
}

/** Paint one stroke onto the canvas (or onto an offscreen layer). */
export function drawStroke(p: p5, target: p5 | p5.Graphics, s: Stroke, W: number, H: number, unit: number) {
  const g = target as unknown as Surface;
  g.push();
  if (s.brush === "quill") drawQuill(g, s, W, H, unit);
  else if (s.brush === "paw") drawPaws(g, s, W, H, unit);
  else if (s.brush === "yarn") drawYarn(p, g, s, W, H, unit);
  else if (s.brush === "stardust") drawStardust(p, g, s, W, H, unit);
  else drawTail(p, g, s, W, H, unit);
  g.pop();
}

/** Where a stroke ends (normalised), used by the cats to know where to look. */
export function strokeEnd(s: Stroke): { x: number; y: number } | null {
  const last = s.pts[s.pts.length - 1] ?? s.marks[s.marks.length - 1];
  return last ? { x: last.x, y: last.y } : null;
}
