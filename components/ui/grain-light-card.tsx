"use client";

/**
 * Grain Light Card — a holographic card whose engraved lines flash as the light crosses them.
 *
 * Bring your own line art: any SVG drawn with strokes works.
 *
 *   <GrainLightCard
 *     label="Membership card"
 *     front={<svg viewBox="0 0 280 480" fill="none" stroke="var(--glc-line)" strokeWidth={0.6}>…</svg>}
 *     back={<svg viewBox="0 0 280 480">…</svg>}   // optional: makes the card flippable
 *   />
 *
 * - Lines must be strokes. Shapes that were "outlined" into fills (common in exported icons) do not flash.
 * - A filled shape hides the lines behind it — fill it with var(--glc-stock-2) to blend into the card.
 * - Colors to draw with: var(--glc-line), var(--glc-line-strong), var(--glc-ink); they switch with the theme.
 * - Bitmaps and <text> are shown as they are, without the flash.
 *
 * Theming: with theme="auto" the card follows a `.dark` ancestor and takes its text color from
 * shadcn's --foreground; the focus ring uses --ring. The card stock itself (pearl / black lacquer) is
 * the material, not a page color — override it with --glc-stock-1 / --glc-stock-2 (face) and
 * --glc-back-1 / --glc-back-2 (back) on the component if you need another one.
 *
 * Dependencies: none besides React. Works in Next.js as a client component.
 */

import * as React from "react";

export type GrainLightCardTheme = "light" | "dark" | "auto";

export interface GrainLightCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Face of the card. Put a line-art `<svg>` inside — it is stretched to fill the card and its
   * strokes catch the light. Shapes with a fill hide the lines behind them. Any HTML (a title,
   * a number) can sit on top; inside the card `cqw` units are relative to the card width.
   */
  front: React.ReactNode;
  /** Optional back, built the same way. When set, click, tap, Enter or Space flips the card. */
  back?: React.ReactNode;
  /** Card width: px number or any CSS length, e.g. "min(300px, 70vw)". Height follows `aspectRatio`. */
  width?: number | string;
  /** Width ÷ height. Default 7 / 12 (tarot proportions). */
  aspectRatio?: number;
  /** "light" pearl stock, "dark" lacquer, or "auto" — follows a `.dark` ancestor (shadcn). */
  theme?: GrainLightCardTheme;
  /** Flash on the lines that lie across the light, 0–1. */
  flash?: number;
  /** Constant rainbow on every line, 0–1. */
  foil?: number;
  /**
   * The colours the foil and the flash cycle through. Default: a rainbow. Pass your own (for example
   * a few golds) for a quieter, printed-foil look. Read live, so it can change at any time.
   */
  foilColors?: readonly string[];
  /** Highlight that follows the pointer, 0–1. */
  glare?: number;
  /** Glitter around the highlight, 0–1. */
  sparkle?: number;
  /** Maximum tilt in degrees. */
  maxTilt?: number;
  /** While nobody touches the card, the light slowly walks round it. */
  autoSweep?: boolean;
  /** Controlled side: true shows the back. */
  flipped?: boolean;
  /** Initial side when uncontrolled. */
  defaultFlipped?: boolean;
  /** Called when the card asks to turn over. */
  onFlippedChange?: (flipped: boolean) => void;
  /** Accessible name, e.g. "Tarot card 0, The Fool". */
  label?: string;
}

/* ───────────────────────── styles ───────────────────────── */

const STYLE_ID = "grain-light-card-styles";

const CSS = `
.glc{--glc-stock-1:#f7f7fa;--glc-stock-2:#d7d8e1;--glc-back-1:#f2f2f6;--glc-back-2:#cfd0da;--glc-line:rgba(30,28,52,.2);--glc-line-strong:rgba(30,28,52,.38);--glc-ink:#17162a;--glc-sh:40,36,70;--glc-sh-a:.32;--glc-foil-blend:multiply;--glc-foil-filter:saturate(2.2) brightness(.86);--glc-flash-blend:multiply;--glc-flash-filter:saturate(3.2) brightness(.62);--glc-glare-blend:overlay;--glc-glare-a:1;--glc-back-glare-a:1;--glc-spark-blend:overlay;position:relative;flex:none;width:var(--glc-w);aspect-ratio:var(--glc-ar);perspective:1000px;touch-action:none;border-radius:14px;outline:none;-webkit-tap-highlight-color:transparent}
.glc[data-theme=dark],.dark .glc[data-theme=auto]{--glc-stock-1:#1b1b27;--glc-stock-2:#0b0b11;--glc-back-1:#161620;--glc-back-2:#040406;--glc-line:rgba(236,235,243,.17);--glc-line-strong:rgba(236,235,243,.32);--glc-ink:#f3f2f8;--glc-sh:0,0,0;--glc-sh-a:.6;--glc-foil-blend:screen;--glc-foil-filter:none;--glc-flash-blend:plus-lighter;--glc-flash-filter:saturate(.75) brightness(1.9);--glc-glare-blend:screen;--glc-glare-a:.4;--glc-back-glare-a:.62;--glc-spark-blend:color-dodge}
.glc[data-theme=auto]{--glc-ink:hsl(var(--foreground,246 29% 13%))}
.dark .glc[data-theme=auto]{--glc-ink:hsl(var(--foreground,250 20% 96%))}
.glc[data-flip]{cursor:pointer}
.glc:focus-visible{outline:2px solid hsl(var(--ring,240 5% 64.9%));outline-offset:10px}
.glc-card{--rx:0deg;--ry:0deg;--lift:0px;--mx:50%;--my:50%;--mxb:50%;--bgx:50%;--bgy:50%;--bgxb:50%;--hyp:0;position:relative;width:100%;height:100%;transform:translateZ(var(--lift)) rotateX(var(--rx)) rotateY(var(--ry));transform-style:preserve-3d;will-change:transform}
.glc-side{position:absolute;inset:0;border-radius:4.6%/2.7%;overflow:hidden;isolation:isolate;container-type:inline-size;color:var(--glc-ink);backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:var(--glc-shadow,0 24px 48px -12px rgba(var(--glc-sh),var(--glc-sh-a)))}
.glc-front{background:radial-gradient(90% 60% at 50% 42%,var(--glc-stock-1),var(--glc-stock-2))}
.glc-back{transform:rotateY(180deg);background:radial-gradient(80% 55% at 50% 50%,var(--glc-back-1),var(--glc-back-2));--mx:var(--mxb);--bgx:var(--bgxb)}
.glc-card[data-facing=back] .glc-front,.glc-card[data-facing=front] .glc-back{visibility:hidden}
.glc-side>*{position:absolute;inset:0}
.glc-side>:not(.glc-art){pointer-events:none}
.glc-art>svg{display:block;width:100%;height:100%}
.glc-foil,.glc-flash,.glc-spark{width:100%;height:100%;display:block}
.glc-foil{filter:var(--glc-foil-filter);mix-blend-mode:var(--glc-foil-blend);opacity:calc(var(--glc-foil) * (.55 + var(--hyp) * .45))}
.glc-flash{filter:var(--glc-flash-filter);mix-blend-mode:var(--glc-flash-blend)}
.glc-spark{mix-blend-mode:var(--glc-spark-blend);opacity:calc(var(--glc-sparkle) * (.35 + var(--hyp) * .65))}
.glc-glare{background:radial-gradient(farthest-corner circle at var(--mx) var(--my),rgba(255,255,255,.85) 0%,rgba(255,255,255,.28) 22%,rgba(255,255,255,0) 58%);mix-blend-mode:var(--glc-glare-blend);opacity:calc(var(--glc-glare) * var(--glc-glare-a) * (.45 + var(--hyp) * .55))}
.glc-back .glc-glare{background:radial-gradient(farthest-corner circle at var(--mx) var(--my),rgba(255,255,255,.9) 0%,rgba(255,255,255,.22) 14%,rgba(255,255,255,0) 42%);opacity:calc(var(--glc-glare) * var(--glc-back-glare-a) * (.5 + var(--hyp) * .5))}
.glc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
`;

function useCardStyles() {
  React.useInsertionEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/* ───────────────────── light masks from the line art ─────────────────────
   An engraved groove throws light only when the light falls across it.
   Every stroke of the SVG is cut into runs by direction (NB buckets); each bucket becomes a mask,
   and each mask carries its own flash layer whose opacity follows the tilt. */

const NB = 18;
type Pt = [number, number];
type Mat = [number, number, number, number, number, number];
const ID: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
function ownMatrix(el: Element): Mat {
  const t = (el as SVGGraphicsElement).transform?.baseVal?.consolidate?.();
  if (!t) return ID;
  const m = t.matrix;
  return [m.a, m.b, m.c, m.d, m.e, m.f];
}
const num = (s: string | null) => parseFloat(s || "0") || 0;

/** Flattens path data into polylines (one per subpath). Returns null for arcs — those are sampled instead. */
function parsePath(d: string): Pt[][] | null {
  const tok = d.match(/[a-df-z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi);
  if (!tok) return [];
  const out: Pt[][] = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cx = 0, cy = 0, qx = 0, qy = 0, prev = "";
  let pl: Pt[] = [];
  const n = () => parseFloat(tok[i++]);
  const curve = (pts: (t: number) => Pt) => { for (let k = 1; k <= 12; k++) pl.push(pts(k / 12)); };
  while (i < tok.length) {
    if (/[a-z]/i.test(tok[i])) cmd = tok[i++];
    else if (!cmd) return null;
    const rel = cmd === cmd.toLowerCase() && cmd !== "z";
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "A") return null;
    if (C === "M") {
      x = ox + n(); y = oy + n(); sx = x; sy = y;
      pl = [[x, y]]; out.push(pl);
      cmd = rel ? "l" : "L";
    } else if (C === "L") { x = ox + n(); y = oy + n(); pl.push([x, y]); }
    else if (C === "H") { x = ox + n(); pl.push([x, y]); }
    else if (C === "V") { y = oy + n(); pl.push([x, y]); }
    else if (C === "Z") { pl.push([sx, sy]); x = sx; y = sy; pl = [[x, y]]; out.push(pl); }
    else if (C === "Q" || C === "T") {
      if (C === "Q") { qx = ox + n(); qy = oy + n(); }
      else if (prev === "Q" || prev === "T") { qx = 2 * x - qx; qy = 2 * y - qy; } else { qx = x; qy = y; }
      const x0 = x, y0 = y, x1 = ox + n(), y1 = oy + n(), Qx = qx, Qy = qy;
      curve(t => { const u = 1 - t; return [u * u * x0 + 2 * u * t * Qx + t * t * x1, u * u * y0 + 2 * u * t * Qy + t * t * y1]; });
      x = x1; y = y1;
    } else if (C === "C" || C === "S") {
      let ax: number, ay: number;
      if (C === "C") { ax = ox + n(); ay = oy + n(); }
      else if (prev === "C" || prev === "S") { ax = 2 * x - cx; ay = 2 * y - cy; } else { ax = x; ay = y; }
      cx = ox + n(); cy = oy + n();
      const x0 = x, y0 = y, x1 = ox + n(), y1 = oy + n(), Bx = cx, By = cy;
      curve(t => { const u = 1 - t; return [u * u * u * x0 + 3 * u * u * t * ax + 3 * u * t * t * Bx + t * t * t * x1, u * u * u * y0 + 3 * u * u * t * ay + 3 * u * t * t * By + t * t * t * y1]; });
      x = x1; y = y1;
    } else return null;
    if (C !== "C" && C !== "S") { cx = x; cy = y; }
    prev = C;
    if (Number.isNaN(x) || Number.isNaN(y)) return null;
  }
  return out.filter(p => p.length > 1);
}

/** Fallback for anything the parser skips (arcs, rounded rects): sample the outline, break at jumps. */
function sampleOutline(el: SVGGeometryElement): Pt[][] {
  let len = 0;
  try { len = el.getTotalLength(); } catch { return []; }
  if (!(len > 0)) return [];
  const step = Math.max(0.5, len / 4000), out: Pt[][] = [];
  let pl: Pt[] = [], last: Pt | null = null;
  for (let s = 0; s <= len + 1e-6; s += step) {
    const p = el.getPointAtLength(Math.min(s, len)), q: Pt = [p.x, p.y];
    if (last && Math.hypot(q[0] - last[0], q[1] - last[1]) > step * 2.5) { if (pl.length > 1) out.push(pl); pl = []; }
    pl.push(q); last = q;
  }
  if (pl.length > 1) out.push(pl);
  return out;
}

function polylinesOf(el: SVGGeometryElement): Pt[][] {
  const tag = el.tagName.toLowerCase();
  if (tag === "path") return parsePath(el.getAttribute("d") || "") ?? sampleOutline(el);
  if (tag === "line") return [[[num(el.getAttribute("x1")), num(el.getAttribute("y1"))], [num(el.getAttribute("x2")), num(el.getAttribute("y2"))]]];
  if (tag === "polyline" || tag === "polygon") {
    const v = (el.getAttribute("points") || "").match(/-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)?.map(Number) || [];
    const pl: Pt[] = [];
    for (let i = 0; i + 1 < v.length; i += 2) pl.push([v[i], v[i + 1]]);
    if (tag === "polygon" && pl.length) pl.push([pl[0][0], pl[0][1]]);
    return [pl];
  }
  if (tag === "circle" || tag === "ellipse") {
    const cx = num(el.getAttribute("cx")), cy = num(el.getAttribute("cy"));
    const rx = tag === "circle" ? num(el.getAttribute("r")) : num(el.getAttribute("rx"));
    const ry = tag === "circle" ? rx : num(el.getAttribute("ry"));
    const n = Math.max(48, Math.round(Math.max(rx, ry) * 2)), pl: Pt[] = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pl.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return [pl];
  }
  if (tag === "rect" && !num(el.getAttribute("rx")) && !num(el.getAttribute("ry"))) {
    const x = num(el.getAttribute("x")), y = num(el.getAttribute("y")), w = num(el.getAttribute("width")), h = num(el.getAttribute("height"));
    return [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]];
  }
  return sampleOutline(el);
}

const GEOMETRY = new Set(["path", "line", "polyline", "polygon", "circle", "ellipse", "rect"]);
const CONTAINERS = new Set(["g", "a", "svg", "switch"]);
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

interface MaskDocs { lines: string; buckets: string[] }
interface Plates { w: number; h: number; lines: CanvasImageSource; buckets: CanvasImageSource[]; free: () => void }

function buildMasks(svg: SVGSVGElement): MaskDocs | null {
  const vb = svg.viewBox?.baseVal;
  const box = vb && vb.width && vb.height ? `${vb.x} ${vb.y} ${vb.width} ${vb.height}` : `0 0 ${svg.clientWidth || 100} ${svg.clientHeight || 100}`;
  const par = svg.getAttribute("preserveAspectRatio") || "xMidYMid meet";
  const defs: string[] = [];
  let body = "";

  const walk = (node: Element, m: Mat) => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();
      if (tag === "defs") { el.querySelectorAll("clipPath").forEach(c => defs.push(c.outerHTML)); continue; }
      if (tag === "clippath") { defs.push(el.outerHTML); continue; }
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;
      const own = el.getAttribute("transform");
      const mm = own ? mul(m, ownMatrix(el)) : m;
      const clip = el.getAttribute("clip-path");
      const open = own || clip ? `<g${own ? ` transform="${own}"` : ""}${clip ? ` clip-path="${clip}"` : ""}>` : "";
      if (CONTAINERS.has(tag)) {
        body += open; walk(el, mm); body += open ? "</g>" : "";
        continue;
      }
      if (!GEOMETRY.has(tag) || el.getAttribute("visibility") === "hidden") continue;
      const fill = cs.fill, stroke = cs.stroke;
      const hasFill = !!fill && fill !== "none" && parseFloat(cs.fillOpacity || "1") > 0 && tag !== "line" && tag !== "polyline";
      const sw = parseFloat(cs.strokeWidth) || 0;
      const hasStroke = !!stroke && stroke !== "none" && sw > 0 && parseFloat(cs.strokeOpacity || "1") > 0;
      if (!hasFill && !hasStroke) continue;
      body += open;
      if (hasFill) {
        // a filled shape hides the lines drawn before it
        const c = el.cloneNode(false) as Element;
        for (const a of ["class", "style", "transform", "clip-path", "stroke", "stroke-width", "fill", "id"]) c.removeAttribute(a);
        c.setAttribute("fill", "#000");
        c.setAttribute("stroke", "none");
        body += c.outerHTML;
      }
      if (hasStroke) {
        const w = f1(sw * 1.6);
        for (const pl of polylinesOf(el as SVGGeometryElement)) {
          let run: Pt[] = [pl[0]], rb = -1;
          const flush = () => {
            if (rb >= 0 && run.length > 1) body += `<polyline class="b${rb}" points="${run.map(p => f1(p[0]) + "," + f1(p[1])).join(" ")}" stroke-width="${w}"/>`;
          };
          for (let i = 1; i < pl.length; i++) {
            const a = pl[i - 1], b = pl[i];
            // direction measured in the drawing's own space, after every transform
            const dx = mm[0] * (b[0] - a[0]) + mm[2] * (b[1] - a[1]);
            const dy = mm[1] * (b[0] - a[0]) + mm[3] * (b[1] - a[1]);
            if (dx * dx + dy * dy < 1e-8) continue;
            let ang = Math.atan2(dy, dx);
            if (ang < 0) ang += Math.PI;
            const k = Math.min(NB - 1, Math.floor((ang / Math.PI) * NB));
            if (k !== rb) { flush(); run = [a]; rb = k; }
            run.push(b);
          }
          flush();
        }
      }
      body += open ? "</g>" : "";
    }
  };
  walk(svg, ID);
  if (!body.includes("<polyline")) return null;

  const doc = (inner: string, style: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" preserveAspectRatio="${par}"><style>${style}</style>` +
    `<defs>${defs.join("")}<mask id="m" maskUnits="userSpaceOnUse" x="${box.split(" ")[0]}" y="${box.split(" ")[1]}" width="${box.split(" ")[2]}" height="${box.split(" ")[3]}">` +
    `<rect x="-1e5" y="-1e5" width="2e5" height="2e5" fill="#000"/>${inner}</mask></defs>` +
    `<rect x="-1e5" y="-1e5" width="2e5" height="2e5" fill="#fff" mask="url(#m)"/></svg>`;
  const STYLE = "polyline{fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round}";
  const buckets: string[] = [];
  for (let k = 0; k < NB; k++) {
    const only = body.replace(/<polyline class="b(\d+)"[^>]*\/>/g, (s, b) => (+b === k ? s : ""));
    buckets.push(doc(only, STYLE));
  }
  return { lines: doc(body, STYLE), buckets };
}

/**
 * Turns the vector line maps into bitmaps kept in memory. They are painted into three plain canvases
 * per side every frame — the component uses no CSS masks at all. (CSS mask layers are composited
 * separately by the browser; under load Chromium sometimes draws such a layer for a frame without its
 * mask, which flashed the whole card with rainbow.) A canvas only ever holds the lines themselves.
 */
async function rasterize(docs: MaskDocs, w: number, h: number, alive: () => boolean): Promise<Plates | null> {
  const made: ImageBitmap[] = [];
  const one = async (svgText: string): Promise<CanvasImageSource> => {
    const src = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      cv.getContext("2d")?.drawImage(img, 0, 0, w, h);
      if (typeof createImageBitmap === "function") {
        const bmp = await createImageBitmap(cv);
        made.push(bmp);
        return bmp;
      }
      return cv;
    } finally {
      URL.revokeObjectURL(src);
    }
  };
  const free = () => made.forEach(b => b.close?.());
  try {
    const lines = await one(docs.lines);
    const buckets: CanvasImageSource[] = [];
    for (const d of docs.buckets) {
      if (!alive()) throw new Error("stale");
      buckets.push(await one(d));
    }
    if (!alive()) throw new Error("stale");
    return { w, h, lines, buckets, free };
  } catch {
    free();
    return null;
  }
}

/* The card's rainbow foil, drawn on a canvas exactly where the CSS version used to sit:
   repeating-linear-gradient(115deg, …) in a 200% box moved by background-position. */
const RAINBOW = ["#ff6fae", "#ffcf6b", "#9dff9a", "#6be4ff", "#8e8bff", "#f27bff"];
const DIR: [number, number] = [Math.sin((115 * Math.PI) / 180), -Math.cos((115 * Math.PI) / 180)];
function gradientLine(g: CanvasRenderingContext2D, w: number, h: number, scale: number, px: number, py: number) {
  const bw = w * scale, bh = h * scale;
  const cx = (w - bw) * px + bw / 2, cy = (h - bh) * py + bh / 2;
  const len = Math.abs(bw * DIR[0]) + Math.abs(bh * DIR[1]);
  return g.createLinearGradient(cx - (DIR[0] * len) / 2, cy - (DIR[1] * len) / 2, cx + (DIR[0] * len) / 2, cy + (DIR[1] * len) / 2);
}
function rainbow(g: CanvasRenderingContext2D, w: number, h: number, px: number, py: number, colors: readonly string[] = RAINBOW) {
  const gr = gradientLine(g, w, h, 2, px, py);
  const list = colors.length ? colors : RAINBOW;
  for (let n = 0; n * 0.06 <= 1.0001; n++) gr.addColorStop(Math.min(1, n * 0.06), list[n % list.length]);
  return gr;
}
function band(g: CanvasRenderingContext2D, w: number, h: number, px: number, py: number) {
  const gr = gradientLine(g, w, h, 2.6, px, py);
  gr.addColorStop(0.06, "rgba(0,0,0,0)");
  gr.addColorStop(0.3, "#000");
  gr.addColorStop(0.7, "#000");
  gr.addColorStop(0.94, "rgba(0,0,0,0)");
  return gr;
}

/* ───────────────────────── glitter texture (shared) ───────────────────────── */

let sparkleTex: HTMLCanvasElement | null = null;
function getSparkles() {
  if (sparkleTex) return sparkleTex;
  const c = document.createElement("canvas");
  c.width = 560;
  c.height = 960;
  const g = c.getContext("2d");
  if (!g) return c;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const x = rnd() * c.width, y = rnd() * c.height, a = 0.25 + rnd() * 0.75;
    g.fillStyle = `rgba(255,255,255,${a})`;
    g.fillRect(x, y, rnd() < 0.85 ? 1.5 : 2.5, rnd() < 0.85 ? 1.5 : 2.5);
  }
  for (let i = 0; i < 40; i++) {
    const x = rnd() * c.width, y = rnd() * c.height, s = 3 + rnd() * 5;
    const grd = g.createRadialGradient(x, y, 0, x, y, s);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(x - s, y - 0.6, s * 2, 1.2);
    g.fillRect(x - 0.6, y - s, 1.2, s * 2);
  }
  sparkleTex = c;
  return c;
}

/* ───────────────────────── component ───────────────────────── */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
const f2 = (v: number) => v.toFixed(2);

interface SideCanvases { foil: HTMLCanvasElement | null; flash: HTMLCanvasElement | null; spark: HTMLCanvasElement | null }

function Side({ which, children, canvases }: {
  which: "front" | "back";
  children: React.ReactNode;
  canvases: React.MutableRefObject<SideCanvases>;
}) {
  return (
    <div className={`glc-side glc-${which}`} aria-hidden="true">
      <div className="glc-art">{children}</div>
      <canvas className="glc-foil" width={1} height={1} ref={el => { canvases.current.foil = el; }} />
      <canvas className="glc-flash" width={1} height={1} ref={el => { canvases.current.flash = el; }} />
      <canvas className="glc-spark" width={1} height={1} ref={el => { canvases.current.spark = el; }} />
      <div className="glc-glare" />
    </div>
  );
}

export const GrainLightCard = React.forwardRef<HTMLDivElement, GrainLightCardProps>(function GrainLightCard(
  {
    front,
    back,
    width = 300,
    aspectRatio = 7 / 12,
    theme = "auto",
    flash = 1,
    foil = 0.2,
    foilColors = RAINBOW,
    glare = 0.6,
    sparkle = 0.5,
    maxTilt = 14,
    autoSweep = true,
    flipped,
    defaultFlipped = false,
    onFlippedChange,
    label = "Holographic card",
    className,
    style,
    onKeyDown,
    ...rest
  },
  ref,
) {
  useCardStyles();
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const frontCv = React.useRef<SideCanvases>({ foil: null, flash: null, spark: null });
  const backCv = React.useRef<SideCanvases>({ foil: null, flash: null, spark: null });
  // bitmaps of the line art per side; null until ready (the card then shows no flash, never a wrong one)
  const plates = React.useRef<{ front: Plates | null; back: Plates | null }>({ front: null, back: null });
  React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

  const [innerFlipped, setInnerFlipped] = React.useState(defaultFlipped);
  const isFlipped = !!back && (flipped ?? innerFlipped);
  const turn = React.useCallback(() => {
    if (!back) return;
    const next = !(flipped ?? innerFlipped);
    if (flipped === undefined) setInnerFlipped(next);
    onFlippedChange?.(next);
  }, [back, flipped, innerFlipped, onFlippedChange]);

  // live values for the animation loop
  const aspectRef = React.useRef(aspectRatio);
  aspectRef.current = aspectRatio;
  const live = React.useRef({ maxTilt, autoSweep, flash, foilColors, flipTarget: 0 });
  live.current.foilColors = foilColors;
  live.current.maxTilt = maxTilt;
  live.current.autoSweep = autoSweep;
  live.current.flash = flash;
  live.current.flipTarget = isFlipped ? 180 : 0;

  // Read the line art and build the light maps; rebuilt when the art changes or the card is resized a lot.
  React.useEffect(() => {
    const root = rootRef.current, card = cardRef.current;
    if (!root || !card) return;
    let timer = 0, gen = 0, builtFor = 0;
    const size = (cv: SideCanvases, w: number, h: number) => {
      for (const c of [cv.foil, cv.flash, cv.spark]) if (c && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
    };
    const build = async () => {
      const my = ++gen;
      const alive = () => my === gen;
      const rect = root.getBoundingClientRect();
      const cssW = rect.width || 300, cssH = rect.height || cssW / aspectRef.current;
      const k = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.max(64, Math.round(cssW * k)), h = Math.max(64, Math.round(cssH * k));
      builtFor = cssW;
      const docsOf = (sel: string) => {
        const svg = card.querySelector<SVGSVGElement>(`${sel} > .glc-art svg`);
        return svg ? buildMasks(svg) : null;
      };
      const fd = docsOf(".glc-front"), bd = docsOf(".glc-back");
      for (const c of [frontCv.current.spark, backCv.current.spark]) if (c && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
      // the face first (it is what people see), the back right after
      const f = fd ? await rasterize(fd, w, h, alive) : null;
      if (!alive()) { f?.free(); return; }
      plates.current.front?.free();
      size(frontCv.current, w, h);
      plates.current.front = f;
      const b = bd ? await rasterize(bd, w, h, alive) : null;
      if (!alive()) { b?.free(); return; }
      plates.current.back?.free();
      size(backCv.current, w, h);
      plates.current.back = b;
    };
    const later = (ms: number) => { clearTimeout(timer); timer = window.setTimeout(() => void build(), ms); };
    void build();
    const mo = new MutationObserver(recs => {
      if (recs.every(r => (r.target as Element).closest?.(".glc-art") == null)) return;
      later(120);
    });
    card.querySelectorAll(".glc-art").forEach(a => mo.observe(a, { subtree: true, childList: true, attributes: true, characterData: true }));
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(([e]) => {
          const w = e.contentRect.width;
          if (builtFor && w && Math.abs(w - builtFor) / builtFor > 0.25) later(250);
        })
      : null;
    ro?.observe(root);
    return () => {
      gen++;
      mo.disconnect();
      ro?.disconnect();
      clearTimeout(timer);
      plates.current.front?.free();
      plates.current.back?.free();
      plates.current = { front: null, back: null };
    };
  }, [!!back]);

  // Motion: pointer / gyroscope / auto sweep → tilt, light position and the flash of each direction.
  React.useEffect(() => {
    const root = rootRef.current, card = cardRef.current;
    if (!root || !card) return;
    const sparkles = getSparkles();
    let litBefore = { front: true, back: true };
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 }, vel = { x: 0, y: 0 };
    let pointer = false, flip = live.current.flipTarget, flipVel = 0;
    // auto sweep: the light walks an ellipse; when the pointer (or the phone) lets go,
    // the walk starts from wherever the card is now — no jump back to the centre, no pause.
    const RX = 0.5, RY = 0.42, TURN = 8000;   // ellipse radii, ms per full turn
    let sweepA = 0, sweepFromAmp = 0, sweepFromT = 0, sweepFresh = true, lastT = -1, acc = 0, wasGyro = false, wasAuto = live.current.autoSweep;
    let gyro: { x: number; y: number } | null = null, gyroAt = -1e9, gyroBase: { b: number; g: number } | null = null, gyroAsked = false;
    let down: { x: number; y: number; t: number; moved: boolean } | null = null;

    const setTarget = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      // A card with no size (e.g. turned edge-on by a parent's transform) has no "where": skip it,
      // or the division below would make the tilt NaN.
      if (!(r.width > 0 && r.height > 0)) return;
      target.x = clamp1(((e.clientX - r.left) / r.width) * 2 - 1);
      target.y = clamp1(((e.clientY - r.top) / r.height) * 2 - 1);
    };
    const release = () => { pointer = false; sweepFresh = true; };
    const onEnter = (e: PointerEvent) => { pointer = true; setTarget(e); };
    const onMove = (e: PointerEvent) => {
      pointer = true; setTarget(e);
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
    };
    const onDown = (e: PointerEvent) => {
      pointer = true; setTarget(e);
      down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      try { root.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !gyroAsked) {
        gyroAsked = true;
        const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
        D?.requestPermission?.().catch(() => {});
      }
      if (down && !down.moved && performance.now() - down.t < 500) turnRef.current();   // a tap flips, a drag only tilts
      down = null;
      if (e.pointerType !== "mouse") release();
    };
    const onLeave = () => { down = null; release(); };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (!gyroBase) gyroBase = { b: e.beta, g: e.gamma };
      gyroBase.b += (e.beta - gyroBase.b) * 0.01;   // "level" slowly follows the way the phone is held
      gyroBase.g += (e.gamma - gyroBase.g) * 0.01;
      gyro = { x: clamp1((e.gamma - gyroBase.g) / 18), y: clamp1((e.beta - gyroBase.b) / 18) };
      gyroAt = performance.now();
    };
    root.addEventListener("pointerenter", onEnter);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointercancel", onLeave);
    window.addEventListener("deviceorientation", onOrient);

    let raf = 0, onScreen = true;
    const tick = (t: number) => {
      const L = live.current;
      const dt = lastT < 0 ? 16.7 : Math.min(100, t - lastT);   // a long gap (hidden tab) never turns into a jump
      lastT = t;
      const gyroOn = !pointer && !!gyro && t - gyroAt < 400;
      if (wasGyro && !gyroOn) sweepFresh = true;
      if (L.autoSweep !== wasAuto) { sweepFresh = true; wasAuto = L.autoSweep; }
      wasGyro = gyroOn;
      if (gyroOn && gyro) { target.x = gyro.x; target.y = gyro.y; }
      else if (!pointer) {
        if (reduce) { target.x = 0.3; target.y = 0.25; }
        else if (!L.autoSweep) { target.x = 0; target.y = 0; }
        else {
          if (sweepFresh) {
            const nx = cur.x / RX, ny = cur.y / RY;
            sweepA = Math.atan2(ny, nx);
            sweepFromAmp = Math.min(2, Math.hypot(nx, ny));
            sweepFromT = t;
            sweepFresh = false;
          }
          sweepA += (dt / TURN) * Math.PI * 2;
          const k = Math.min(1, (t - sweepFromT) / 1200), e = k * k * (3 - 2 * k);
          const amp = sweepFromAmp + (1 - sweepFromAmp) * e;
          target.x = Math.cos(sweepA) * RX * amp;
          target.y = Math.sin(sweepA) * RY * amp;
        }
      }
      // Never let a bad value (NaN / Infinity) stick: the spring would carry it forever.
      for (const v of [target, cur, vel]) if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) { v.x = 0; v.y = 0; }
      // spring in fixed 60 Hz steps: same feel on 60, 120 and 144 Hz screens
      if (reduce) { cur.x = target.x; cur.y = target.y; }
      else {
        acc += dt;
        while (acc >= 1000 / 60) {
          acc -= 1000 / 60;
          for (const k of ["x", "y"] as const) {
            vel[k] += (target[k] - cur[k]) * 0.06;
            vel[k] *= 0.78;
            cur[k] += vel[k];
          }
        }
      }
      if (reduce) flip = L.flipTarget;
      else {
        for (let n = Math.max(1, Math.round(dt / (1000 / 60))); n > 0; n--) {
          flipVel += (L.flipTarget - flip) * 0.05;   // a touch of overshoot, settles in ~0.7 s
          flipVel *= 0.8;
          flip += flipVel;
        }
        if (Math.abs(L.flipTarget - flip) < 0.01 && Math.abs(flipVel) < 0.01) { flip = L.flipTarget; flipVel = 0; }
      }
      const rx = -cur.y * L.maxTilt, tiltY = cur.x * L.maxTilt, ry = tiltY + flip;
      const hyp = Math.min(1, Math.hypot(cur.x, cur.y));
      const lift = Math.sin(Math.min(1, Math.max(0, flip / 180)) * Math.PI) * 30;   // the card rises a little while it turns
      const facing = Math.cos((ry * Math.PI) / 180) * Math.cos((rx * Math.PI) / 180) >= 0 ? "front" : "back";
      if (card.dataset.facing !== facing) card.dataset.facing = facing;
      const s = card.style;
      s.setProperty("--rx", f2(rx) + "deg");
      s.setProperty("--ry", f2(ry) + "deg");
      s.setProperty("--lift", f2(lift) + "px");
      s.setProperty("--mx", f2(50 + cur.x * 46) + "%");
      s.setProperty("--mxb", f2(50 - cur.x * 46) + "%");
      s.setProperty("--my", f2(50 + cur.y * 46) + "%");
      s.setProperty("--bgx", f2(50 + cur.x * 42) + "%");
      s.setProperty("--bgxb", f2(50 - cur.x * 42) + "%");
      s.setProperty("--bgy", f2(50 + cur.y * 42) + "%");
      s.setProperty("--hyp", hyp.toFixed(3));
      const sy = facing === "front" ? -tiltY : tiltY;   // shadow falls away from the tilt
      s.setProperty(
        "--glc-shadow",
        `${f2(sy * 1.1)}px ${f2(26 + rx * 1.1 + lift * 0.4)}px ${f2(50 + lift * 0.6)}px -14px rgba(var(--glc-sh),var(--glc-sh-a)),` +
          `${f2(sy * 0.3)}px ${f2(8 + rx * 0.3)}px 14px -6px rgba(var(--glc-sh),calc(var(--glc-sh-a) * .6))`,
      );
      // Paint the light for the side that faces us. A groove lights up when it lies across the light;
      // the back sees the light mirrored.
      const side = facing === "front" ? "front" : "back";
      const P = plates.current[side], C = side === "front" ? frontCv.current : backCv.current;
      const px = (50 + (side === "front" ? cur.x : -cur.x) * 42) / 100, py = (50 + cur.y * 42) / 100;
      const sp = C.spark?.getContext("2d");
      if (sp && C.spark) {
        const w = C.spark.width, h = C.spark.height;
        if (w > 1) {
          const mx = ((50 + (side === "front" ? cur.x : -cur.x) * 46) / 100) * w, my = ((50 + cur.y * 46) / 100) * h;
          const far = Math.hypot(Math.max(mx, w - mx), Math.max(my, h - my));
          sp.globalCompositeOperation = "source-over";
          sp.clearRect(0, 0, w, h);
          sp.drawImage(sparkles, 0, 0, w, h);
          sp.globalCompositeOperation = "destination-in";
          const rg = sp.createRadialGradient(mx, my, 0, mx, my, far * 0.38);
          rg.addColorStop(0, "#000");
          rg.addColorStop(1, "rgba(0,0,0,0)");
          sp.fillStyle = rg;
          sp.fillRect(0, 0, w, h);
          sp.globalCompositeOperation = "source-over";
        }
      }
      if (P) {
        const fo = C.foil?.getContext("2d");
        if (fo) {
          fo.globalCompositeOperation = "source-over";
          fo.clearRect(0, 0, P.w, P.h);
          fo.drawImage(P.lines, 0, 0);
          fo.globalCompositeOperation = "destination-in";
          fo.fillStyle = band(fo, P.w, P.h, px, py);
          fo.fillRect(0, 0, P.w, P.h);
          fo.globalCompositeOperation = "source-in";
          fo.fillStyle = rainbow(fo, P.w, P.h, px, py, L.foilColors);
          fo.fillRect(0, 0, P.w, P.h);
          fo.globalCompositeOperation = "source-over";
        }
        const fl = C.flash?.getContext("2d");
        if (fl) {
          const lit = Math.min(1, hyp * 2.4) * clamp01(L.flash);
          const phi = Math.atan2(cur.y, side === "front" ? cur.x : -cur.x);
          let any = false;
          fl.globalCompositeOperation = "source-over";
          for (let k = 0; k < P.buckets.length; k++) {
            const d = ((k + 0.5) / NB) * Math.PI - phi - Math.PI / 2;
            const a = Math.pow((1 + Math.cos(2 * d)) / 2, 16) * lit;
            if (a < 0.004) continue;
            if (!any) { fl.clearRect(0, 0, P.w, P.h); any = true; }
            fl.globalAlpha = Math.min(1, a);
            fl.drawImage(P.buckets[k], 0, 0);
          }
          fl.globalAlpha = 1;
          if (any) {
            fl.globalCompositeOperation = "source-in";
            fl.fillStyle = rainbow(fl, P.w, P.h, px, py, L.foilColors);
            fl.fillRect(0, 0, P.w, P.h);
            fl.globalCompositeOperation = "source-over";
          } else if (litBefore[side]) fl.clearRect(0, 0, P.w, P.h);
          litBefore[side] = any;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      const run = onScreen && !document.hidden;
      if (run && !raf) { lastT = -1; raf = requestAnimationFrame(tick); }
      else if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }) : null;
    io?.observe(root);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      cancelAnimationFrame(raf);
      root.removeEventListener("pointerenter", onEnter);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointercancel", onLeave);
      window.removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  const turnRef = React.useRef(turn);
  turnRef.current = turn;

  const vars = {
    "--glc-w": typeof width === "number" ? `${width}px` : width,
    "--glc-ar": String(aspectRatio),
    "--glc-foil": clamp01(foil),
    "--glc-glare": clamp01(glare),
    "--glc-sparkle": clamp01(sparkle),
  } as React.CSSProperties;

  const flippable = !!back;
  return (
    <div
      ref={rootRef}
      data-theme={theme}
      data-flip={flippable ? "" : undefined}
      className={["glc", className].filter(Boolean).join(" ")}
      style={{ ...vars, ...style }}
      role={flippable ? "button" : "img"}
      tabIndex={flippable ? 0 : undefined}
      aria-label={flippable ? `${label}. ${isFlipped ? "Showing the back" : "Showing the face"}, press to turn over` : label}
      {...rest}
      onKeyDown={e => {
        onKeyDown?.(e);
        if (!flippable || e.defaultPrevented || e.repeat) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); turn(); }
      }}
    >
      <div ref={cardRef} className="glc-card" data-facing="front">
        <Side which="front" canvases={frontCv}>{front}</Side>
        {back && <Side which="back" canvases={backCv}>{back}</Side>}
      </div>
    </div>
  );
});

export default GrainLightCard;
