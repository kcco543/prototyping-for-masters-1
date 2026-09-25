"use client";

/**
 * The Tower — a catch-the-cups game.
 *
 * A curious cat hops onto the cup shelves. When it brushes past a cup, the
 * cup may start to wobble and then fall. Move the hand to catch it!
 *
 * How the code is organised:
 * - All moving things (cups, cat, broken pieces) live in one `game` object
 *   stored in a ref. A ref changes without re-rendering React.
 * - A `requestAnimationFrame` loop updates that object ~60 times a second
 *   (`tick`), then bumps a counter so React redraws the scene.
 * - The hand is moved *directly* on every pointer move (not via React),
 *   so it follows the mouse or finger with no delay.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import styles from "./styles.module.css";
import { caveat, instrumentSans } from "../../fonts";
import { Backdrop, C, CatSprite, CUPS, CupArt, HandBack, HandFront, Shelf, shardColors, type CatPose } from "./art";
import * as sound from "./sound";

/* ---------- Scene measurements (in SVG units) ---------- */
const W = 600;
const H = 860;
const SHELF_Y = [175, 345, 515, 685]; // top surface of each shelf
const SLOT_X = [98, 230, 370, 502]; // where the 4 cups on a shelf stand
const FLOOR_Y = 812;
const SHELF_X0 = 30;
const SHELF_X1 = 570;

/* ---------- Game tuning ---------- */
const DROPS_PER_ROUND = 8; // how many cups fall in one round
const GRAVITY = 620; // units per second², how fast cups speed up
const MAX_FALL_SPEED = 720;
const LOOSEN_CHANCE = 0.5; // chance a cup gets knocked when the cat passes it

/* ---------- Types ---------- */
type ItemState = "shelf" | "loose" | "falling" | "caught" | "returning";

type Item = {
  id: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  state: ItemState;
  timer: number;
  wobbleFor: number;
  /** Caught once already: the cat won't knock it again this round */
  safe: boolean;
  fromX: number;
  fromY: number;
};

type Shard = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; color: string; d: string; life: number };

type Jump = { x0: number; y0: number; x1: number; y1: number; peak: number; t: number; dur: number; then: "walk" | "away" };

type Cat = {
  mode: "away" | "jump" | "walk" | "pause";
  x: number;
  y: number;
  dir: 1 | -1;
  shelf: number;
  speed: number;
  timer: number;
  jump: Jump | null;
  /** Slots already passed on this visit, so each cup is only "rolled" once */
  checked: Set<number>;
  reversed: boolean;
};

type Phase = "intro" | "playing" | "crash" | "win";

type Game = {
  phase: Phase;
  items: Item[];
  shards: Shard[];
  cat: Cat;
  dropped: number;
  saved: number;
  hand: { x: number; y: number };
  phaseTimer: number;
};

/* ---------- Small helpers ---------- */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function freshItems(): Item[] {
  return CUPS.map((_, i) => {
    const x = SLOT_X[i % 4];
    const y = SHELF_Y[Math.floor(i / 4)];
    return { id: i, homeX: x, homeY: y, x, y, vx: 0, vy: 0, rot: 0, vr: 0, state: "shelf", timer: 0, wobbleFor: 0, safe: false, fromX: x, fromY: y };
  });
}

function freshCat(delay = 1.2): Cat {
  return { mode: "away", x: -100, y: 0, dir: 1, shelf: 0, speed: 0, timer: delay, jump: null, checked: new Set(), reversed: false };
}

function newGame(phase: Phase, hand = { x: W / 2, y: 770 }): Game {
  return { phase, items: freshItems(), shards: [], cat: freshCat(), dropped: 0, saved: 0, hand, phaseTimer: 0 };
}

function startJump(cat: Cat, x1: number, y1: number, peak: number, dur: number, then: Jump["then"]) {
  cat.mode = "jump";
  cat.jump = { x0: cat.x, y0: cat.y, x1, y1, peak, t: 0, dur, then };
}

/* ---------- The cat's behaviour ---------- */

function updateCat(g: Game, dt: number) {
  const cat = g.cat;
  const edgeL = SHELF_X0 + 22;
  const edgeR = SHELF_X1 - 22;

  switch (cat.mode) {
    case "away": {
      if (g.dropped >= DROPS_PER_ROUND) return; // done for this round
      cat.timer -= dt;
      if (cat.timer > 0) return;
      // Leap in from the side onto a random shelf
      cat.shelf = Math.floor(Math.random() * 4);
      cat.dir = Math.random() < 0.5 ? 1 : -1;
      const y = SHELF_Y[cat.shelf];
      cat.x = cat.dir > 0 ? -70 : W + 70;
      cat.y = y + 130;
      cat.checked = new Set();
      cat.reversed = false;
      startJump(cat, cat.dir > 0 ? edgeL : edgeR, y, y - 70, rand(0.5, 0.75), "walk");
      return;
    }

    case "jump": {
      const j = cat.jump!;
      j.t += dt;
      const p = Math.min(j.t / j.dur, 1);
      // A curved hop: a quadratic Bézier whose middle point lifts the cat up
      const cy = 2 * j.peak - (j.y0 + j.y1) / 2;
      cat.x = lerp(j.x0, j.x1, p);
      cat.y = (1 - p) * (1 - p) * j.y0 + 2 * (1 - p) * p * cy + p * p * j.y1;
      if (p >= 1) {
        if (j.then === "away") {
          cat.mode = "away";
          cat.timer = rand(0.6, 2.2);
        } else {
          cat.mode = "walk";
          cat.speed = rand(55, 135);
          cat.timer = rand(0.5, 1.6);
        }
        cat.jump = null;
      }
      return;
    }

    case "pause": {
      cat.timer -= dt;
      if (cat.timer <= 0) {
        if (!cat.reversed && Math.random() < 0.3) {
          cat.dir = cat.dir === 1 ? -1 : 1;
          cat.reversed = true;
        }
        cat.mode = "walk";
        cat.speed = rand(60, 150);
        cat.timer = rand(0.5, 1.5);
      }
      return;
    }

    case "walk": {
      cat.x += cat.dir * cat.speed * dt;

      // Every so often, change pace, stop to sniff, or turn around
      cat.timer -= dt;
      if (cat.timer <= 0) {
        const r = Math.random();
        if (r < 0.3) {
          cat.mode = "pause";
          cat.timer = rand(0.35, 1.2);
        } else if (r < 0.42 && !cat.reversed && cat.x > 130 && cat.x < W - 130) {
          cat.dir = cat.dir === 1 ? -1 : 1;
          cat.reversed = true;
          cat.timer = rand(0.5, 1.4);
        } else {
          cat.speed = rand(55, 160);
          cat.timer = rand(0.5, 1.6);
        }
      }

      // Brushing past a cup might knock it loose
      for (let s = 0; s < 4; s++) {
        if (!cat.checked.has(s) && Math.abs(cat.x - SLOT_X[s]) < 10) {
          cat.checked.add(s);
          tryLoosen(g, g.items[cat.shelf * 4 + s]);
        }
      }

      // Reached the end of the shelf: hop to another shelf or leave
      if ((cat.dir > 0 && cat.x >= edgeR) || (cat.dir < 0 && cat.x <= edgeL)) {
        if (g.dropped < DROPS_PER_ROUND && Math.random() < 0.45) {
          const next = cat.shelf === 0 ? 1 : cat.shelf === 3 ? 2 : cat.shelf + (Math.random() < 0.5 ? -1 : 1);
          const ny = SHELF_Y[next];
          startJump(cat, cat.x - cat.dir * 10, ny, Math.min(cat.y, ny) - 60, rand(0.5, 0.65), "walk");
          cat.shelf = next;
          cat.dir = cat.dir === 1 ? -1 : 1;
          cat.checked = new Set();
          cat.reversed = false;
        } else {
          startJump(cat, cat.dir > 0 ? W + 80 : -80, cat.y + 120, cat.y - 50, rand(0.5, 0.7), "away");
        }
      }
      return;
    }
  }
}

function tryLoosen(g: Game, item: Item) {
  if (item.state !== "shelf" || item.safe || g.dropped >= DROPS_PER_ROUND) return;
  // Start gently: one cup at a time at first, then up to two at once
  const active = g.items.filter((i) => i.state === "loose" || i.state === "falling").length;
  const maxActive = g.dropped < 3 ? 1 : 2;
  if (active >= maxActive || Math.random() > LOOSEN_CHANCE) return;

  item.state = "loose";
  item.timer = 0;
  item.wobbleFor = rand(0.45, 1.1); // how long it wobbles before falling
  item.vx = g.cat.dir * rand(8, 40); // nudged in the cat's walking direction
  g.dropped++;
  sound.playRattle();
}

/* ---------- Cups falling, being caught, or breaking ---------- */

function updateItems(g: Game, dt: number, onCatch: () => void) {
  const hand = g.hand;
  for (const it of g.items) {
    switch (it.state) {
      case "loose": {
        it.timer += dt;
        const shake = 3 + it.timer * 8;
        it.rot = Math.sin(it.timer * 30) * shake;
        it.x = it.homeX + Math.sin(it.timer * 45) * 1.2;
        if (it.timer >= it.wobbleFor) {
          it.state = "falling";
          it.vy = -60; // a little hop off the shelf edge
          it.vr = rand(-120, 120);
        }
        break;
      }

      case "falling": {
        it.vy = Math.min(it.vy + GRAVITY * dt, MAX_FALL_SPEED);
        it.y += it.vy * dt;
        it.x += it.vx * dt;
        it.rot += it.vr * dt;
        if (it.x < 40 || it.x > W - 40) it.vx *= -1;

        // Caught? The hand's palm must be under (or on) the cup
        const dx = Math.abs(it.x - hand.x);
        if (it.vy > 0 && dx < 56 && hand.y >= it.y - 64 && hand.y <= it.y + 26) {
          it.state = "caught";
          it.timer = 0;
          g.saved++;
          onCatch();
          sound.playCatch();
          break;
        }

        // Hit the floor → shatter, and the round restarts
        if (it.y >= FLOOR_Y) {
          shatter(g, it);
          return;
        }
        break;
      }

      case "caught": {
        // Rest in the hand for a moment…
        it.timer += dt;
        it.x = hand.x;
        it.y = hand.y + 16;
        it.rot *= 0.8;
        if (it.timer >= 0.45) {
          it.state = "returning";
          it.timer = 0;
          it.fromX = it.x;
          it.fromY = it.y;
        }
        break;
      }

      case "returning": {
        // …then float back up to its spot on the shelf
        it.timer += dt;
        const p = Math.min(it.timer / 0.7, 1);
        const e = easeInOut(p);
        it.x = lerp(it.fromX, it.homeX, e);
        it.y = lerp(it.fromY, it.homeY, e) - Math.sin(p * Math.PI) * 60;
        it.rot = 0;
        if (p >= 1) {
          it.state = "shelf";
          it.safe = true;
          it.x = it.homeX;
          it.y = it.homeY;
        }
        break;
      }
    }
  }
}

function shatter(g: Game, it: Item) {
  const colors = shardColors(CUPS[it.id]);
  for (let i = 0; i < 12; i++) {
    const s = rand(5, 13);
    g.shards.push({
      x: it.x + rand(-20, 20),
      y: FLOOR_Y - rand(4, 20),
      vx: rand(-240, 240),
      vy: rand(-420, -140),
      rot: rand(0, 360),
      vr: rand(-700, 700),
      color: colors[i % colors.length],
      d: `M0 ${-s} L${s * rand(0.5, 1.1)} ${s * rand(0.2, 0.9)} L${-s * rand(0.5, 1.1)} ${s * rand(0.2, 0.9)}Z`,
      life: 1.6,
    });
  }
  it.state = "shelf";
  it.x = -999; // hide the broken cup
  g.phase = "crash";
  g.phaseTimer = 1.3;
  sound.playCrash();
}

function updateShards(g: Game, dt: number) {
  for (const s of g.shards) {
    s.vy += GRAVITY * 1.4 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rot += s.vr * dt;
    if (s.y > FLOOR_Y + 14) {
      s.y = FLOOR_Y + 14;
      s.vy *= -0.3;
      s.vx *= 0.6;
      s.vr *= 0.5;
    }
    s.life -= dt;
  }
  g.shards = g.shards.filter((s) => s.life > 0);
}

/* ---------- The page ---------- */

export default function TheTower() {
  const game = useRef<Game>(newGame("intro"));
  const [, setFrame] = useState(0);
  const [muted, setMuted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const handBackRef = useRef<SVGGElement>(null);
  const handFrontRef = useRef<SVGGElement>(null);
  const handPulseRef = useRef<SVGGElement>(null);

  /** Small squeeze animation on the hand when it catches something. */
  const pulseHand = useCallback(() => {
    const el = handPulseRef.current;
    if (!el) return;
    el.classList.remove(styles.handCatch);
    void el.getBoundingClientRect(); // restart the CSS animation
    el.classList.add(styles.handCatch);
  }, []);

  const placeHand = useCallback((x: number, y: number) => {
    const t = `translate(${x} ${y})`;
    handBackRef.current?.setAttribute("transform", t);
    handFrontRef.current?.setAttribute("transform", t);
  }, []);

  // The game loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // cap big jumps (e.g. tab switch)
      last = now;
      const g = game.current;

      if (g.phase === "playing") {
        updateCat(g, dt);
        updateItems(g, dt, pulseHand);
        const busy = g.items.some((i) => i.state !== "shelf");
        if (g.phase === "playing" && g.dropped >= DROPS_PER_ROUND && !busy) {
          g.phase = "win";
          sound.playMeow();
        }
      } else if (g.phase === "crash") {
        g.phaseTimer -= dt;
        if (g.phaseTimer <= 0) {
          // Restart straight away, keeping the hand where it is
          const shards = g.shards;
          game.current = newGame("playing", g.hand);
          game.current.shards = shards;
        }
      } else if (g.phase === "win") {
        updateItems(g, dt, pulseHand);
      }

      updateShards(game.current, dt);
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pulseHand]);

  // Put the hand in its starting spot
  useEffect(() => placeHand(game.current.hand.x, game.current.hand.y), [placeHand]);

  /** Convert the pointer's screen position into SVG scene coordinates. */
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = Math.max(20, Math.min(W - 20, p.x));
    const y = Math.max(20, Math.min(H - 10, p.y));
    game.current.hand = { x, y };
    placeHand(x, y);
  };

  const start = () => {
    sound.unlockAudio();
    game.current = newGame("playing", game.current.hand);
  };

  const toggleMute = () => {
    setMuted((m) => {
      sound.setMuted(!m);
      return !m;
    });
  };

  const g = game.current;
  const cat = g.cat;
  const catPose: CatPose = cat.mode === "jump" ? "jump" : cat.mode === "walk" ? "walk" : "stand";
  const onShelf = g.items.filter((i) => i.state !== "caught");
  const inHand = g.items.filter((i) => i.state === "caught");

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.backLink}>
          ← <span className={styles.backFull}>Jiaqi Yuan&apos;s prototypes</span>
          <span className={styles.backShort}>Home</span>
        </Link>
        <h1 className={styles.title}>The Tower</h1>
        <button type="button" className={styles.muteButton} onClick={toggleMute} aria-pressed={muted}>
          {muted ? "Sound off" : "Sound on"}
        </button>
      </header>

      {/* Score: one little cup per drop, filled in when caught */}
      <div className={styles.score} aria-live="polite">
        <span className={styles.scoreLabel}>
          Cups caught {g.saved} / {DROPS_PER_ROUND}
        </span>
        <span className={styles.scorePips}>
          {Array.from({ length: DROPS_PER_ROUND }, (_, i) => (
            <span key={i} className={`${styles.pip} ${i < g.saved ? styles.pipOn : ""}`} />
          ))}
        </span>
      </div>

      <div className={styles.stageWrap}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={styles.stage}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
          role="img"
          aria-label="Shelves of patterned cups with a cat walking among them"
        >
          <Backdrop w={W} h={H} floorY={FLOOR_Y} />

          {/* The cat walks along the back of the shelves, behind the cups */}
          {g.phase !== "win" && cat.mode !== "away" && (
            <g transform={`translate(${cat.x} ${cat.y}) scale(${cat.dir * 1.2} 1.2)`}>
              <CatSprite pose={catPose} />
            </g>
          )}

          {SHELF_Y.map((y) => (
            <Shelf key={y} y={y} x0={SHELF_X0} x1={SHELF_X1} />
          ))}

          {onShelf.map((it) => (
            <g key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`}>
              <CupArt id={it.id} design={CUPS[it.id]} />
            </g>
          ))}

          {g.shards.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} stroke="rgba(43,39,37,0.25)" strokeWidth={0.8} opacity={Math.min(1, s.life * 2)} transform={`translate(${s.x} ${s.y}) rotate(${s.rot})`} />
          ))}

          {/* Celebration: the cat bounces happily on the floor */}
          {g.phase === "win" && (
            <g transform={`translate(${W / 2} ${FLOOR_Y + 30}) scale(1.4)`}>
              <g className={styles.happyBounce}>
                <CatSprite pose="happy" />
              </g>
              {[-30, 0, 30].map((x, i) => (
                <path key={x} className={styles.heart} style={{ animationDelay: `${i * 0.35}s` } as CSSProperties} d={`M${x} -100 c-8 -8 -16 2 0 12 c16 -10 8 -20 0 -12Z`} fill={C.pink} />
              ))}
            </g>
          )}

          {/* The hand: fingers behind the caught cup, palm in front of it */}
          <g ref={handBackRef} className={styles.hand}>
            <HandBack />
          </g>
          {inHand.map((it) => (
            <g key={it.id} transform={`translate(${it.x} ${it.y}) rotate(${it.rot})`}>
              <CupArt id={it.id} design={CUPS[it.id]} />
            </g>
          ))}
          <g ref={handFrontRef} className={styles.hand}>
            <g ref={handPulseRef}>
              <HandFront />
            </g>
          </g>
        </svg>

        {g.phase === "intro" && (
          <div className={styles.overlay}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>The Tower</h2>
              <p className={styles.cardText}>
                A curious cat loves exploring the cup shelves. When a cup starts to <strong>wobble</strong>, get your hand
                underneath it!
              </p>
              <p className={styles.cardText}>
                Catch all {DROPS_PER_ROUND} falling cups to win. If one hits the floor, it&apos;s back to the start.
              </p>
              <button type="button" className={styles.playButton} onClick={start}>
                Let&apos;s play
              </button>
            </div>
          </div>
        )}

        {g.phase === "crash" && (
          <div className={`${styles.overlay} ${styles.overlayPassThrough}`}>
            <div className={styles.toast}>Crash! Starting over…</div>
          </div>
        )}

        {g.phase === "win" && (
          <div className={styles.overlay}>
            <div className={styles.confetti} aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  className={styles.confettiBit}
                  style={
                    {
                      left: `${(i * 37) % 100}%`,
                      background: [C.red, C.yellow, C.teal, C.pink, C.navy, C.lime, C.orange][i % 7],
                      animationDelay: `${(i % 7) * 0.18}s`,
                      animationDuration: `${2.2 + (i % 5) * 0.35}s`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <div className={`${styles.card} ${styles.winCard}`}>
              <h2 className={styles.cardTitle}>Purr-fect!</h2>
              <p className={styles.cardText}>You caught all {DROPS_PER_ROUND} cups. Not a single chip!</p>
              <button type="button" className={styles.playButton} onClick={start}>
                Play again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
