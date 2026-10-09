"use client";

/**
 * Purr Type — a PixiJS take on the typography experiment.
 *
 * Type a word; it appears in big letters. Every letter purrs (a gentle,
 * rapid tremble that comes in breathing waves), and letters near the mouse
 * scatter away, spin, then spring back and settle.
 *
 * Per-letter animation comes from PixiJS's split text classes, which turn a
 * string into one display object per character:
 *   - SplitText        → each letter is a full `Text` (drawn on its own canvas)
 *   - SplitBitmapText  → each letter is a `BitmapText` (copied from a shared glyph atlas)
 * You can switch between them, and the "Run benchmark" button measures both.
 * Default: SplitText. See README.md for the comparison and why.
 *
 * PixiJS is loaded with a dynamic import inside useEffect so it only runs in
 * the browser.
 */

import { useEffect, useRef, useState } from "react";
import BackHome from "../../components/back-home/BackHome";
import { caveat, instrumentSans } from "../../fonts";
import styles from "./styles.module.css";

type Engine = "text" | "bitmap";

type BenchRow = { engine: string; buildShort: number; buildLong: number; frameLong: number };

/** Letter colours from the homepage cat illustrations */
const PALETTE = [0xf0893d, 0xec8e85, 0xf3c04a, 0xb8633a, 0x8a8f86, 0x6d6d71, 0x2b2725];

const FONT_SIZE = 170; // the letters' design size (the word is then scaled to fit the screen)
const MAX_CHARS = 14;
const DEFAULT_WORD = "purr";
const LONG_TEXT = "Purring cats curl up in warm sunbeams and dream of yarn, fish and very soft blankets. ".repeat(2).trim(); // ~170 chars, for the benchmark

/* ---------- Physics tuning ---------- */
const SPRING = 45; // pull back home
const DAMPING = 7; // friction (lower = bouncier settle)
const PUSH = 16000; // how hard the mouse pushes (px/s²)
const REACH = 230; // how close (screen px) the mouse must be to push a letter
const PURR_HZ = 26; // real cats purr at ~25 Hz
const PURR_PX = 1.4; // how far the purr shakes each letter

export default function PurrType() {
  const [input, setInput] = useState("");
  const [engine, setEngine] = useState<Engine>("text");
  const [bench, setBench] = useState<BenchRow[] | null>(null);
  const [benchRunning, setBenchRunning] = useState(false);

  const word = (input.trim() || DEFAULT_WORD).slice(0, MAX_CHARS);

  const hostRef = useRef<HTMLDivElement>(null);
  const buildMsRef = useRef<HTMLSpanElement>(null);
  const frameMsRef = useRef<HTMLSpanElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  /** Functions provided by the PixiJS setup once it's ready */
  const api = useRef<{ show: (word: string, engine: Engine) => void; benchmark: () => Promise<BenchRow[]> } | null>(null);
  const latest = useRef({ word, engine });
  latest.current = { word, engine };

  /* ----- Set up PixiJS once ----- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const PIXI = await import("pixi.js");
      const { Application, BitmapFont, Container, SplitBitmapText, SplitText } = PIXI;
      type Glyph = InstanceType<typeof PIXI.Container>;

      // The Text engine draws with the browser's canvas, so the web font must be loaded first
      const family = caveat.style.fontFamily;
      await document.fonts.load(`700 ${FONT_SIZE}px ${family}`);

      const app = new Application();
      await app.init({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: "webgl",
      });
      if (cancelled) {
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
        return;
      }
      app.canvas.classList.add(styles.canvas);
      host.appendChild(app.canvas);

      const resolution = app.renderer.resolution;

      // Shared look for both engines: white letters (tinted per letter) with a soft drop shadow
      const style = {
        fontFamily: family,
        fontSize: FONT_SIZE,
        fontWeight: "700" as const,
        fill: 0xffffff,
        dropShadow: { color: 0x000000, alpha: 0.18, blur: 0, distance: 7, angle: Math.PI / 2 },
      };

      // BitmapText needs a glyph atlas. Pre-install it once (at screen resolution so it stays sharp).
      // dynamicFill lets us tint each letter without making a new atlas per colour.
      BitmapFont.install({
        name: "PurrBitmap",
        style,
        chars: [["a", "z"], ["A", "Z"], ["0", "9"], " !?.,'-&:;"],
        resolution,
        padding: 10,
        dynamicFill: true,
      });

      /**
       * How to free a split object. Text letters each own a canvas texture, so
       * those are destroyed too. BitmapText letters SHARE the glyph atlas, so
       * we must not destroy textures there (it would break every other letter).
       */
      const destroyOptions = (which: Engine) => (which === "text" ? { children: true, texture: true, textureSource: true } : { children: true });

      /**
       * Build a split-text object for either engine.
       * `sizeNudge` makes the font size microscopically different. The benchmark
       * uses it so every run draws fresh letters instead of reusing PixiJS's
       * cached letter textures (which would make Text look unrealistically fast).
       */
      const makeSplit = (text: string, which: Engine, sizeNudge = 0) =>
        which === "text"
          ? new SplitText({ text, style: { ...style, fontSize: FONT_SIZE + sizeNudge }, charAnchor: 0.5, autoSplit: false })
          : new SplitBitmapText({ text, style: { ...style, fontFamily: "PurrBitmap", fontSize: FONT_SIZE + sizeNudge }, charAnchor: 0.5, autoSplit: false });
      let nudge = 0;

      // per-letter motion state
      type Letter = { glyph: Glyph; homeX: number; homeY: number; ox: number; oy: number; vx: number; vy: number; rot: number; vr: number; phase: number };
      let split: InstanceType<typeof SplitText> | InstanceType<typeof SplitBitmapText> | null = null;
      let splitEngine: Engine = "text";
      let letters: Letter[] = [];

      const layer = new Container();
      app.stage.addChild(layer);

      /** Centre the word and scale it to fit the screen. */
      const fit = () => {
        if (!split) return;
        const w = split.width / split.scale.x;
        const h = split.height / split.scale.y;
        const s = Math.min(1.25, (app.screen.width * 0.86) / Math.max(1, w), (app.screen.height * 0.5) / Math.max(1, h));
        split.scale.set(s);
        split.x = app.screen.width / 2 - (w * s) / 2;
        split.y = app.screen.height * 0.47 - (h * s) / 2;
        // Text letters can be re-drawn at a higher resolution when the word is
        // scaled up, so they stay sharp on big screens. (BitmapText can't: its
        // glyphs come from a pre-drawn atlas, so scaling up makes them softer.)
        if (splitEngine === "text") {
          const res = resolution * Math.max(1, s);
          for (const c of split.chars as InstanceType<typeof PIXI.Text>[]) if (c.resolution !== res) c.resolution = res;
        }
      };

      /** Show a word with the chosen engine, measuring how long the rebuild takes. */
      const show = (text: string, which: Engine) => {
        const t0 = performance.now();
        if (split) {
          layer.removeChild(split);
          split.destroy(destroyOptions(splitEngine));
        }
        splitEngine = which;
        split = makeSplit(text, which);
        split.split(); // build the per-letter objects now
        layer.addChild(split);
        app.render(); // include the cost of drawing/uploading the letters
        const ms = performance.now() - t0;
        if (buildMsRef.current) buildMsRef.current.textContent = ms.toFixed(1);

        letters = split.chars.map((glyph, i) => {
          glyph.tint = PALETTE[i % PALETTE.length];
          return { glyph, homeX: glyph.x, homeY: glyph.y, ox: 0, oy: 0, vx: 0, vy: 0, rot: 0, vr: 0, phase: Math.random() * Math.PI * 2 };
        });
        fit();
      };

      // ----- Mouse: the stage listens everywhere (hitArea = whole screen)
      const pointer = { x: 0, y: 0, active: false };
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      app.stage.on("globalpointermove", (e) => {
        pointer.x = e.global.x;
        pointer.y = e.global.y;
        pointer.active = true;
      });
      const onLeave = () => (pointer.active = false);
      app.canvas.addEventListener("pointerleave", onLeave);
      app.renderer.on("resize", fit);

      // ----- Every frame: purr + scatter + spring back
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let frameAvg = 0;
      let frameNo = 0;
      const tmp = new PIXI.Point();
      app.ticker.add((ticker) => {
        const start = performance.now();
        const dt = Math.min(ticker.deltaMS, 50) / 1000;
        const t = performance.now() / 1000;
        const s = split ? split.scale.x : 1;
        // purr loudness rises and falls like breathing (about one breath every 2 seconds)
        const breath = reduced ? 0 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * Math.PI));

        for (const L of letters) {
          let ax = -SPRING * L.ox - DAMPING * L.vx;
          let ay = -SPRING * L.oy - DAMPING * L.vy;
          let ar = -SPRING * L.rot - DAMPING * L.vr;
          if (pointer.active) {
            L.glyph.getGlobalPosition(tmp);
            const dx = tmp.x - pointer.x;
            const dy = tmp.y - pointer.y;
            const d = Math.hypot(dx, dy) || 0.001;
            if (d < REACH) {
              const f = ((1 - d / REACH) ** 2 * PUSH) / s; // push in the letter's own (scaled) space
              ax += (dx / d) * f;
              ay += (dy / d) * f;
              ar += (dx > 0 ? 1 : -1) * f * 0.004; // a little spin as it's knocked away
            }
          }
          L.vx += ax * dt;
          L.vy += ay * dt;
          L.vr += ar * dt;
          L.ox += L.vx * dt;
          L.oy += L.vy * dt;
          L.rot += L.vr * dt;

          // the purr: a fast, tiny tremble
          const p = PURR_PX * breath;
          const jx = Math.sin(t * PURR_HZ * 2 * Math.PI + L.phase) * p;
          const jy = Math.cos(t * PURR_HZ * 1.7 * Math.PI + L.phase * 1.3) * p;
          L.glyph.x = L.homeX + L.ox + jx;
          L.glyph.y = L.homeY + L.oy + jy;
          L.glyph.rotation = L.rot + jx * 0.004;
        }

        // live stats (JS time per frame for the letters, averaged)
        frameAvg = frameAvg * 0.95 + (performance.now() - start) * 0.05;
        if (++frameNo % 15 === 0) {
          if (frameMsRef.current) frameMsRef.current.textContent = frameAvg.toFixed(2);
          if (fpsRef.current) fpsRef.current.textContent = String(Math.round(ticker.FPS));
        }
      });

      /**
       * Benchmark: for each engine, measure
       *  - build time for the current word and for a ~170-character sentence
       *    (create + split + first render, which includes drawing glyphs and GPU upload)
       *  - time per frame to move all ~170 letters and render them
       */
      const benchmark = async (): Promise<BenchRow[]> => {
        const rows: BenchRow[] = [];
        const stage = new Container();
        const pause = () => new Promise((r) => setTimeout(r, 0));
        for (const which of ["text", "bitmap"] as Engine[]) {
          const build = (text: string) => {
            const runs: number[] = [];
            for (let i = 0; i < 5; i++) {
              const t0 = performance.now();
              const sp = makeSplit(text, which, (nudge += 0.001));
              sp.split();
              stage.addChild(sp);
              app.renderer.render({ container: stage });
              runs.push(performance.now() - t0);
              stage.removeChild(sp);
              sp.destroy(destroyOptions(which));
            }
            runs.sort((a, b) => a - b);
            return runs[2]; // median of 5
          };
          const buildShort = build(latest.current.word);
          await pause();
          const buildLong = build(LONG_TEXT);
          await pause();

          // per-frame cost with ~170 animated letters
          const sp = makeSplit(LONG_TEXT, which);
          sp.split();
          sp.scale.set(0.15);
          stage.addChild(sp);
          app.renderer.render({ container: stage });
          const chars = sp.chars;
          const homes = chars.map((c) => [c.x, c.y]);
          const t0 = performance.now();
          const FRAMES = 120;
          for (let f = 0; f < FRAMES; f++) {
            for (let i = 0; i < chars.length; i++) {
              chars[i].x = homes[i][0] + Math.sin(f + i) * 2;
              chars[i].y = homes[i][1] + Math.cos(f + i) * 2;
              chars[i].rotation = Math.sin(f * 0.1 + i) * 0.05;
            }
            app.renderer.render({ container: stage });
          }
          const frameLong = (performance.now() - t0) / FRAMES;
          stage.removeChild(sp);
          sp.destroy(destroyOptions(which));
          rows.push({ engine: which === "text" ? "SplitText (Text)" : "SplitBitmapText (BitmapText)", buildShort, buildLong, frameLong });
          await pause();
        }
        stage.destroy();
        return rows;
      };

      api.current = { show, benchmark };
      show(latest.current.word, latest.current.engine);

      cleanup = () => {
        api.current = null;
        app.canvas.removeEventListener("pointerleave", onLeave);
        BitmapFont.uninstall("PurrBitmap");
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  // Rebuild the letters when the word or engine changes
  useEffect(() => {
    api.current?.show(word, engine);
  }, [word, engine]);

  const runBenchmark = async () => {
    if (!api.current || benchRunning) return;
    setBenchRunning(true);
    setBench(null);
    await new Promise((r) => setTimeout(r, 30)); // let the button update first
    const rows = await api.current.benchmark();
    setBench(rows);
    setBenchRunning(false);
    api.current.show(word, engine); // restore the live word
  };

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      <div ref={hostRef} className={styles.stage} aria-hidden="true" />
      <p className={styles.srOnly} aria-live="polite">
        The word “{word}” in large purring letters. Move the mouse over it to scatter the letters.
      </p>

      <header className={styles.topBar}>
        <BackHome accent="#ec8e85" />
        <h1 className={styles.title}>Purr Type</h1>
        <span />
      </header>

      <div className={styles.panel}>
        <label className={styles.inputWrap}>
          <span className={styles.srOnly}>Your word</span>
          <input
            className={styles.input}
            value={input}
            maxLength={MAX_CHARS}
            placeholder={DEFAULT_WORD}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <div className={styles.group} role="group" aria-label="Text engine">
          <button type="button" className={styles.chip} aria-pressed={engine === "text"} onClick={() => setEngine("text")}>
            SplitText
          </button>
          <button type="button" className={styles.chip} aria-pressed={engine === "bitmap"} onClick={() => setEngine("bitmap")}>
            SplitBitmapText
          </button>
        </div>

        <button type="button" className={styles.benchButton} onClick={runBenchmark} disabled={benchRunning}>
          {benchRunning ? "Measuring…" : "Run benchmark"}
        </button>

        <p className={styles.stats}>
          rebuild <span ref={buildMsRef}>–</span> ms · letters <span ref={frameMsRef}>–</span> ms/frame · <span ref={fpsRef}>–</span> fps
        </p>
      </div>

      {bench && (
        <div className={styles.bench} role="region" aria-label="Benchmark results">
          <button type="button" className={styles.benchClose} onClick={() => setBench(null)} aria-label="Close results">
            ×
          </button>
          <p className={styles.benchTitle}>Benchmark (median of 5 fresh builds)</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Engine</th>
                <th className={styles.th}>Build “{word}”</th>
                <th className={styles.th}>Build 170 chars</th>
                <th className={styles.th}>Frame, 170 letters</th>
              </tr>
            </thead>
            <tbody>
              {bench.map((r) => (
                <tr key={r.engine}>
                  <td className={styles.td}>{r.engine}</td>
                  <td className={styles.td}>{r.buildShort.toFixed(1)} ms</td>
                  <td className={styles.td}>{r.buildLong.toFixed(1)} ms</td>
                  <td className={styles.td}>{r.frameLong.toFixed(2)} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
