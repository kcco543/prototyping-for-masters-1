"use client";

/**
 * Typography Experiments: mouse repulsion as a type tool.
 *
 * Type a sentence and it becomes a poster. Move the mouse over the letters
 * and they get pushed away, then spring back. The push also bends each
 * letter's variable-font axes (weight, width, slant, softness…), so the
 * cursor "sculpts" the type.
 *
 * How the repulsion works (no library, just a little physics):
 * - Each letter has a resting spot (from layout.ts) plus an offset and a
 *   velocity.
 * - Every frame, if the cursor is within radius R of a letter, the letter
 *   is pushed directly away from it. The closer it is, the harder the push
 *   (falls off as (1 − distance/R)²).
 * - A spring pulls every letter back to its resting spot, and damping
 *   (friction) stops it from wobbling forever.
 * - The same closeness (0 = far, 1 = touching) blends each letter's font
 *   axes from their "rest" values to their "peak" values.
 *
 * The animation runs outside React (direct DOM updates in requestAnimationFrame),
 * so it stays smooth.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import BackHome from "../../components/back-home/BackHome";
import { instrumentSans } from "../../fonts";
import styles from "./styles.module.css";
import { FONTS, variationSettings } from "./fonts";
import { computeLayout, type Layout, type Mode } from "./letterLayout";

const DEFAULT_TEXT = "Push the letters around";
const MAX_CHARS = 48;

const MODES: { key: Mode; label: string }[] = [
  { key: "circle", label: "Circle" },
  { key: "skew", label: "3D Skew" },
  { key: "wave", label: "Wave" },
];

/** Poster colour schemes: background, text, accent */
const PALETTES = [
  { name: "Paper", bg: "#f3eee4", ink: "#141414", accent: "#ff4b1f" },
  { name: "Night", bg: "#151515", ink: "#f3eee4", accent: "#ffd400" },
  { name: "Cobalt", bg: "#2f3ab2", ink: "#f6f1e8", accent: "#ff8fb1" },
  { name: "Signal", bg: "#ffd400", ink: "#141414", accent: "#e6332a" },
  { name: "Vermilion", bg: "#e6332a", ink: "#fff3e6", accent: "#141414" },
  { name: "Mint", bg: "#cfe8dc", ink: "#123d2e", accent: "#ff5a36" },
];

/* ---------- Repulsion tuning ---------- */
const SPRING = 70; // how strongly letters are pulled home
const DAMPING = 11; // friction: higher = settles faster, less bouncy
const PUSH = 9000; // how hard the cursor pushes (px/s² at point-blank range)

/** A repeatable random generator, seeded from the sentence (+ the shuffle count). */
function seeded(text: string, seed: number) {
  let h = 2166136261 ^ seed;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function TypographyExperiments() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("circle");
  const [fontKey, setFontKey] = useState<(typeof FONTS)[number]["key"]>("flex");
  const [seed, setSeed] = useState(0);

  const text = (input.trim() || DEFAULT_TEXT).slice(0, MAX_CHARS);
  const chars = useMemo(() => [...text], [text]);
  const font = FONTS.find((f) => f.key === fontKey)!;

  /* ----- Everything "generated" from the sentence ----- */
  const look = useMemo(() => {
    const rnd = seeded(text, seed);
    const palette = PALETTES[Math.floor(rnd() * PALETTES.length)];
    const rest = font.rest(rnd);
    const peak = font.peak(rnd);
    const accentEvery = 3 + Math.floor(rnd() * 4);
    const accentStart = Math.floor(rnd() * accentEvery);
    return {
      palette,
      rest,
      peak,
      isAccent: (i: number) => i % accentEvery === accentStart,
      spin: (rnd() < 0.5 ? 1 : -1) * (0.08 + rnd() * 0.1), // ring rotation speed (rad/s)
      waveCycles: 0.7 + rnd() * 1.3, // ripples across the poster
      waveAmp: 0.1 + rnd() * 0.14, // ripple height, as a fraction of the font size
      waveSpeed: 1 + rnd() * 1.6,
      tiltX: 28 + rnd() * 18, // 3D: how far the plane leans back
      tiltZ: (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 12), // 3D: how much it's turned
      issue: 100 + Math.floor(rnd() * 900),
    };
  }, [text, seed, font]);

  /* ----- refs used by the animation loop ----- */
  const posterRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lookRef = useRef(look);
  const pointer = useRef({ x: 0, y: 0, active: false });
  const physics = useRef({ ox: [0], oy: [0], oz: [0], vx: [0], vy: [0], vz: [0], p: [0], shownP: [-1] });
  const [size, setSize] = useState({ w: 0, h: 0 });

  lookRef.current = look;

  // Track the poster's size
  useEffect(() => {
    const el = posterRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ----- Measure the letters and lay them out (when text, mode, font or size change) ----- */
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const m = measureRef.current;
      if (!m || !size.w) return;
      await document.fonts.load(`100px ${font.family}`);
      if (cancelled) return;
      m.style.fontVariationSettings = variationSettings(look.rest);
      const cache = new Map<string, number>();
      const widths100 = chars.map((ch) => {
        if (!cache.has(ch)) {
          m.textContent = ch === " " ? " " : ch;
          cache.set(ch, m.getBoundingClientRect().width);
        }
        return cache.get(ch)!;
      });
      const layout = computeLayout(mode, chars, widths100, size.w, size.h);
      layoutRef.current = layout;
      const n = chars.length;
      physics.current = {
        ox: new Array(n).fill(0),
        oy: new Array(n).fill(0),
        oz: new Array(n).fill(0),
        vx: new Array(n).fill(0),
        vy: new Array(n).fill(0),
        vz: new Array(n).fill(0),
        p: new Array(n).fill(0),
        shownP: new Array(n).fill(-1),
      };
      letterRefs.current.slice(0, n).forEach((el) => {
        if (el) el.style.fontSize = `${layout.F}px`;
      });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [chars, mode, font, look.rest, size]);

  /* ----- The animation loop: repulsion physics + treatments ----- */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    let frameNo = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const L = layoutRef.current;
      const els = letterRefs.current;
      const ph = physics.current;
      const lk = lookRef.current;
      if (!L || ph.ox.length !== L.items.length) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const t = reduced ? 0 : now / 1000;
      const n = L.items.length;

      // 1) READ every letter's current position on screen (all reads before any writes)
      const centres = new Array<[number, number] | null>(n);
      for (let i = 0; i < n; i++) {
        const el = els[i];
        if (!el || L.items[i].x < -1000) {
          centres[i] = null;
          continue;
        }
        const r = el.getBoundingClientRect();
        centres[i] = [r.left + r.width / 2, r.top + r.height / 2];
      }

      // 2) PHYSICS: push away from the cursor, spring back home
      const R = Math.max(110, L.F * 1.4); // reach of the cursor
      const P = pointer.current;
      let hottest = -1;
      for (let i = 0; i < n; i++) {
        const c = centres[i];
        if (!c) continue;
        let ax = -SPRING * ph.ox[i] - DAMPING * ph.vx[i];
        let ay = -SPRING * ph.oy[i] - DAMPING * ph.vy[i];
        let az = -SPRING * ph.oz[i] - DAMPING * ph.vz[i];
        let near = 0;
        if (P.active) {
          const dx = c[0] - P.x;
          const dy = c[1] - P.y;
          const d = Math.hypot(dx, dy) || 0.001;
          if (d < R) {
            const f = (1 - d / R) ** 2 * PUSH * (L.F / 160 + 0.4);
            ax += (dx / d) * f;
            ay += (dy / d) * f;
            az += f * 0.5; // in 3D, letters also lift towards you
          }
          near = Math.max(0, 1 - d / (R * 1.25));
        }
        ph.vx[i] += ax * dt;
        ph.vy[i] += ay * dt;
        ph.vz[i] += az * dt;
        ph.ox[i] += ph.vx[i] * dt;
        ph.oy[i] += ph.vy[i] * dt;
        ph.oz[i] += ph.vz[i] * dt;
        // closeness eases in and out, so the font axes morph smoothly
        ph.p[i] += (near - ph.p[i]) * Math.min(1, dt * 9);
        if (hottest < 0 || ph.p[i] > ph.p[hottest]) hottest = i;
      }

      // 3) WRITE: place every letter for the current treatment
      const k = (2 * Math.PI * lk.waveCycles) / Math.max(1, L.cx * 2);
      for (let i = 0; i < n; i++) {
        const el = els[i];
        const it = L.items[i];
        if (!el) continue;
        if (it.x < -1000) {
          el.style.opacity = "0";
          continue;
        }
        el.style.opacity = "1";
        const p = ph.p[i];
        const ox = ph.ox[i];
        const oy = ph.oy[i];
        let transform = "";
        if (L.mode === "circle") {
          // text wrapped around a slowly turning ring
          const theta = it.theta + lk.spin * t;
          const x = L.cx + L.r * Math.cos(theta) + ox;
          const y = L.cy + L.r * Math.sin(theta) + oy;
          const rot = (theta + Math.PI / 2) * (180 / Math.PI) + ox * 0.15;
          transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${rot.toFixed(1)}deg) scale(${(1 + p * 0.25).toFixed(3)})`;
        } else if (L.mode === "wave") {
          // each line ripples; letters tilt to follow the slope of the wave
          const A = L.F * lk.waveAmp * (1 + p * 1.2);
          const phase = k * it.x + lk.waveSpeed * t + it.line * 0.9;
          const y = it.y + A * Math.sin(phase) + oy;
          const slope = Math.atan(A * k * Math.cos(phase)) * (180 / Math.PI);
          transform = `translate(${(it.x + ox).toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) rotate(${slope.toFixed(1)}deg)`;
        } else {
          // 3D: on a tilted plane; pushed letters lift up off it and stand up
          const z = Math.max(0, ph.oz[i]) * 0.6;
          transform = `translate3d(${(it.x + ox).toFixed(1)}px, ${(it.y + oy).toFixed(1)}px, ${z.toFixed(1)}px) translate(-50%, -50%) skewX(-12deg) rotateX(${(-p * 40).toFixed(1)}deg)`;
        }
        el.style.transform = transform;

        // variable-font axes: only rewrite when they visibly change (it's costlier than a transform)
        if (Math.abs(p - ph.shownP[i]) > 0.01) {
          ph.shownP[i] = p;
          const v: Record<string, number> = {};
          for (const tag of Object.keys(lk.rest)) v[tag] = lerp(lk.rest[tag], lk.peak[tag] ?? lk.rest[tag], p);
          el.style.fontVariationSettings = variationSettings(v);
          el.classList.toggle(styles.hot, p > 0.45);
        }
      }

      // live readout of the letter nearest the cursor (a few times a second)
      if (++frameNo % 6 === 0 && readoutRef.current) {
        const p = hottest >= 0 ? ph.p[hottest] : 0;
        readoutRef.current.textContent = Object.keys(lk.rest)
          .slice(0, 3)
          .map((tag) => {
            const v = lerp(lk.rest[tag], lk.peak[tag] ?? lk.rest[tag], p);
            return `${tag} ${Math.abs(v) < 2 && v % 1 !== 0 ? v.toFixed(2) : Math.round(v)}`;
          })
          .join(" · ");
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerMove = (e: PointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY, active: true };
  };
  const onPointerLeave = () => {
    pointer.current.active = false;
  };

  const { palette } = look;
  const colours = { "--bg": palette.bg, "--ink": palette.ink, "--accent": palette.accent } as CSSProperties;
  const modeLabel = MODES.find((m) => m.key === mode)!.label;
  const initial = chars.find((c) => c.trim()) ?? "";

  return (
    <div className={`${styles.container} ${instrumentSans.className}`} style={colours}>
      <header className={styles.topBar}>
        <BackHome accent={palette.accent} ink="#2b2725" />
        <h1 className={styles.title}>Typography Experiments</h1>
        <span />
      </header>

      <div
        ref={posterRef}
        className={`${styles.poster} ${mode === "skew" ? styles.posterSkew : ""}`}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerLeave}
        role="img"
        aria-label={`Poster: "${text}", set in ${font.name} as ${modeLabel} type. Move the mouse over the letters to push them around.`}
      >
        {/* poster details in the corners */}
        <div className={`${styles.corner} ${styles.tl}`} aria-hidden="true">
          <span>Typography Experiments</span>
          <span>N° {look.issue}</span>
        </div>
        <div className={`${styles.corner} ${styles.tr}`} aria-hidden="true">
          <span>{font.name}</span>
          <span ref={readoutRef} />
        </div>
        <div className={`${styles.corner} ${styles.bl}`} aria-hidden="true">
          <span>{modeLabel}</span>
          <span>Mouse repulsion</span>
        </div>
        <div className={`${styles.corner} ${styles.br}`} aria-hidden="true">
          <span>Variable font</span>
          <span>{palette.name}</span>
        </div>

        {/* circle: a giant outlined initial in the middle of the ring */}
        {mode === "circle" && size.w > 0 && (
          <span
            className={styles.initial}
            style={{ fontFamily: font.family, fontVariationSettings: variationSettings(look.rest), fontSize: Math.min(size.w, size.h) * 0.5 }}
            aria-hidden="true"
          >
            {initial}
          </span>
        )}

        <div
          className={styles.plane}
          style={mode === "skew" ? { transform: `rotateX(${look.tiltX.toFixed(1)}deg) rotateZ(${look.tiltZ.toFixed(1)}deg)` } : undefined}
          aria-hidden="true"
        >
          {chars.map((ch, i) => (
            <span
              key={`${i}-${ch}`}
              ref={(el) => {
                letterRefs.current[i] = el;
              }}
              className={`${styles.letter} ${look.isAccent(i) ? styles.accentLetter : ""}`}
              style={{ fontFamily: font.family, fontVariationSettings: variationSettings(look.rest) }}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </div>

        {/* invisible ruler used to measure letter widths */}
        <span ref={measureRef} className={styles.measure} style={{ fontFamily: font.family }} aria-hidden="true" />
      </div>

      {/* ---------- Controls ---------- */}
      <form className={styles.controls} onSubmit={(e) => e.preventDefault()}>
        <label className={styles.inputWrap}>
          <span className={styles.srOnly}>Your sentence</span>
          <input
            className={styles.input}
            value={input}
            maxLength={MAX_CHARS}
            placeholder={DEFAULT_TEXT}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <span className={styles.count} aria-hidden="true">
            {text.length}/{MAX_CHARS}
          </span>
        </label>

        <div className={styles.group} role="group" aria-label="Treatment">
          {MODES.map((m) => (
            <button key={m.key} type="button" className={styles.chip} aria-pressed={mode === m.key} onClick={() => setMode(m.key)}>
              {m.label}
            </button>
          ))}
        </div>

        <div className={styles.group} role="group" aria-label="Variable font">
          {FONTS.map((f) => (
            <button key={f.key} type="button" className={styles.chip} aria-pressed={fontKey === f.key} onClick={() => setFontKey(f.key)} style={{ fontFamily: f.family }}>
              {f.name}
            </button>
          ))}
        </div>

        <button type="button" className={styles.shuffle} onClick={() => setSeed((s) => s + 1)} title="Generate a new treatment for this sentence">
          Shuffle
        </button>
      </form>
    </div>
  );
}
