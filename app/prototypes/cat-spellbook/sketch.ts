/**
 * The p5.js sketch for the Cat Spellbook.
 *
 * Layers, drawn back to front every frame:
 *   1. `paper`  – parchment, paper grain and the hand-ruled tarot border (painted once, reused)
 *   2. `disc`   – the celestial disc (painted once, drawn slowly rotating)
 *   3. `ink`    – every finished stroke (painted when a stroke is committed)
 *   4. live things – the stroke in progress, sparkles, and the cats
 *
 * Because finished strokes live on their own layer, they stay put while the
 * disc turns and the cats move, and each frame stays cheap.
 *
 * Input uses pointer events, which cover mouse, trackpad, pen and touch
 * with one set of handlers.
 */

import type p5 from "p5";
import { drawStroke, INK, starShape, type BrushId, type Stroke } from "./brushes";
import { createCats, drawCats, noticeStroke, updateCats, type Stage } from "./cats";
import { playChime, playGesture, playSpell } from "./sound";

export type Settings = { brush: BrushId; color: string; size: number };

export type SketchApi = {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  download: () => void;
  castSpell: () => void;
  destroy: () => void;
};

export type SketchEvents = {
  onHistory: (canUndo: boolean, canRedo: boolean, isEmpty: boolean) => void;
  onSpellDone: () => void;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string; rot: number };

const MAX_PARTICLES = 120;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export async function mountSketch(host: HTMLElement, settings: Settings, events: SketchEvents): Promise<SketchApi> {
  // p5 needs the browser (window/document), so it is imported here, not at the top of the file
  const P5 = (await import("p5")).default;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let api!: SketchApi;

  const instance = new P5((p: p5) => {
    let W = 10;
    let H = 10;
    let unit = 1; // page width ÷ 1000: sizes are multiplied by this
    let frame = { x: 0, y: 0, w: 10, h: 10 }; // the drawable area inside the border
    let border = { outer: 0, inner: 0 }; // how far in from the page's edge the two border lines are
    let ledgeY = 0;
    let catScale = 1;

    let paper: p5.Graphics;
    let disc: p5.Graphics;
    let ink: p5.Graphics;
    let discSize = 10;
    let discAngle = 0;

    // the drawing itself
    let strokes: Stroke[] = [];
    let redoStack: Stroke[] = [];
    let cleared: Stroke[] | null = null; // lets "undo" bring back a cleared page
    let current: Stroke | null = null;

    // drawing state
    let drawing = false;
    const cursor = { x: 0, y: 0 };
    const pen = { x: 0, y: 0, vx: 0, vy: 0 }; // the lagging "pen" used by quill, yarn and tail
    let lastMark = { x: 0, y: 0 };
    let side = 1;
    let lastW = 1;

    const particles: Particle[] = [];
    const cats = createCats();
    let glow = 0; // seconds left of the "Cast a Spell" glow
    let spellPending = false;

    /* ---------- helpers ---------- */

    const sparkle = (x: number, y: number, color: string, n: number, spread = 26) => {
      for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = rnd(8, spread) * unit;
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14 * unit, life: 0, max: rnd(0.6, 1.3), r: rnd(2.2, 5) * unit, color, rot: Math.random() * 3 });
      }
    };

    const history = () => events.onHistory(strokes.length > 0 || !!cleared, redoStack.length > 0, strokes.length === 0);

    const repaintInk = () => {
      ink.clear();
      for (const s of strokes) drawStroke(p, ink, s, W, H, unit);
    };

    /* ---------- hand-inked lines ---------- */

    /**
     * A line that is not quite straight, as if ruled by hand: it drifts a
     * hair's breadth from side to side along its length. `p.noise` gives a
     * smooth random value, so the drift is gentle rather than jagged.
     */
    const inkLine = (g: p5, x1: number, y1: number, x2: number, y2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const steps = Math.max(2, Math.ceil(len / (36 * unit + 10)));
      const nx = -(y2 - y1) / len; // the direction at right angles to the line
      const ny = (x2 - x1) / len;
      const wobble = 0.9 * unit + 0.35;
      g.beginShape();
      for (let i = -1; i <= steps + 1; i++) {
        const t = Math.max(0, Math.min(1, i / steps));
        const ends = i <= 0 || i >= steps ? 0 : 1; // the two ends stay exactly in place
        const d = (p.noise(x1 * 0.013 + t * len * 0.011, y1 * 0.013 + x2 * 0.007) - 0.5) * 2 * wobble * ends;
        g.curveVertex(x1 + (x2 - x1) * t + nx * d, y1 + (y2 - y1) * t + ny * d);
      }
      g.endShape();
    };

    const inkRect = (g: p5, x: number, y: number, w: number, h: number) => {
      inkLine(g, x, y, x + w, y);
      inkLine(g, x + w, y, x + w, y + h);
      inkLine(g, x + w, y + h, x, y + h);
      inkLine(g, x, y + h, x, y);
    };

    /**
     * One phase of the moon. `lit` is how much is lit (0.25 = crescent,
     * 0.5 = half, 1 = full) and `side` is which side the light is on.
     */
    const moonPhase = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lit: number, side: 1 | -1) => {
      ctx.strokeStyle = INK.gold;
      ctx.lineWidth = Math.max(0.6, 0.8 * unit);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = INK.gold;
      ctx.beginPath();
      // the lit edge: half of the moon's outline...
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, side < 0);
      // ...then back up along the shadow's edge, which is half of a squashed circle
      ctx.ellipse(cx, cy, r * Math.abs(1 - 2 * lit), r, 0, Math.PI / 2, -Math.PI / 2, lit < 0.5 ? side > 0 : side < 0);
      ctx.fill();
    };

    /* ---------- the storybook page (painted once per size) ---------- */

    const paintPaper = () => {
      const g = paper as unknown as p5;
      const ctx = paper.drawingContext as CanvasRenderingContext2D;
      p.randomSeed(11);
      p.noiseSeed(11);
      g.background(INK.parchment);

      // paper grain: thousands of faint specks and a few fibres
      g.noStroke();
      const specks = Math.floor((W * H) / 300);
      for (let i = 0; i < specks; i++) {
        const dark = p.random() < 0.6;
        g.fill(dark ? p.color(118, 90, 52, p.random(6, 20)) : p.color(255, 252, 240, p.random(20, 55)));
        g.rect(p.random(W), p.random(H), p.random(0.6, 1.7), p.random(0.6, 1.7));
      }
      g.stroke(120, 92, 56, 18);
      g.strokeWeight(0.6);
      for (let i = 0; i < 60; i++) {
        const x = p.random(W);
        const y = p.random(H);
        const a = p.random(Math.PI);
        const l = p.random(6, 22);
        g.line(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      // slightly darker towards the edges, like an old page
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, "rgba(120, 90, 50, 0)");
      vg.addColorStop(1, "rgba(120, 90, 50, 0.17)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // tarot border: a gold line with a finer one inside it, both ruled by hand
      const o = border.outer;
      const o2 = border.inner;
      const hair = Math.max(0.6, 0.8 * unit);
      g.noFill();
      g.stroke(INK.gold);
      g.strokeWeight(Math.max(1.1, 1.7 * unit));
      inkRect(g, o, o, W - o * 2, H - o * 2);
      g.strokeWeight(hair);
      inkRect(g, o2, o2, W - o2 * 2, H - o2 * 2);

      // corners: a star, with two small dots trailing away from it down the margin
      g.noStroke();
      g.fill(INK.gold);
      const cs = Math.max(4, 6.5 * unit);
      const ci = o + 16 * unit + 6;
      for (const [cx, cy, dir] of [[ci, ci, 1], [W - ci, ci, 1], [ci, H - ci, -1], [W - ci, H - ci, -1]]) {
        starShape(g, cx, cy, cs, 0);
        g.circle(cx, cy + dir * (cs + 7 * unit + 2), Math.max(1.6, 2.6 * unit));
        g.circle(cx, cy + dir * (cs + 14 * unit + 4), Math.max(1.2, 1.8 * unit));
      }

      // top centre: the phases of the moon. The full moon in the middle has ears.
      const my = (o2 + frame.y) / 2;
      const mr = Math.min((frame.y - o2) * 0.27, 12 * unit + 3);
      const gapX = mr * 3.1;
      moonPhase(ctx, W / 2 - gapX * 2, my, mr * 0.8, 0.25, 1);
      moonPhase(ctx, W / 2 - gapX, my, mr * 0.9, 0.5, 1);
      moonPhase(ctx, W / 2 + gapX, my, mr * 0.9, 0.5, -1);
      moonPhase(ctx, W / 2 + gapX * 2, my, mr * 0.8, 0.25, -1);
      g.noStroke();
      g.fill(INK.gold);
      g.circle(W / 2, my + mr * 0.08, mr * 2);
      g.triangle(W / 2 - mr * 0.96, my - mr * 0.2, W / 2 - mr * 0.74, my - mr * 1.28, W / 2 - mr * 0.12, my - mr * 0.88);
      g.triangle(W / 2 + mr * 0.96, my - mr * 0.2, W / 2 + mr * 0.74, my - mr * 1.28, W / 2 + mr * 0.12, my - mr * 0.88);
      // its sleeping face, in the colour of the paper
      g.noFill();
      g.stroke(INK.parchment);
      g.strokeWeight(Math.max(0.8, 1.1 * unit));
      g.arc(W / 2 - mr * 0.4, my + mr * 0.02, mr * 0.44, mr * 0.34, 0.15, Math.PI - 0.15);
      g.arc(W / 2 + mr * 0.4, my + mr * 0.02, mr * 0.44, mr * 0.34, 0.15, Math.PI - 0.15);
      g.noStroke();
      g.fill(INK.parchment);
      g.triangle(W / 2 - mr * 0.11, my + mr * 0.36, W / 2 + mr * 0.11, my + mr * 0.36, W / 2, my + mr * 0.52);
      // a fine line with a star at its end leads away from the moons on each side
      for (const dir of [-1, 1]) {
        const x0 = W / 2 + dir * (gapX * 2 + mr * 2);
        const x1 = W / 2 + dir * (gapX * 2 + mr * 2 + 58 * unit + 14);
        g.noFill();
        g.stroke(INK.gold);
        g.strokeWeight(hair);
        inkLine(g, x0, my, x1, my);
        g.noStroke();
        g.fill(INK.gold);
        g.circle(x0 - dir * mr * 0.55, my, Math.max(1.6, 2.4 * unit));
        starShape(g, x1 + dir * mr * 0.7, my, mr * 0.42, 0);
        g.circle(x1 + dir * mr * 1.6, my, Math.max(1.2, 1.8 * unit));
      }

      // the frame you draw inside
      g.noFill();
      g.stroke(31, 42, 74, 215);
      g.strokeWeight(Math.max(0.8, 1.05 * unit));
      inkRect(g, frame.x, frame.y, frame.w, frame.h);

      // beads threaded along the bottom border, where the cats sit: dots, with a small star every fifth
      g.noStroke();
      g.fill(INK.gold);
      const beadY = ledgeY;
      const beadGap = 20 * unit + 6;
      const beads = Math.floor(frame.w / beadGap);
      for (let i = 0; i <= beads; i++) {
        const x = W / 2 + (i - beads / 2) * beadGap;
        if (i % 5 === Math.floor(beads / 2) % 5) starShape(g, x, beadY, Math.max(2.6, 3.8 * unit), 0);
        else g.circle(x, beadY, Math.max(1.5, 2.2 * unit));
      }

      // faint constellations in the corners of the page. The first one is a cat.
      const cons: [number, number][][] = [
        [[0.085, 0.19], [0.075, 0.085], [0.115, 0.125], [0.165, 0.125], [0.205, 0.085], [0.195, 0.19], [0.14, 0.245], [0.085, 0.19]],
        [[0.74, 0.8], [0.8, 0.86], [0.86, 0.78], [0.92, 0.84]],
        [[0.1, 0.78], [0.15, 0.86], [0.22, 0.82], [0.2, 0.92]],
        [[0.78, 0.1], [0.84, 0.19], [0.8, 0.28], [0.9, 0.24]],
      ];
      for (const c of cons) {
        const pts = c.map(([fx, fy]) => [frame.x + fx * frame.w, frame.y + fy * frame.h]);
        g.stroke(31, 42, 74, 38);
        g.strokeWeight(Math.max(0.5, 0.7 * unit));
        for (let i = 1; i < pts.length; i++) g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        g.noStroke();
        g.fill(31, 42, 74, 80);
        for (const [x, y] of pts) starShape(g, x, y, Math.max(2, 3 * unit), Math.PI / 4);
      }
    };

    /* ---------- the celestial disc (painted once, then rotated) ---------- */

    const paintDisc = () => {
      const g = disc as unknown as p5;
      const ctx = disc.drawingContext as CanvasRenderingContext2D;
      const D = discSize;
      const c = D / 2;
      const TAU = Math.PI * 2;
      // a point on the disc: `r` is a fraction of its width, `a` an angle
      const at = (r: number, a: number) => [c + Math.cos(a) * D * r, c + Math.sin(a) * D * r] as const;
      disc.clear();
      g.noFill();
      g.stroke(184, 151, 79, 82); // antique gold, faint: this is a watermark, not a drawing
      g.strokeWeight(Math.max(0.6, 0.85 * unit));
      for (const r of [0.49, 0.475, 0.405, 0.3]) g.circle(c, c, D * r * 2);
      // the outer scale: 72 small ticks, every sixth one longer
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU;
        g.line(...at(i % 6 === 0 ? 0.425 : 0.452, a), ...at(0.475, a));
      }
      // twelve "houses": spokes, with a star or a small moon resting in each
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.line(...at(0.3, a), ...at(0.405, a));
        const m = a + Math.PI / 12;
        const [x, y] = at(0.352, m);
        if (i % 2 === 0) {
          g.push();
          g.noStroke();
          g.fill(184, 151, 79, 96);
          starShape(g, x, y, D * 0.019, m);
          g.pop();
        } else g.arc(x, y, D * 0.034, D * 0.034, m + 0.6, m + Math.PI + 0.6);
      }
      // the sun in the middle: a ring of rays, long and short in turn
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * TAU;
        g.line(...at(0.135, a), ...at(i % 4 === 0 ? 0.27 : i % 2 === 0 ? 0.215 : 0.168, a));
      }
      g.circle(c, c, D * 0.24);
      // ...and a crescent moon resting inside it
      const r = D * 0.07;
      ctx.fillStyle = "rgba(184, 151, 79, 0.3)";
      ctx.beginPath();
      ctx.arc(c, c, r, -Math.PI / 2, Math.PI / 2, true);
      ctx.ellipse(c, c, r * 0.5, r, 0, Math.PI / 2, -Math.PI / 2, false);
      ctx.fill();
      g.push();
      g.noStroke();
      g.fill(184, 151, 79, 96);
      starShape(g, c + r * 0.3, c, r * 0.3, 0);
      g.pop();
    };

    /* ---------- layout ---------- */

    const layout = () => {
      W = Math.max(50, Math.floor(host.clientWidth));
      H = Math.max(50, Math.floor(host.clientHeight));
      unit = W / 1000;
      const sideM = W * 0.055;
      const topM = H * 0.095;
      const band = H * 0.15; // the bottom band where the cats live
      frame = { x: sideM, y: topM, w: W - sideM * 2, h: H - topM - band };
      // the border is two lines: the outer one, and a finer one just inside it
      const outer = Math.min(W, H) * 0.022;
      border = { outer, inner: outer + 5 * unit + 2 };
      ledgeY = H - border.inner; // the cats sit on the inner line of the border itself
      catScale = (ledgeY - (frame.y + frame.h)) / 94; // a sitting cat (ears included) fits between the frame and the border
      discSize = Math.floor(Math.min(frame.w, frame.h) * 0.8);
    };

    const rebuild = () => {
      layout();
      p.resizeCanvas(W, H);
      // The three offscreen layers are created once, then resized.
      // (Creating new ones each time and calling .remove() on the old ones
      // crashes inside p5 when it runs in instance mode.)
      if (!paper) {
        paper = p.createGraphics(W, H);
        disc = p.createGraphics(discSize, discSize);
        ink = p.createGraphics(W, H);
      } else {
        paper.resizeCanvas(W, H);
        disc.resizeCanvas(discSize, discSize);
        ink.resizeCanvas(W, H);
      }
      paintPaper();
      paintDisc();
      repaintInk();
      for (const c of cats) c.x = -1; // cats go back to their spots for the new size
    };

    /* ---------- drawing input ---------- */

    const norm = (x: number, y: number) => ({ x: x / W, y: y / H });

    const addPoint = (x: number, y: number, w: number) => {
      current!.pts.push({ ...norm(x, y), w });
      playGesture(current!.brush, y / H);
    };

    /** Called for every pointer position while drawing. */
    const extend = (x: number, y: number) => {
      if (!current) return;
      cursor.x = x;
      cursor.y = y;
      const s = current;
      const size = s.size * unit;

      if (s.brush === "quill") {
        // the pen trails the cursor slightly, which smooths out hand jitter
        pen.x += (x - pen.x) * 0.55;
        pen.y += (y - pen.y) * 0.55;
        const last = s.pts[s.pts.length - 1];
        const d = Math.hypot(pen.x - last.x * W, pen.y - last.y * H);
        if (d < 1.2) return;
        // fast = thin, slow = thick, changing gradually
        const target = Math.max(0.4, Math.min(1.5, 1.55 - (d / unit) * 0.05));
        lastW += (target - lastW) * 0.22;
        addPoint(pen.x, pen.y, lastW);
      } else if (s.brush === "paw") {
        const d = Math.hypot(x - lastMark.x, y - lastMark.y);
        if (d < size * 2.7) return;
        const a = Math.atan2(y - lastMark.y, x - lastMark.x);
        side = -side; // left paw, right paw
        const ox = Math.cos(a + Math.PI / 2) * size * 0.75 * side;
        const oy = Math.sin(a + Math.PI / 2) * size * 0.75 * side;
        s.marks.push({ ...norm(x + ox, y + oy), r: 1, a, k: 0 });
        lastMark = { x, y };
        playGesture("paw", y / H);
      } else if (s.brush === "stardust") {
        const d = Math.hypot(x - lastMark.x, y - lastMark.y);
        if (d < size * 1.15) return;
        lastMark = { x, y };
        const scatter = () => [x + rnd(-1, 1) * size * 1.5, y + rnd(-1, 1) * size * 1.5] as const;
        const [sx, sy] = scatter();
        s.marks.push({ ...norm(sx, sy), r: rnd(0.55, 1.25), a: rnd(0, Math.PI), k: Math.random() < 0.3 ? 2 : 0 });
        for (let i = 0; i < 2; i++) {
          const [dx, dy] = scatter();
          s.marks.push({ ...norm(dx, dy), r: rnd(0.3, 0.6), a: 0, k: 1 });
        }
        sparkle(sx, sy, s.color, 2, 18); // a couple of live sparkles that fade away
        playGesture("stardust", y / H);
      }
      // yarn and tail are advanced in draw(), so they keep easing even when the cursor pauses
    };

    /** Yarn and tail: the pen is pulled towards the cursor, softly (yarn) or springily (tail). */
    const followStep = (dt: number) => {
      if (!current) return;
      const s = current;
      if (s.brush === "yarn") {
        const k = 1 - Math.exp(-dt * 7);
        pen.x += (cursor.x - pen.x) * k;
        pen.y += (cursor.y - pen.y) * k;
      } else if (s.brush === "tail") {
        // a spring with little friction: it overshoots and swishes, like a tail
        const ax = (cursor.x - pen.x) * 120 - pen.vx * 9;
        const ay = (cursor.y - pen.y) * 120 - pen.vy * 9;
        pen.vx += ax * dt;
        pen.vy += ay * dt;
        pen.x += pen.vx * dt;
        pen.y += pen.vy * dt;
      } else return;
      const last = s.pts[s.pts.length - 1];
      if (Math.hypot(pen.x - last.x * W, pen.y - last.y * H) > 1.6) addPoint(pen.x, pen.y, 1);
    };

    const local = (e: PointerEvent) => {
      const r = canvasEl.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as const;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || drawing) return;
      e.preventDefault();
      try {
        canvasEl.setPointerCapture(e.pointerId); // keep receiving moves even if the pointer leaves the page
      } catch {
        // not available for this pointer: drawing still works
      }
      const [x, y] = local(e);
      drawing = true;
      cleared = null;
      current = { brush: settings.brush, color: settings.color, size: settings.size, pts: [], marks: [] };
      cursor.x = pen.x = x;
      cursor.y = pen.y = y;
      pen.vx = pen.vy = 0;
      lastMark = { x: x - 9999, y }; // so the first paw / star is placed immediately
      lastW = 1;
      if (current.brush === "quill" || current.brush === "yarn" || current.brush === "tail") addPoint(x, y, 1);
      else extend(x, y);
      lastMark = { x, y };
      p.frameRate(60);
    };

    const onMove = (e: PointerEvent) => {
      const [x, y] = local(e);
      if (!drawing) {
        cursor.x = x;
        cursor.y = y;
        return;
      }
      // "coalesced" events are the in-between positions the browser batched up: they make lines smoother
      const batch = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
      if (batch.length) for (const c of batch) extend(...local(c));
      else extend(x, y);
    };

    const onUp = () => {
      if (!drawing || !current) return;
      drawing = false;
      // let the yarn / tail finish catching up with the cursor
      if (current.brush === "yarn" || current.brush === "tail") for (let i = 0; i < 28; i++) followStep(1 / 60);
      const s = current;
      current = null;
      if (s.pts.length || s.marks.length) {
        strokes.push(s);
        redoStack = [];
        drawStroke(p, ink, s, W, H, unit); // add it to the ink layer: now it's permanent
        noticeStroke(cats, s, stage());
        history();
      }
      p.frameRate(30);
    };

    /* ---------- the cats' view of the world ---------- */

    const stage = (): Stage => ({
      W,
      H,
      frame,
      ledgeY,
      topY: frame.y,
      s: catScale,
      drawing,
      cursor: drawing ? cursor : null,
      sparkle: (x, y, color, n) => sparkle(x, y, color, n),
      chime: playChime,
    });

    /* ---------- p5 lifecycle ---------- */

    let canvasEl: HTMLCanvasElement;
    let observer: ResizeObserver;

    p.setup = () => {
      layout();
      p.pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
      const renderer = p.createCanvas(W, H);
      canvasEl = renderer.elt as HTMLCanvasElement;
      canvasEl.style.display = "block";
      // Take the canvas out of the page's layout flow. Otherwise its old height
      // would prop the container open and the page couldn't shrink on resize.
      canvasEl.style.position = "absolute";
      canvasEl.style.inset = "0";
      canvasEl.style.touchAction = "none"; // a finger draws instead of scrolling the page
      p.frameRate(30);
      rebuild();

      canvasEl.addEventListener("pointerdown", onDown);
      canvasEl.addEventListener("pointermove", onMove);
      canvasEl.addEventListener("pointerup", onUp);
      canvasEl.addEventListener("pointercancel", onUp);

      let resizeTimer = 0;
      observer = new ResizeObserver(() => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          if (Math.abs(host.clientWidth - W) > 1 || Math.abs(host.clientHeight - H) > 1) rebuild();
        }, 120);
      });
      observer.observe(host);
      history();
    };

    p.draw = () => {
      const dt = Math.min(0.05, p.deltaTime / 1000);
      const ctx = p.drawingContext as CanvasRenderingContext2D;

      if (drawing) followStep(dt);
      if (!reducedMotion) discAngle += dt * 0.02; // very slow: one turn takes about five minutes

      // 1. the page
      p.image(paper, 0, 0, W, H);

      // 2. the celestial disc
      p.push();
      p.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
      p.rotate(discAngle);
      p.image(disc, -discSize / 2, -discSize / 2, discSize, discSize);
      p.pop();

      // 3. the ink, clipped to the inside of the frame (so it never covers the cats)
      ctx.save();
      ctx.beginPath();
      ctx.rect(frame.x, frame.y, frame.w, frame.h);
      ctx.clip();
      if (glow > 0) {
        // Cast a Spell: a soft, candle-coloured halo swells and fades around every stroke
        const k = Math.sin(Math.PI * Math.min(1, 1 - glow / 1.9));
        ctx.shadowColor = "rgba(206, 168, 92, 0.8)";
        ctx.shadowBlur = 20 * k * unit * p.pixelDensity() + 0.01;
        p.image(ink, 0, 0, W, H);
        ctx.shadowBlur = 0;
        ctx.shadowColor = "transparent";
      } else p.image(ink, 0, 0, W, H);
      if (current) drawStroke(p, p, current, W, H, unit);
      ctx.restore();

      // 4. sparkles
      p.noStroke();
      for (let i = particles.length - 1; i >= 0; i--) {
        const q = particles[i];
        q.life += dt;
        if (q.life >= q.max) {
          particles.splice(i, 1);
          continue;
        }
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.vx *= 0.97;
        q.vy *= 0.97;
        const t = 1 - q.life / q.max;
        const col = p.color(q.color);
        col.setAlpha(255 * t);
        p.fill(col);
        starShape(p, q.x, q.y, q.r * (0.5 + t * 0.7), q.rot + q.life * 2);
      }

      // 5. the cats
      const st = stage();
      updateCats(cats, st, dt);
      drawCats(p, cats, st);

      // spell timing
      if (glow > 0) {
        glow -= dt;
        if (glow <= 0.5 && spellPending) {
          spellPending = false;
          events.onSpellDone();
        }
      }
    };

    /* ---------- the buttons call these ---------- */

    api = {
      undo: () => {
        if (drawing) return;
        if (strokes.length) redoStack.push(strokes.pop()!);
        else if (cleared) {
          strokes = cleared;
          cleared = null;
        } else return;
        repaintInk();
        history();
      },
      redo: () => {
        if (drawing || !redoStack.length) return;
        const s = redoStack.pop()!;
        strokes.push(s);
        drawStroke(p, ink, s, W, H, unit);
        history();
      },
      clear: () => {
        if (drawing || !strokes.length) return;
        cleared = strokes; // "undo" can bring the page back
        strokes = [];
        redoStack = [];
        repaintInk();
        history();
      },
      download: () => p.saveCanvas(canvasEl, "cat-spellbook", "png"),
      castSpell: () => {
        if (glow > 0) return;
        glow = 1.9;
        spellPending = true;
        playSpell();
        // sparkles rise from random places along the drawing
        const spots: [number, number][] = [];
        for (const s of strokes) {
          for (const q of s.pts) spots.push([q.x * W, q.y * H]);
          for (const m of s.marks) spots.push([m.x * W, m.y * H]);
        }
        const n = Math.min(46, spots.length);
        for (let i = 0; i < n; i++) {
          const [x, y] = spots[Math.floor(Math.random() * spots.length)];
          sparkle(x, y, INK.gold, 1, 34);
        }
        if (!spots.length) sparkle(frame.x + frame.w / 2, frame.y + frame.h / 2, INK.gold, 24, 60);
      },
      destroy: () => {
        observer?.disconnect();
        canvasEl?.removeEventListener("pointerdown", onDown);
        canvasEl?.removeEventListener("pointermove", onMove);
        canvasEl?.removeEventListener("pointerup", onUp);
        canvasEl?.removeEventListener("pointercancel", onUp);
        p.remove();
      },
    };
  }, host);

  void instance;
  return api;
}
