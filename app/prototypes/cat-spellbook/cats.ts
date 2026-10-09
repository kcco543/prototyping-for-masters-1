/**
 * The spellbook cats.
 *
 * Three small vector cats live ON the page's border, never on the drawing:
 *  - two "walkers" sit on the bottom border and can stroll along it,
 *  - one "lounger" lies on the top edge with its tail hanging down.
 *
 * Each has its own coat, so they read as three characters:
 *  - the pink one has a cream chest and a cream tip to its tail,
 *  - the sage one is a tabby, with stripes,
 *  - the midnight one is a piece of the night sky: gold outline, a
 *    crescent on its forehead and a few stars in its fur.
 *
 * Behaviour is a small state machine, kept subtle and random:
 *   rest → notice (looks at a new stroke) → walk (to stand under it)
 *        → tap (paws up at it) → home (walks back) → rest
 * While you are drawing, the cats stay put and only watch the cursor.
 */

import type p5 from "p5";
import { INK, starShape, type Stroke, strokeEnd } from "./brushes";

type Mode = "rest" | "notice" | "walk" | "tap" | "home";

export type Cat = {
  kind: "walker" | "lounger";
  color: string;
  /** the markings on its fur */
  coat: "tipped" | "tabby" | "starry";
  /** home position as a fraction of the page width */
  homeX: number;
  x: number; // current x in px
  dir: 1 | -1;
  mode: Mode;
  timer: number; // seconds left in the current mode
  /** what it's looking at (px), or null */
  look: { x: number; y: number } | null;
  target: { x: number; y: number; brush: Stroke["brush"] } | null;
  blink: number; // seconds left of the current blink
  nextBlink: number;
  swish: number; // seconds left of tail swishing
  nextFidget: number;
  taps: number;
  phase: number;
};

/** The parts of the page the cats need to know about. */
export type Stage = {
  W: number;
  H: number;
  /** the drawable area inside the tarot border */
  frame: { x: number; y: number; w: number; h: number };
  /** y of the bottom border line the walkers stand on, and of the frame's top edge */
  ledgeY: number;
  topY: number;
  /** cat scale */
  s: number;
  /** is the user drawing right now? and where is the cursor? */
  drawing: boolean;
  cursor: { x: number; y: number } | null;
  /** callbacks */
  sparkle: (x: number, y: number, color: string, n: number) => void;
  chime: (yNorm: number) => void;
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function createCats(): Cat[] {
  const make = (kind: Cat["kind"], color: string, coat: Cat["coat"], homeX: number, dir: 1 | -1): Cat => ({
    kind,
    color,
    coat,
    homeX,
    x: -1,
    dir,
    mode: "rest",
    timer: 0,
    look: null,
    target: null,
    blink: 0,
    nextBlink: rnd(1, 5),
    swish: 0,
    nextFidget: rnd(4, 10),
    taps: 0,
    phase: Math.random() * 10,
  });
  return [make("walker", INK.pink, "tipped", 0.13, 1), make("walker", INK.sage, "tabby", 0.87, -1), make("lounger", INK.midnight, "starry", 0.8, -1)];
}

/** Called when a stroke is finished: maybe a cat notices it. */
export function noticeStroke(cats: Cat[], stroke: Stroke, st: Stage) {
  const end = strokeEnd(stroke);
  if (!end || Math.random() > 0.65) return; // not every stroke is interesting
  const resting = cats.filter((c) => c.mode === "rest");
  if (!resting.length) return;
  // yarn and stars are for the walkers; anything else, anyone may glance at
  const playful = stroke.brush === "yarn" || stroke.brush === "stardust";
  const pool = playful ? resting.filter((c) => c.kind === "walker") : resting;
  const cat = (pool.length ? pool : resting)[Math.floor(Math.random() * (pool.length || resting.length))];
  const px = end.x * st.W; // stroke positions are fractions of the whole page
  const py = end.y * st.H;
  cat.look = { x: px, y: py };
  cat.mode = "notice";
  cat.timer = rnd(1.0, 1.8);
  cat.swish = 1.2;
  cat.target = playful && cat.kind === "walker" && Math.random() < 0.75 ? { x: px, y: py, brush: stroke.brush } : null;
}

export function updateCats(cats: Cat[], st: Stage, dt: number) {
  const minX = st.frame.x + 34 * st.s;
  const maxX = st.frame.x + st.frame.w - 34 * st.s;
  for (const c of cats) {
    if (c.x < 0) c.x = c.homeX * st.W;
    c.phase += dt;

    // blinking (always, a little)
    c.nextBlink -= dt;
    if (c.nextBlink <= 0) {
      c.blink = 0.14;
      c.nextBlink = rnd(2.5, 7);
    }
    c.blink = Math.max(0, c.blink - dt);
    c.swish = Math.max(0, c.swish - dt);

    // While you draw: nobody moves; they just watch the cursor.
    if (st.drawing) {
      c.look = st.cursor;
      continue;
    }

    const walkTo = (tx: number, speed: number) => {
      const goal = Math.max(minX, Math.min(maxX, tx));
      const d = goal - c.x;
      if (Math.abs(d) < 2) return true;
      c.dir = d > 0 ? 1 : -1;
      c.x += Math.sign(d) * Math.min(Math.abs(d), speed * st.s * dt);
      return false;
    };

    switch (c.mode) {
      case "rest": {
        c.nextFidget -= dt;
        if (c.nextFidget <= 0) {
          // an occasional small fidget: a tail swish, or a glance somewhere
          c.nextFidget = rnd(6, 14);
          if (Math.random() < 0.6) c.swish = rnd(0.8, 1.6);
          else {
            c.look = { x: rnd(st.frame.x, st.frame.x + st.frame.w), y: rnd(st.frame.y, st.frame.y + st.frame.h) };
            c.mode = "notice";
            c.timer = rnd(0.8, 1.4);
            c.target = null;
          }
        }
        break;
      }
      case "notice": {
        c.timer -= dt;
        if (c.timer <= 0) {
          if (c.target) c.mode = "walk";
          else {
            c.mode = "rest";
            c.look = null;
          }
        }
        break;
      }
      case "walk": {
        // stand a little to one side of the target, so the paw reaches up at it
        if (walkTo(c.target!.x - c.dir * 14 * st.s, 70)) {
          c.mode = "tap";
          c.taps = 3;
          c.timer = 0.5;
          c.dir = c.target!.x >= c.x ? 1 : -1;
        }
        break;
      }
      case "tap": {
        c.timer -= dt;
        if (c.timer <= 0) {
          if (c.taps > 0) {
            c.taps--;
            c.timer = 0.55;
            const t = c.target!;
            // the tap sends a little sparkle up to the star / thread, and a soft note
            st.sparkle(t.x, t.y, t.brush === "stardust" ? INK.gold : c.color, t.brush === "stardust" ? 5 : 3);
            st.chime(t.y / st.H);
          } else {
            c.mode = "home";
            c.target = null;
            c.look = null;
          }
        }
        break;
      }
      case "home": {
        if (walkTo(c.homeX * st.W, 60)) {
          c.mode = "rest";
          c.dir = c.homeX < 0.5 ? 1 : -1;
          c.nextFidget = rnd(6, 12);
        }
        break;
      }
    }
  }
}

/* ---------- Drawing ---------- */

// A few colours mixed once from the palette, for markings
const CREAM = "#f6eedd"; // chest and tail tip
const BLUSH = "rgba(186, 104, 112, 0.38)"; // rosy cheeks
const TABBY = "#6f8770"; // the sage cat's stripes
const EAR = "rgba(214, 160, 160, 0.9)"; // the inside of an ear

type Curve = [number, number, number, number, number, number, number, number];

/**
 * A tail: a fat line in the coat colour, with a slightly fatter line in
 * the outline colour underneath it (which leaves a thin outline showing),
 * and then the coat's markings on top.
 */
function tail(p: p5, c: Cat, outline: string, curve: Curve) {
  const [x1, y1, x2, y2, x3, y3, x4, y4] = curve;
  // a point part-way along the tail (t = 0 at the body, 1 at the tip)
  const at = (t: number) => [p.bezierPoint(x1, x2, x3, x4, t), p.bezierPoint(y1, y2, y3, y4, t)] as const;
  p.noFill();
  p.stroke(outline);
  p.strokeWeight(9.4);
  p.bezier(...curve);
  p.stroke(c.color);
  p.strokeWeight(7);
  p.bezier(...curve);

  if (c.coat === "tipped") {
    // a cream tip
    p.stroke(CREAM);
    p.beginShape();
    for (let t = 0.8; t <= 1.001; t += 0.05) p.vertex(...at(t));
    p.endShape();
  } else if (c.coat === "tabby") {
    // three stripes across the tail
    p.stroke(TABBY);
    p.strokeWeight(1.7);
    for (const t of [0.42, 0.62, 0.82]) {
      const [x, y] = at(t);
      const a = Math.atan2(p.bezierTangent(y1, y2, y3, y4, t), p.bezierTangent(x1, x2, x3, x4, t)) + Math.PI / 2;
      p.line(x - Math.cos(a) * 2.6, y - Math.sin(a) * 2.6, x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6);
    }
  } else {
    // two small stars
    p.noStroke();
    p.fill(INK.gold);
    p.circle(...at(0.45), 1.6);
    starShape(p, ...at(0.75), 2.2, 0);
  }
}

/** Markings on the body. `spots` are [x, y, size] in the cat's own coordinates. */
function stars(p: p5, spots: [number, number, number][]) {
  p.noStroke();
  p.fill(INK.gold);
  for (const [x, y, r] of spots) {
    if (r < 1.2) p.circle(x, y, r * 1.6);
    else starShape(p, x, y, r, 0);
  }
}

function face(p: p5, c: Cat, hx: number, hy: number, lookX: number, lookY: number, dark: boolean) {
  const line = dark ? INK.gold : INK.midnight;
  // ears, head
  p.triangle(hx - 13, hy - 9, hx - 10, hy - 23, hx - 1, hy - 13);
  p.triangle(hx + 2, hy - 13, hx + 11, hy - 23, hx + 13, hy - 8);
  p.ellipse(hx, hy, 32, 27);
  // the soft inside of each ear
  p.noStroke();
  p.fill(EAR);
  p.triangle(hx - 11, hy - 12.5, hx - 9.4, hy - 19.5, hx - 4.6, hy - 14);
  p.triangle(hx + 5.4, hy - 14, hx + 10.4, hy - 19.5, hx + 11, hy - 11.5);

  // forehead: tabby stripes, or a crescent moon
  p.noFill();
  if (c.coat === "tabby") {
    p.stroke(TABBY);
    p.strokeWeight(1.4);
    p.line(hx - 3.2, hy - 12, hx - 2.8, hy - 8.4);
    p.line(hx + 0.5, hy - 12.8, hx + 0.5, hy - 8.2);
    p.line(hx + 4.2, hy - 12, hx + 3.8, hy - 8.4);
  } else if (c.coat === "starry") {
    p.stroke(INK.gold);
    p.strokeWeight(1.2);
    p.arc(hx + 0.5, hy - 9, 5.5, 5.5, Math.PI * 0.55, Math.PI * 1.75);
  }
  if (!dark) {
    p.noStroke();
    p.fill(BLUSH);
    p.ellipse(hx - 9.5, hy + 3.6, 5.5, 3.4);
    p.ellipse(hx + 10.5, hy + 3.6, 5.5, 3.4);
  }

  // eyes (they shift a little towards whatever the cat is looking at)
  if (c.blink > 0) {
    p.noFill();
    p.stroke(line);
    p.strokeWeight(1.2);
    p.arc(hx - 5.5 + lookX, hy - 1.8 + lookY, 5, 3.4, 0.2, Math.PI - 0.2);
    p.arc(hx + 6.5 + lookX, hy - 1.8 + lookY, 5, 3.4, 0.2, Math.PI - 0.2);
  } else {
    p.noStroke();
    p.fill(dark ? INK.gold : INK.midnight);
    p.ellipse(hx - 5.5 + lookX, hy - 1 + lookY, 4, 5);
    p.ellipse(hx + 6.5 + lookX, hy - 1 + lookY, 4, 5);
    // a speck of light in each eye
    p.fill(dark ? INK.midnight : CREAM);
    p.circle(hx - 4.8 + lookX, hy - 2 + lookY, 1.3);
    p.circle(hx + 7.2 + lookX, hy - 2 + lookY, 1.3);
  }
  // nose, a small smile, and whiskers
  const nx = hx + 0.5 + lookX * 0.6;
  p.noStroke();
  p.fill(c.coat === "tipped" ? INK.midnight : INK.pink);
  p.triangle(nx - 1.7, hy + 4, nx + 1.7, hy + 4, nx, hy + 6.2);
  p.noFill();
  p.stroke(line);
  p.strokeWeight(0.8);
  p.arc(nx - 1.7, hy + 6.3, 3.4, 2.8, 0.1, Math.PI * 0.9);
  p.arc(nx + 1.7, hy + 6.3, 3.4, 2.8, Math.PI * 0.1, Math.PI - 0.1);
  p.line(hx + 9, hy + 5, hx + 20, hy + 3);
  p.line(hx + 9, hy + 7, hx + 19, hy + 9);
  p.line(hx - 8, hy + 5, hx - 19, hy + 3);
  p.line(hx - 8, hy + 7, hx - 18, hy + 9);
}

function drawCat(p: p5, c: Cat, st: Stage) {
  const s = st.s;
  const dark = c.color === INK.midnight;
  const outline = dark ? INK.gold : INK.midnight;
  const groundY = c.kind === "walker" ? st.ledgeY : st.topY;

  // which way are the eyes drawn? (towards what the cat is looking at)
  let lookX = 0;
  let lookY = 0;
  if (c.look) {
    const dx = (c.look.x - c.x) * c.dir; // in the cat's own facing direction
    const dy = c.look.y - (groundY - 55 * s);
    const d = Math.hypot(dx, dy) || 1;
    lookX = (dx / d) * 2.2;
    lookY = (dy / d) * 1.6;
  }
  const sway = c.swish > 0 ? Math.sin(c.phase * 9) * 5 * Math.min(1, c.swish) : 0;
  const moving = !st.drawing && (c.mode === "walk" || c.mode === "home");
  const step = moving ? Math.sin(c.phase * 11) : 0;
  /** switch back to "coat colour with an outline" after drawing markings */
  const coat = () => {
    p.fill(c.color);
    p.stroke(outline);
    p.strokeWeight(1.2);
  };

  p.push();
  p.translate(c.x, groundY);
  p.scale(s * c.dir, s);
  p.strokeJoin(p.ROUND);
  p.strokeCap(p.ROUND);

  if (c.kind === "lounger") {
    // lying along the top edge, tail hanging down over the border
    tail(p, c, outline, [-30, -8, -46, -6, -48, 16 + sway, -40, 26 + sway * 1.4]);
    coat();
    p.ellipse(0, -13, 72, 27);
    stars(p, [[-18, -15, 2.6], [-3, -8, 1.7], [10, -19, 2], [-27, -9, 1], [-9, -21, 0.9], [6, -6, 0.9]]);
    coat();
    p.ellipse(22, -3, 15, 8); // tucked front paws
    p.ellipse(34, -3, 15, 8);
    face(p, c, 34, -24, lookX, lookY, dark);
  } else if (moving) {
    // walking pose
    p.noStroke();
    p.fill(31, 42, 74, 20);
    p.ellipse(0, 1.5, 58, 5); // a little shadow on the border
    tail(p, c, outline, [-28, -30, -44, -34, -47, -56, -39, -64]);
    coat();
    for (const [lx, ph] of [[-18, 1], [-8, -1], [10, -1], [20, 1]] as const) {
      p.push();
      p.translate(lx, -18);
      p.rotate(step * 0.45 * ph);
      p.rect(-3.5, 0, 7, 18, 3.5);
      p.pop();
    }
    p.ellipse(0, -30, 62, 30);
    if (c.coat === "tabby") {
      p.stroke(TABBY);
      p.strokeWeight(1.7);
      for (const x of [-15, -6, 3, 12]) p.line(x, -44.5 + Math.abs(x) * 0.12, x - 1, -38.5);
      coat();
    }
    face(p, c, 30, -44 + Math.abs(step) * 1.2, lookX, lookY, dark);
  } else {
    // sitting pose
    const tapping = c.mode === "tap" && !st.drawing;
    const lift = tapping ? Math.max(0, Math.sin((0.55 - c.timer) * (Math.PI / 0.55))) : 0;
    p.noStroke();
    p.fill(31, 42, 74, 20);
    p.ellipse(-3, 1.5, 54, 5); // a little shadow on the border
    tail(p, c, outline, [-14, -6, -34, -4, -37, -28 + sway, -27, -38 + sway]);
    coat();
    p.ellipse(0, -24, 41, 49);
    if (c.coat === "tabby") {
      // stripes on its back
      p.stroke(TABBY);
      p.strokeWeight(1.7);
      p.line(-18.5, -33, -12.5, -31);
      p.line(-20, -25, -13.5, -24.5);
      p.line(-18.8, -17, -12.8, -18);
    } else {
      // a cream chest, with a gold star for a charm
      p.noStroke();
      p.fill(CREAM);
      p.ellipse(6, -27, 17, 24);
      p.fill(INK.gold);
      starShape(p, 8, -35, 2.6, 0);
    }
    coat();
    // front paws: one stays down, one may reach up to tap
    p.ellipse(4, -3, 11, 7);
    if (tapping) {
      p.push();
      p.translate(14, -30);
      p.rotate(-0.9 - lift * 0.9);
      p.rect(-3.5, -22, 7, 24, 3.5);
      p.pop();
    } else p.ellipse(15, -3, 11, 7);
    const tilt = c.mode === "notice" ? -2.5 : 0;
    face(p, c, 9, -56 + tilt - lift * 2, lookX, lookY - (tapping ? 1 : 0), dark);
  }
  p.pop();

  // a small twinkle over a cat's head when it first notices something
  if (c.mode === "notice" && c.target && c.timer > 0.5 && !st.drawing) {
    const pulse = 1 + Math.sin(c.phase * 9) * 0.2;
    p.noStroke();
    p.fill(INK.gold);
    starShape(p, c.x + c.dir * 25 * s, groundY - 86 * s, 5.5 * s * pulse, 0);
    starShape(p, c.x + c.dir * 34 * s, groundY - 77 * s, 2.4 * s, 0);
  }
}

export function drawCats(p: p5, cats: Cat[], st: Stage) {
  for (const c of cats) if (c.x >= 0) drawCat(p, c, st);
}
