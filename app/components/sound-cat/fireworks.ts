/**
 * Sound-Sensitive Cat — the magic fireworks.
 *
 * A short burst of paw prints, stars, sparkles and glowing dots around the
 * cat. It borrows the look of the Catnip Fireworks prototype (the same paw
 * print and star shapes, the same cat-fur palette) but draws with the plain
 * canvas 2D API instead of PixiJS. A burst is only ~80 particles, and this
 * way the homepage doesn't have to load PixiJS just for this.
 *
 * Every particle gets a slightly random direction and speed. On each frame
 * it moves, falls with gravity, slows down a little (air drag), spins, and
 * fades out near the end of its life. After about 1.6 seconds they're all
 * gone and the drawing loop stops by itself.
 */

/** The homepage cat palette, plus the site's lavender and a soft magenta for the magic. */
const PALETTE = ["#f0893d", "#ec8e85", "#f3c04a", "#f2c230", "#8f82c4", "#e97fc7", "#fffaf2"];

/* ---------- Tuning ---------- */
const COUNT = 80; // particles per burst
const GRAVITY = 650; // px per second²
const DRAG = 1.2; // share of speed lost per second
const LONGEST_LIFE = 1.6; // seconds

type Kind = "paw" | "star" | "sparkle" | "glow";

type Spark = {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  colour: string;
  age: number;
  life: number;
};

const random = (low: number, high: number) => low + Math.random() * (high - low);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

/* ---------- The four shapes, each drawn around (0, 0) at `size` px ---------- */

function drawPaw(ctx: CanvasRenderingContext2D, size: number) {
  // One big pad and four toe beans (the same layout as Catnip Fireworks)
  const s = size / 64;
  ctx.beginPath();
  ctx.ellipse(0, 8 * s, 15 * s, 12.5 * s, 0, 0, Math.PI * 2);
  for (const [x, y] of [[-19, -8], [-8, -19], [8, -19], [19, -8]]) {
    ctx.moveTo(x * s + 6 * s, y * s);
    ctx.ellipse(x * s, y * s, 6 * s, 7.5 * s, 0, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, size: number) {
  const outer = size / 2;
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

/** A four-pointed twinkle, like the little stars in the homepage's night sky. */
function drawSparkle(ctx: CanvasRenderingContext2D, size: number) {
  const r = size / 2;
  const w = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(w, -w, r, 0);
  ctx.quadraticCurveTo(w, w, 0, r);
  ctx.quadraticCurveTo(-w, w, -r, 0);
  ctx.quadraticCurveTo(-w, -w, 0, -r);
  ctx.fill();
}

function drawGlow(ctx: CanvasRenderingContext2D, size: number, colour: string) {
  ctx.shadowColor = colour;
  ctx.shadowBlur = size * 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/* ---------- The burst ---------- */

type Options = {
  /** Where the burst starts, in px from the top-left of the canvas. */
  x: number;
  y: number;
  /** For visitors who prefer less motion: sparkles fade in and out where they are, nothing flies. */
  reducedMotion: boolean;
};

/**
 * Plays one burst on `canvas` (which should cover the screen, see
 * SoundCat.module.css). Returns a function that stops it early.
 */
export function burstFireworks(canvas: HTMLCanvasElement, { x, y, reducedMotion }: Options): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  // Match the canvas to the screen, sharp on high-resolution displays
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);

  const sparks: Spark[] = [];
  for (let i = 0; i < (reducedMotion ? 14 : COUNT); i++) {
    const kind: Kind = pick(["paw", "paw", "star", "star", "sparkle", "sparkle", "glow"]);
    const spark: Spark = {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      size: kind === "paw" ? random(11, 18) : kind === "star" ? random(10, 17) : kind === "sparkle" ? random(10, 20) : random(4, 7),
      angle: random(0, Math.PI * 2),
      spin: random(-5, 5),
      colour: pick(PALETTE),
      age: 0,
      life: random(0.9, LONGEST_LIFE),
    };
    if (reducedMotion) {
      // Scattered in a ring around the cat; they only fade, they don't move
      const around = random(0, Math.PI * 2);
      const distance = random(40, 110);
      spark.x = x + Math.cos(around) * distance;
      spark.y = y + Math.sin(around) * distance * 0.7;
      spark.spin = 0;
      spark.life = random(1.1, 1.5);
    } else {
      // Mostly upwards and sideways, like a firework (straight up is -90°)
      const direction = -Math.PI / 2 + random(-1, 1) * Math.PI * 0.75;
      const speed = random(140, 460);
      spark.vx = Math.cos(direction) * speed;
      spark.vy = Math.sin(direction) * speed - 120; // an extra upward kick
    }
    sparks.push(spark);
  }

  let frame = 0;
  let last = performance.now();

  const draw = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = 0;
    for (const p of sparks) {
      p.age += dt;
      if (p.age >= p.life) continue;
      alive++;

      if (!reducedMotion) {
        p.vy += GRAVITY * dt;
        const slow = Math.exp(-DRAG * dt);
        p.vx *= slow;
        p.vy *= slow;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
      }

      // Fully visible for the first part of its life, then fading away.
      // (With reduced motion: fade in, then out, in place.)
      const t = p.age / p.life;
      const alpha = reducedMotion ? Math.sin(Math.PI * t) : t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;
      // Pop in over the first 80 ms instead of appearing at full size
      const grow = reducedMotion ? 1 : Math.min(1, p.age / 0.08);
      // Sparkles twinkle: they pulse in size as they go
      const twinkle = p.kind === "sparkle" ? 0.75 + 0.25 * Math.sin(p.age * 18 + p.size) : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.colour;
      const size = p.size * grow * twinkle;
      if (p.kind === "paw") drawPaw(ctx, size);
      else if (p.kind === "star") drawStar(ctx, size);
      else if (p.kind === "sparkle") drawSparkle(ctx, size);
      else drawGlow(ctx, size, p.colour);
      ctx.restore();
    }

    if (alive > 0) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height); // all done: the loop stops here
  };
  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
