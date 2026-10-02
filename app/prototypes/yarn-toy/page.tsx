"use client";

/**
 * Yarn Toy
 *
 * A ball of yarn dangles from the top of the screen on a long, floppy string.
 * Move your mouse and the ball follows it on a springy pull. Bring it close
 * to the cat paw at the bottom and the paw swats it away.
 *
 * How it works:
 * 1. THE STRING IS A CHAIN OF POINTS. We simulate ~30 points with "Verlet
 *    integration": each point remembers where it was last frame, and the gap
 *    between then and now is its speed. Gravity pulls every point down, then
 *    we nudge neighbouring points back to a fixed distance apart, many times
 *    per frame. That is what makes the string floppy but not stretchy.
 * 2. THE STRING IS DRAWN WITH A MeshRope. A MeshRope takes a texture and bends
 *    it along a list of points, so we hand it the simulated points every
 *    frame. The yarn texture (twisted strands) is painted once on a <canvas>
 *    and repeated along the rope.
 * 3. THE BALL IS PULLED BY A SPRING. The last point (the ball) is heavier, and
 *    while the pointer is on the page a spring pulls it toward the pointer.
 *    Springs overshoot, which gives the bouncy, swinging follow.
 * 4. THE PAW IS A TINY STATE MACHINE: idle (stalks the ball) → wind-up →
 *    strike (reaches toward the ball) → retract → short rest. If the paw
 *    touches the ball during a strike, the ball gets a push (an "impulse").
 *
 * Keyboard and screen readers: focus the play area with Tab, move an
 * invisible "hand" with the arrow keys, press Space to flick the yarn, and
 * Escape to let go. Each swat is announced (at most every few seconds).
 */

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import BackHome from "../../components/back-home/BackHome";
import { caveat, instrumentSans } from "../../fonts";
import styles from "./styles.module.css";

/* ---------- Palette (from the homepage cats) ---------- */
const INK = 0x2b2725;
const YARN = "#c9653f";
const YARN_DARK = "#a14a2a";
const YARN_LIGHT = "#e08a63";
const ORANGE = 0xf0893d;
const ORANGE_DARK = 0xcd5f26;
const PAD = 0xec8e85;

/* ---------- Physics settings (CSS pixels and seconds) ---------- */
const SEGMENTS = 30; // number of links in the string
const GRAVITY = 1700; // px/s², downward pull
const DAMPING = 0.996; // 1 = no air resistance, lower = slows down faster
const SPRING = 55; // how hard the ball is pulled toward the pointer
const SPRING_DAMP = 0.975; // extra calm-down for the ball while it's following
const ITERATIONS = 24; // how many times per step we fix the link lengths
const BALL_RADIUS = 32;
const BALL_INV_MASS = 0.25; // lower = heavier (string points are 1)

/* ---------- Paw settings ---------- */
const ARM = 230; // arm length, from its base (off-screen) to the paw centre
const PAW_RADIUS = 30;
const REACH = 210; // the paw swats when the ball comes this close to it
const SWAT_SPEED = 1150; // px/s given to the ball on a hit

type Pt = { x: number; y: number; px: number; py: number; inv: number };
type PawState = "idle" | "windup" | "strike" | "hold" | "retract";

/** Paints a short piece of twisted yarn. MeshRope repeats it along the string. */
function makeYarnCanvas() {
  const c = document.createElement("canvas");
  c.width = 128; // power-of-two sizes repeat cleanly on the GPU
  c.height = 32;
  const g = c.getContext("2d")!;
  g.fillStyle = YARN;
  g.fillRect(0, 0, 128, 32);
  // Diagonal strands, like plied yarn. Each strand repeats every 16px.
  g.lineCap = "round";
  for (let x = -32; x < 160; x += 16) {
    g.strokeStyle = YARN_DARK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, 32);
    g.lineTo(x + 20, 0);
    g.stroke();
    g.strokeStyle = YARN_LIGHT;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + 7, 32);
    g.lineTo(x + 27, 0);
    g.stroke();
  }
  // Soft shading on the edges so the string looks round
  const shade = g.createLinearGradient(0, 0, 0, 32);
  shade.addColorStop(0, "rgba(0,0,0,0.22)");
  shade.addColorStop(0.35, "rgba(0,0,0,0)");
  shade.addColorStop(0.65, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.25)");
  g.fillStyle = shade;
  g.fillRect(0, 0, 128, 32);
  return c;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function YarnToy() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [swats, setSwats] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  // Shared with the PixiJS code: keyboard actions call these
  const controls = useRef<{
    moveHand: (dx: number, dy: number) => void;
    flick: () => void;
    letGo: () => void;
  } | null>(null);

  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const { Application, Container, Graphics, MeshRope, Point, Text, Texture } = await import("pixi.js");

      const app = new Application();
      await app.init({
        resizeTo: host,
        backgroundAlpha: 0, // the sky-blue background is CSS
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: "webgl",
      });
      if (cancelled) {
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
        return;
      }
      app.canvas.classList.add(styles.canvas);
      app.canvas.setAttribute("aria-hidden", "true");
      host.appendChild(app.canvas);

      const W = () => app.screen.width;
      const H = () => app.screen.height;

      // ----- 1. The string's simulated points, hanging straight down
      const ropeLength = () => Math.max(220, Math.min(H() * 0.62, 620));
      let seg = ropeLength() / SEGMENTS;
      const pts: Pt[] = Array.from({ length: SEGMENTS + 1 }, (_, i) => {
        const x = W() / 2;
        const y = -10 + i * seg;
        return { x, y, px: x, py: y, inv: i === 0 ? 0 : i === SEGMENTS ? BALL_INV_MASS : 1 };
      });
      const ball = pts[SEGMENTS];

      // ----- 2. The string: a MeshRope bent along those points
      const yarnTexture = Texture.from(makeYarnCanvas());
      const ropePoints = pts.map((p) => new Point(p.x, p.y));
      const rope = new MeshRope({ texture: yarnTexture, points: ropePoints, width: 11, textureScale: 0.5 });
      app.stage.addChild(rope);

      // ----- 3. The ball of yarn: a circle with wound strands, rotates as it moves
      const ballArt = new Graphics();
      ballArt.circle(0, 0, BALL_RADIUS).fill(YARN);
      // wound strands: arcs criss-crossing the ball
      const strands: [number, number, number, string, number][] = [
        [-0.5, 1.2, 0.95, YARN_DARK, 3],
        [0.9, 2.6, 0.8, YARN_DARK, 3],
        [2.2, 4.0, 0.9, YARN_LIGHT, 2.5],
        [3.6, 5.3, 0.7, YARN_DARK, 2.5],
        [4.6, 6.4, 0.55, YARN_LIGHT, 2],
      ];
      for (const [start, end, r, color, w] of strands) {
        ballArt.arc(0, 0, BALL_RADIUS * r, start, end).stroke({ width: w, color, cap: "round" });
      }
      for (let i = 0; i < 5; i++) {
        const y = -BALL_RADIUS * 0.7 + i * BALL_RADIUS * 0.35;
        const half = Math.sqrt(BALL_RADIUS ** 2 - y ** 2) * 0.9;
        ballArt
          .moveTo(-half, y)
          .quadraticCurveTo(0, y + 8, half, y)
          .stroke({ width: 2, color: i % 2 ? YARN_LIGHT : YARN_DARK, alpha: 0.85 });
      }
      ballArt.circle(0, 0, BALL_RADIUS).stroke({ width: 1.5, color: YARN_DARK });
      app.stage.addChild(ballArt);

      // ----- 4. The cat paw: an orange tabby arm reaching up from below
      const paw = new Container();
      const arm = new Graphics()
        .roundRect(-27, -ARM + 6, 54, ARM + 80, 27)
        .fill(ORANGE);
      for (let i = 0; i < 4; i++) {
        // tabby stripes across the arm
        const y = -ARM + 70 + i * 34;
        arm.moveTo(-27, y).quadraticCurveTo(0, y + 9, 27, y).stroke({ width: 4, color: ORANGE_DARK, cap: "round" });
      }
      const hand = new Graphics()
        .ellipse(0, -ARM, PAW_RADIUS + 4, PAW_RADIUS)
        .fill(ORANGE)
        // the pink toe beans and big pad (the paw is "palm up", ready to swat)
        .ellipse(0, -ARM + 9, 13, 10)
        .fill(PAD);
      for (const [x, y] of [[-19, -ARM - 9], [-7, -ARM - 18], [7, -ARM - 18], [19, -ARM - 9]]) {
        hand.ellipse(x, y, 5.5, 6.5).fill(PAD);
      }
      // thin dark toe lines, like the homepage drawings
      hand
        .moveTo(-12, -ARM - PAW_RADIUS + 2).lineTo(-11, -ARM - PAW_RADIUS + 9)
        .moveTo(0, -ARM - PAW_RADIUS).lineTo(0, -ARM - PAW_RADIUS + 8)
        .moveTo(12, -ARM - PAW_RADIUS + 2).lineTo(11, -ARM - PAW_RADIUS + 9)
        .stroke({ width: 1.4, color: INK, cap: "round" });
      paw.addChild(arm, hand);
      app.stage.addChild(paw);

      // "swat!" word that pops up on a hit, in the homepage's hand-lettered font
      const swatText = new Text({
        text: "swat!",
        style: { fontFamily: caveat.style.fontFamily, fontSize: 40, fontWeight: "700", fill: INK },
        anchor: 0.5,
      });
      swatText.alpha = 0;
      app.stage.addChild(swatText);
      let swatTextAge = 99;

      // Ring that shows the keyboard "hand" (only while using the keyboard)
      const handRing = new Graphics().circle(0, 0, 12).stroke({ width: 2.5, color: INK, alpha: 0.7 });
      handRing.visible = false;
      app.stage.addChild(handRing);

      // ----- 5. Input: the ball follows the pointer while it's on the page
      let target: { x: number; y: number } | null = null;
      let usingKeyboard = false;
      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        target = { x: e.clientX - r.left, y: e.clientY - r.top };
        usingKeyboard = false;
      };
      const onLeave = () => {
        if (!usingKeyboard) target = null;
      };
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerdown", onMove);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerup", (e) => e.pointerType === "touch" && onLeave());

      /** Sets the ball's speed directly (Verlet speed = position − previous position). */
      const pushBall = (vx: number, vy: number, h = 1 / 120) => {
        ball.px = ball.x - vx * h;
        ball.py = ball.y - vy * h;
      };

      controls.current = {
        moveHand: (dx, dy) => {
          usingKeyboard = true;
          const from = target ?? { x: ball.x, y: ball.y };
          target = {
            x: Math.min(W() - 20, Math.max(20, from.x + dx)),
            y: Math.min(H() - 20, Math.max(20, from.y + dy)),
          };
        },
        flick: () => pushBall((Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 400), -300),
        letGo: () => {
          target = null;
          usingKeyboard = false;
        },
      };

      // ----- 6. Paw state
      const pawState = {
        state: "idle" as PawState,
        t: 0, // seconds in the current state
        x: W() * 0.62, // where the arm's base is along the bottom
        rot: 0,
        ext: 0, // how far the whole arm slides forward along its direction
        from: { rot: 0, ext: 0 },
        to: { rot: 0, ext: 0 },
        cool: 1.2, // seconds until the paw may swat again
        hit: false,
        idleTime: 0,
      };
      const baseY = () => H() + ARM - Math.min(120, H() * 0.2); // rest: paw centre ~120px above bottom
      const pawTip = () => {
        const sin = Math.sin(pawState.rot);
        const cos = Math.cos(pawState.rot);
        const bx = pawState.x + sin * pawState.ext;
        const by = baseY() - cos * pawState.ext;
        return { x: bx + sin * ARM, y: by - cos * ARM, bx, by };
      };
      const setState = (s: PawState) => {
        pawState.state = s;
        pawState.t = 0;
        pawState.from = { rot: pawState.rot, ext: pawState.ext };
      };

      let lastAnnounce = 0;
      const onSwat = () => {
        setSwats((n) => n + 1);
        const now = performance.now();
        if (now - lastAnnounce > 3000) {
          lastAnnounce = now;
          setAnnouncement((prev) => (prev === "Swat! The cat hit the yarn." ? "Swat! The cat hit the yarn again." : "Swat! The cat hit the yarn."));
        }
      };

      // ----- 7. One physics step of length h seconds
      const step = (h: number) => {
        pts[0].x = pts[0].px = W() / 2; // the top end is pinned
        pts[0].y = pts[0].py = -10;

        for (let i = 1; i < pts.length; i++) {
          const p = pts[i];
          let vx = (p.x - p.px) * DAMPING;
          let vy = (p.y - p.py) * DAMPING;
          let ax = 0;
          let ay = GRAVITY;
          if (p === ball && target) {
            ax += SPRING * (target.x - p.x);
            ay += SPRING * (target.y - p.y) - GRAVITY * 0.6; // lighter while "held"
            vx *= SPRING_DAMP;
            vy *= SPRING_DAMP;
          }
          p.px = p.x;
          p.py = p.y;
          p.x += vx + ax * h * h;
          p.y += vy + ay * h * h;
        }

        // Keep every link the same length (weighted: the heavy ball moves less)
        for (let k = 0; k < ITERATIONS; k++) {
          for (let i = 0; i < SEGMENTS; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.0001;
            const total = a.inv + b.inv;
            if (total === 0) continue;
            const diff = (d - seg) / d;
            a.x += dx * diff * (a.inv / total);
            a.y += dy * diff * (a.inv / total);
            b.x -= dx * diff * (b.inv / total);
            b.y -= dy * diff * (b.inv / total);
          }
        }

        // Don't let the ball leave the screen sideways or fall through the floor
        ball.x = Math.min(W() - BALL_RADIUS, Math.max(BALL_RADIUS, ball.x));
        ball.y = Math.min(H() - BALL_RADIUS, ball.y);
      };

      // ----- 8. The paw's behaviour each frame
      const updatePaw = (dt: number) => {
        const s = pawState;
        s.t += dt;
        s.cool -= dt;
        const tip = pawTip();
        const ballV = { x: (ball.x - ball.px) * 120, y: (ball.y - ball.py) * 120 };

        if (s.state === "idle") {
          // Stalk: slide along the bottom toward the ball, with a lazy sway
          s.idleTime += dt;
          const wantX = Math.min(W() - 70, Math.max(70, ball.x));
          s.x += Math.sign(wantX - s.x) * Math.min(Math.abs(wantX - s.x), 170 * dt);
          s.rot = Math.sin(s.idleTime * 1.6) * 0.05;
          s.ext = Math.sin(s.idleTime * 2.3) * 6;
          // Like a real cat, it only pounces on yarn that moves (or that you're dangling)
          const interesting = target !== null || Math.hypot(ballV.x, ballV.y) > 140;
          if (s.cool <= 0 && interesting && Math.hypot(ball.x - tip.x, ball.y - tip.y) < REACH) {
            // Aim where the ball will be in a moment, not where it is now
            const aim = { x: ball.x + ballV.x * 0.12, y: ball.y + ballV.y * 0.12 };
            const bx = s.x;
            const by = baseY();
            const rot = Math.atan2(aim.x - bx, by - aim.y);
            const ext = Math.min(260, Math.max(-20, Math.hypot(aim.x - bx, aim.y - by) - ARM + 10));
            setState("windup");
            s.to = { rot: Math.max(-1.1, Math.min(1.1, rot)), ext };
            s.hit = false;
          }
        } else if (s.state === "windup") {
          // Crouch: pull back a little and lean away from the target
          const k = easeInOut(Math.min(s.t / 0.14, 1));
          s.rot = lerp(s.from.rot, -s.to.rot * 0.25, k);
          s.ext = lerp(s.from.ext, -30, k);
          if (s.t >= 0.14) {
            const to = s.to;
            setState("strike");
            s.to = to;
          }
        } else if (s.state === "strike") {
          const k = easeOut(Math.min(s.t / 0.11, 1));
          s.rot = lerp(s.from.rot, s.to.rot, k);
          s.ext = lerp(s.from.ext, s.to.ext, k);
          if (s.t >= 0.11) setState("hold");
        } else if (s.state === "hold") {
          if (s.t >= 0.07) setState("retract");
        } else if (s.state === "retract") {
          const k = easeInOut(Math.min(s.t / 0.4, 1));
          s.rot = lerp(s.from.rot, 0, k);
          s.ext = lerp(s.from.ext, 0, k);
          if (s.t >= 0.4) {
            setState("idle");
            s.cool = 0.5 + Math.random() * 1.1; // rest a moment, then it may swat again
          }
        }

        // Contact: during a strike, touching the ball knocks it away
        if ((s.state === "strike" || s.state === "hold") && !s.hit) {
          const t2 = pawTip();
          const dx = ball.x - t2.x;
          const dy = ball.y - t2.y;
          const d = Math.hypot(dx, dy);
          if (d < BALL_RADIUS + PAW_RADIUS + 6) {
            s.hit = true;
            // Push away from the paw, mostly upward and in the direction of the swipe
            let nx = d > 0.001 ? dx / d : 0;
            let ny = d > 0.001 ? dy / d : -1;
            nx += Math.sin(s.to.rot) * 0.8;
            ny -= 0.9;
            const len = Math.hypot(nx, ny) || 1;
            pushBall((nx / len) * SWAT_SPEED, (ny / len) * SWAT_SPEED);
            swatText.position.set(t2.x + (dx > 0 ? -40 : 40), t2.y - 50);
            swatText.rotation = (Math.random() - 0.5) * 0.4;
            swatTextAge = 0;
            onSwat();
          }
        }

        const t3 = pawTip();
        paw.position.set(t3.bx, t3.by);
        paw.rotation = s.rot;
      };

      // ----- 9. Every frame: physics in small fixed steps, then copy into the drawing
      let carry = 0;
      const STEP = 1 / 120;
      let spin = 0;
      app.ticker.add((ticker) => {
        carry += Math.min(ticker.deltaMS / 1000, 1 / 20); // avoid a huge jump after a hidden tab
        while (carry >= STEP) {
          step(STEP);
          carry -= STEP;
        }
        updatePaw(ticker.deltaMS / 1000);

        for (let i = 0; i < pts.length; i++) {
          ropePoints[i].x = pts[i].x;
          ropePoints[i].y = pts[i].y;
        }
        // Roll the ball as it moves sideways (distance / radius = angle)
        spin += (ball.x - ball.px) / BALL_RADIUS;
        ballArt.position.set(ball.x, ball.y);
        ballArt.rotation = spin;

        swatTextAge += ticker.deltaMS / 1000;
        swatText.alpha = swatTextAge < 0.7 ? 1 - swatTextAge / 0.7 : 0;
        swatText.scale.set(0.8 + Math.min(swatTextAge * 3, 0.4));

        handRing.visible = usingKeyboard && !!target;
        if (target) handRing.position.set(target.x, target.y);
      });

      // ----- 10. Keep things sensible when the window size changes
      const onResize = () => {
        seg = ropeLength() / SEGMENTS;
        pawState.x = Math.min(W() - 70, Math.max(70, pawState.x));
      };
      app.renderer.on("resize", onResize);

      cleanup = () => {
        controls.current = null;
        host.removeEventListener("pointermove", onMove);
        host.removeEventListener("pointerdown", onMove);
        host.removeEventListener("pointerleave", onLeave);
        app.renderer.off("resize", onResize);
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  /* Keyboard play: arrows move the hand, Space flicks, Escape lets go */
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const c = controls.current;
    if (!c) return;
    const d = e.shiftKey ? 90 : 30;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    };
    if (e.key in moves) {
      e.preventDefault();
      c.moveHand(...moves[e.key]);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      c.flick();
    } else if (e.key === "Escape") {
      c.letGo();
    }
  };

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      {/* Header comes first so Tab reaches the back button before the play area */}
      <header className={styles.header}>
        <BackHome accent="#c9653f" />
        <h1 className={styles.title}>Yarn Toy</h1>
      </header>

      <div
        ref={stageRef}
        className={styles.stage}
        tabIndex={0}
        // "application" lets the arrow keys reach our code instead of the screen reader
        role="application"
        aria-label="Yarn toy: a ball of orange yarn hangs from the top on a long string, and an orange cat paw waits at the bottom."
        aria-describedby="yarn-toy-help"
        onKeyDown={onKey}
        onBlur={() => controls.current?.letGo()}
      />

      <footer className={styles.footer}>
        <p id="yarn-toy-help" className={styles.help}>
          Move your mouse: the yarn follows on its string. Dangle it near the paw! Keyboard: Tab to the play area,
          arrow keys move the yarn (Shift for bigger moves), Space flicks it, Escape lets go.
        </p>
        <p className={styles.count}>
          Swats: <span className={styles.countNumber}>{swats}</span>
        </p>
      </footer>

      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
