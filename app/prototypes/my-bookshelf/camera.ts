/**
 * A Constellation of Stories — the camera for the star map.
 *
 * The camera remembers where you're looking and how close:
 *
 *     position on screen = position on the map × k + (x, y)
 *
 *   k     the zoom (1 = one map unit is one pixel, 2 = twice as big)
 *   x, y  how far the map has been slid across the screen
 *
 * Every time these change, the camera calls `onChange`, and SkyMap.tsx sets
 * ONE CSS transform on the element holding the whole map:
 * `translate(x, y) scale(k)`. React doesn't re-draw anything while you drag
 * or zoom, which keeps it smooth even with hundreds of books.
 *
 * It also knows how to glide: `flyTo()` travels to a spot along a gentle
 * "zoom out, move, zoom back in" path (the van Wijk & Nuij method, also used
 * by d3-zoom), so long journeys across the sky don't feel like a blur.
 */

import type { Box, Point } from "./sky";

export type View = { x: number; y: number; k: number };
/** A spot to look at: the map point to put at the anchor (usually the middle of the screen) and the zoom. */
export type Focus = { x: number; y: number; k: number };
/** Space taken by the page's own panels on each side of the map, in pixels. */
export type Insets = { top: number; right: number; bottom: number; left: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** How much a long flight zooms out on the way (d3 uses √2; lower is calmer). */
const RHO = 1.2;

export class Camera {
  x = 0;
  y = 0;
  k = 1;
  width = 1;
  height = 1;
  minZoom = 0.3;
  maxZoom = 2.8;
  /** The map's contents. The camera won't let them slide (much) off the screen. */
  content: Box | null = null;

  private frame = 0;
  private arrive: ((arrived: boolean) => void) | null = null;
  private zoomGoal: { k: number; ax: number; ay: number } | null = null;
  private onChange: (camera: Camera) => void;

  constructor(onChange: (camera: Camera) => void) {
    this.onChange = onChange;
  }

  get view(): View {
    return { x: this.x, y: this.y, k: this.k };
  }

  /** The screen changed size: keep looking at the same spot. */
  resize(width: number, height: number) {
    if (this.width > 1 && this.height > 1) {
      this.x += (width - this.width) / 2;
      this.y += (height - this.height) / 2;
    }
    this.width = width;
    this.height = height;
    this.set(this.x, this.y, this.k);
  }

  toWorld(screenX: number, screenY: number): Point {
    return { x: (screenX - this.x) / this.k, y: (screenY - this.y) / this.k };
  }

  toScreen(point: Point): Point {
    return { x: point.x * this.k + this.x, y: point.y * this.k + this.y };
  }

  /** Moves the camera right away (no animation), within the zoom limits and keeping the map on screen. */
  set(x: number, y: number, k: number) {
    const zoom = clamp(k, this.minZoom, this.maxZoom);
    let nextX = x;
    let nextY = y;
    const box = this.content;
    if (box) {
      // At least a fifth of the screen always shows part of the map
      nextX = clamp(x, this.width * 0.2 - box.maxX * zoom, this.width * 0.8 - box.minX * zoom);
      nextY = clamp(y, this.height * 0.2 - box.maxY * zoom, this.height * 0.8 - box.minY * zoom);
    }
    this.x = nextX;
    this.y = nextY;
    this.k = zoom;
    this.onChange(this);
  }

  /** Stops any glide, zoom or coasting in progress. */
  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.zoomGoal = null;
    this.arrive?.(false);
    this.arrive = null;
  }

  panBy(dx: number, dy: number) {
    this.stop();
    this.set(this.x + dx, this.y + dy, this.k);
  }

  /** Zooms to `k` right away, keeping the map point under (ax, ay) where it is. */
  zoomAround(ax: number, ay: number, k: number) {
    const zoom = clamp(k, this.minZoom, this.maxZoom);
    const under = this.toWorld(ax, ay);
    this.set(ax - under.x * zoom, ay - under.y * zoom, zoom);
  }

  /**
   * Smooth zoom, for the mouse wheel and the + / − buttons: instead of
   * jumping, the zoom eases towards its goal over a few frames. Each wheel
   * notch moves the goal further, so fast scrolling still feels continuous.
   */
  zoomSmoothly(ax: number, ay: number, factor: number, instant = false) {
    if (instant) {
      this.stop();
      this.zoomAround(ax, ay, this.k * factor);
      return;
    }
    if (!this.zoomGoal) this.stop(); // a glide or coast gives way to the zoom
    const from = this.zoomGoal?.k ?? this.k;
    this.zoomGoal = { k: clamp(from * factor, this.minZoom, this.maxZoom), ax, ay };
    if (!this.frame) this.frame = requestAnimationFrame(this.zoomStep);
  }

  private zoomStep = () => {
    const goal = this.zoomGoal;
    if (!goal) {
      this.frame = 0;
      return;
    }
    const next = this.k + (goal.k - this.k) * 0.24;
    if (Math.abs(goal.k - next) < 0.002) {
      this.zoomAround(goal.ax, goal.ay, goal.k);
      this.zoomGoal = null;
      this.frame = 0;
      return;
    }
    this.zoomAround(goal.ax, goal.ay, next);
    this.frame = requestAnimationFrame(this.zoomStep);
  };

  /** After a drag, the map keeps sliding a little and slows to a stop. Speeds in pixels per millisecond. */
  coast(speedX: number, speedY: number) {
    this.stop();
    // A gentle glide, never a fling: at most 1.2 pixels per millisecond
    const speed = Math.hypot(speedX, speedY);
    const limit = speed > 1.2 ? 1.2 / speed : 1;
    let vx = speedX * limit;
    let vy = speedY * limit;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const friction = Math.pow(0.9, dt / 16);
      vx *= friction;
      vy *= friction;
      if (Math.hypot(vx, vy) < 0.02) {
        this.frame = 0;
        return;
      }
      this.set(this.x + vx * dt, this.y + vy * dt, this.k);
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  /** The zoom and anchor that fit `box` into the screen, leaving `insets` free for the page's panels. */
  framing(box: Box, insets: Insets, maxZoom = this.maxZoom): { focus: Focus; anchor: Point } {
    const width = Math.max(120, this.width - insets.left - insets.right);
    const height = Math.max(120, this.height - insets.top - insets.bottom);
    const k = clamp(Math.min(width / (box.maxX - box.minX), height / (box.maxY - box.minY)), this.minZoom, Math.max(this.minZoom, maxZoom));
    return {
      focus: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2, k },
      anchor: { x: insets.left + width / 2, y: insets.top + height / 2 },
    };
  }

  /**
   * Glides until map point (focus.x, focus.y) sits at `anchor` on screen,
   * at zoom focus.k. Resolves with true when it arrives, or false if
   * something else (a drag, a wheel, another glide) interrupted it.
   * duration: in milliseconds; leave it out to suit the distance, 0 to jump.
   */
  flyTo(focus: Focus, options: { anchor?: Point; duration?: number } = {}): Promise<boolean> {
    this.stop();
    const anchor = options.anchor ?? { x: this.width / 2, y: this.height / 2 };
    const k1 = clamp(focus.k, this.minZoom, this.maxZoom);
    const jump = () => {
      this.set(anchor.x - focus.x * k1, anchor.y - focus.y * k1, k1);
      return Promise.resolve(true);
    };

    // The journey is worked out in "how much of the map is visible" (w = width ÷ zoom)
    const from = this.toWorld(anchor.x, anchor.y);
    const path = zoomPath({ ...from, w: this.width / this.k }, { x: focus.x, y: focus.y, w: this.width / k1 });
    if (options.duration === 0 || !Number.isFinite(path.length) || path.length < 0.01) return jump();
    const duration = options.duration ?? clamp(path.length * 560, 480, 1500);

    return new Promise((resolve) => {
      this.arrive = resolve;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const spot = path.at(easeInOut(t));
        const k = this.width / spot.w;
        this.set(anchor.x - spot.x * k, anchor.y - spot.y * k, k);
        if (t < 1) {
          this.frame = requestAnimationFrame(step);
        } else {
          this.frame = 0;
          this.arrive = null;
          resolve(true);
        }
      };
      this.frame = requestAnimationFrame(step);
    });
  }
}

type Spot = { x: number; y: number; w: number };

/**
 * The smooth zoom-and-pan path from J. van Wijk & W. Nuij, "Smooth and
 * efficient zooming and panning" (2003). `at(t)` gives the spot at time t
 * (0 to 1); `length` says how long the journey is, to choose a duration.
 */
function zoomPath(from: Spot, to: Spot): { length: number; at: (t: number) => Spot } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distanceSquared = dx * dx + dy * dy;
  const rho2 = RHO * RHO;
  const rho4 = rho2 * rho2;

  // Not moving, only zooming
  if (distanceSquared < 1e-6) {
    const length = Math.log(to.w / from.w) / RHO;
    return {
      length: Math.abs(length),
      at: (t) => ({ x: from.x + t * dx, y: from.y + t * dy, w: from.w * Math.exp(RHO * t * length) }),
    };
  }

  const d = Math.sqrt(distanceSquared);
  const b0 = (to.w * to.w - from.w * from.w + rho4 * distanceSquared) / (2 * from.w * rho2 * d);
  const b1 = (to.w * to.w - from.w * from.w - rho4 * distanceSquared) / (2 * to.w * rho2 * d);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const length = (r1 - r0) / RHO;
  return {
    length,
    at: (t) => {
      const s = t * length;
      const coshR0 = Math.cosh(r0);
      const u = (from.w / (rho2 * d)) * (coshR0 * Math.tanh(RHO * s + r0) - Math.sinh(r0));
      return { x: from.x + u * dx, y: from.y + u * dy, w: (from.w * coshR0) / Math.cosh(RHO * s + r0) };
    },
  };
}
