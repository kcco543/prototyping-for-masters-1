"use client";

/**
 * Catnip Fireworks — click anywhere to burst hundreds of paw prints and stars.
 *
 * Built with PixiJS v8 and a ParticleContainer, which draws thousands of
 * small images in a single GPU draw call. How it works:
 *
 * 1. One shared texture ("sprite sheet"): a white paw print and a white star
 *    are drawn with PixiJS Graphics and baked into ONE texture. A
 *    ParticleContainer needs every particle to share the same base texture;
 *    each particle just uses a different frame (rectangle) of it. They're
 *    white so each particle can be tinted any colour from the palette.
 * 2. Each click adds a few hundred particles with a random speed, direction,
 *    spin, size and colour.
 * 3. Every frame (the ticker), each particle moves, falls with gravity,
 *    slows a little with air drag, and fades out near the end of its life.
 *    Dead particles are removed in one go, then container.update() is called
 *    once (cheaper than removing them one by one).
 *
 * PixiJS is loaded inside useEffect with a dynamic import, so it only ever
 * runs in the browser (it needs a real canvas and WebGL).
 */

import { useEffect, useRef } from "react";
import BackHome from "../../components/back-home/BackHome";
import { caveat, instrumentSans } from "../../fonts";
import styles from "./styles.module.css";

/** The homepage cat palette (fur colours from the cat illustrations) */
const PALETTE = [0xf0893d, 0xec8e85, 0xf3c04a, 0xaaa99d, 0xb8633a, 0xfffaf2, 0xe97fc7];

/* ---------- Tuning ---------- */
const BURST = 260; // particles per click
const STREAM = 18; // particles per pointer move while holding the mouse down
const MAX_PARTICLES = 15000; // safety cap: the oldest particles are dropped beyond this
const GRAVITY = 900; // px per second²
const DRAG = 0.6; // air resistance (fraction of speed lost per second)

export default function CatnipFireworks() {
  const hostRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const fpsRef = useRef<HTMLSpanElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const { Application, Graphics, Particle, ParticleContainer, Rectangle, Texture } = await import("pixi.js");

      /** A particle that also remembers its own motion and age. */
      class Spark extends Particle {
        vx = 0;
        vy = 0;
        spin = 0;
        age = 0;
        life = 1;
      }

      // ----- 1. Create the PixiJS application (v8: options go to init(), not the constructor)
      const app = new Application();
      await app.init({
        resizeTo: host,
        backgroundAlpha: 0, // transparent: the night-sky gradient is CSS behind the canvas
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: "webgl",
      });
      // React may have unmounted us while init() was running (e.g. dev mode mounts twice)
      if (cancelled) {
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
        return;
      }
      app.canvas.classList.add(styles.canvas);
      host.appendChild(app.canvas);

      // ----- 2. Draw a paw print and a star side by side, then bake them into one texture
      const CELL = 64;
      const art = new Graphics();
      // paw print, centred in the left cell: one big pad + four toe beans
      art.ellipse(32, 40, 15, 12.5).fill(0xffffff);
      art.ellipse(13, 24, 6, 7.5).fill(0xffffff);
      art.ellipse(24, 13, 6, 7.5).fill(0xffffff);
      art.ellipse(40, 13, 6, 7.5).fill(0xffffff);
      art.ellipse(51, 24, 6, 7.5).fill(0xffffff);
      // star, centred in the right cell
      art.star(CELL + 32, 33, 5, 28, 12).fill(0xffffff);
      const sheet = app.renderer.generateTexture({ target: art, frame: new Rectangle(0, 0, CELL * 2, CELL), resolution: 2, antialias: true });
      art.destroy();
      const pawTexture = new Texture({ source: sheet.source, frame: new Rectangle(0, 0, CELL, CELL) });
      const starTexture = new Texture({ source: sheet.source, frame: new Rectangle(CELL, 0, CELL, CELL) });

      // ----- 3. The particle container
      const sparks = new ParticleContainer({
        texture: sheet,
        // only what changes every frame is re-uploaded to the GPU
        dynamicProperties: { position: true, rotation: true, color: true, vertex: false, uvs: false },
        // ParticleContainer doesn't compute its own bounds: tell it the area it covers
        boundsArea: new Rectangle(0, 0, app.screen.width, app.screen.height),
      });
      app.stage.addChild(sparks);
      app.renderer.on("resize", (w: number, h: number) => {
        sparks.boundsArea = new Rectangle(0, 0, w, h);
      });

      const list = sparks.particleChildren as Spark[];

      /** Release `count` particles at (x, y). `power` scales how far they fly. */
      const burst = (x: number, y: number, count: number, power = 1) => {
        // each burst favours three palette colours, so bursts look different from each other
        const colours = [0, 1, 2].map(() => PALETTE[Math.floor(Math.random() * PALETTE.length)]);
        for (let i = 0; i < count; i++) {
          const isStar = Math.random() < 0.3;
          const p = new Spark({
            texture: isStar ? starTexture : pawTexture,
            x,
            y,
            anchorX: 0.5,
            anchorY: 0.5,
            rotation: Math.random() * Math.PI * 2,
            tint: Math.random() < 0.85 ? colours[i % 3] : PALETTE[Math.floor(Math.random() * PALETTE.length)],
          });
          const size = (isStar ? 0.18 : 0.22) + Math.random() * (isStar ? 0.32 : 0.28);
          p.scaleX = size;
          p.scaleY = size;
          const angle = Math.random() * Math.PI * 2;
          const speed = (120 + Math.random() ** 0.6 * 560) * power;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 260 * power; // a little upward kick, like a firework
          p.spin = (Math.random() - 0.5) * 8;
          p.life = 1.4 + Math.random() * 1.6;
          list.push(p);
        }
        // over the cap? drop the oldest particles
        if (list.length > MAX_PARTICLES) list.splice(0, list.length - MAX_PARTICLES);
        sparks.update(); // one update for the whole batch
        if (hintRef.current) hintRef.current.dataset.hidden = "true";
      };

      // ----- 4. Every frame: move, fall, fade, and remove finished particles
      let frame = 0;
      app.ticker.add((ticker) => {
        const dt = Math.min(ticker.deltaMS, 50) / 1000; // seconds (capped after a pause)
        const drag = Math.exp(-DRAG * dt);
        let alive = 0;
        for (let i = 0; i < list.length; i++) {
          const p = list[i];
          p.age += dt;
          if (p.age >= p.life) continue; // finished: skip it (it gets dropped below)
          p.vy += GRAVITY * dt;
          p.vx *= drag;
          p.vy *= drag;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rotation += p.spin * dt;
          // fully visible for the first 40% of its life, then fades out
          const t = p.age / p.life;
          p.alpha = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
          list[alive++] = p; // keep it (compacting the array as we go)
        }
        if (alive !== list.length) {
          list.length = alive;
          sparks.update();
        }
        if (++frame % 10 === 0) {
          if (countRef.current) countRef.current.textContent = list.length.toLocaleString();
          if (fpsRef.current) fpsRef.current.textContent = String(Math.round(ticker.FPS));
        }
      });

      // ----- 5. Input: click / tap to burst, hold and drag to stream, keyboard for a random burst
      let holding = false;
      let lastStream = 0;
      const local = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top] as const;
      };
      const onDown = (e: PointerEvent) => {
        if (e.target instanceof Element && e.target.closest("a, button")) return;
        holding = true;
        const [x, y] = local(e);
        burst(x, y, BURST);
      };
      const onMove = (e: PointerEvent) => {
        if (!holding) return;
        const now = performance.now();
        if (now - lastStream < 16) return;
        lastStream = now;
        const [x, y] = local(e);
        burst(x, y, STREAM, 0.6);
      };
      const onUp = () => (holding = false);
      const onKey = (e: KeyboardEvent) => {
        // ignore keys pressed while a link/button/field has focus (they have their own Enter/Space)
        const inControl = e.target instanceof Element && e.target.closest("a, button, input");
        if ((e.key === " " || e.key === "Enter") && !inControl) {
          e.preventDefault();
          burst(app.screen.width * (0.2 + Math.random() * 0.6), app.screen.height * (0.25 + Math.random() * 0.4), BURST);
        }
      };
      host.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("keydown", onKey);

      // a welcome burst so the sky isn't empty
      burst(app.screen.width / 2, app.screen.height * 0.45, BURST, 0.9);

      cleanup = () => {
        host.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("keydown", onKey);
        // releaseGlobalResources avoids stale textures if the page is opened again in the same tab
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      {/* PixiJS puts its canvas in here; clicks anywhere in it make fireworks */}
      <div ref={hostRef} className={styles.sky} role="application" aria-label="Night sky. Click or tap anywhere, or press Space, to launch catnip fireworks." />

      <header className={styles.topBar}>
        <BackHome accent="#f0893d" />
        <h1 className={styles.title}>Catnip Fireworks</h1>
        <span />
      </header>

      <p ref={hintRef} className={styles.hint}>
        Click anywhere · hold and drag for a stream · Space for a surprise
      </p>

      <p className={styles.stats} aria-hidden="true">
        <span ref={countRef}>0</span> particles · <span ref={fpsRef}>60</span> fps
      </p>
    </div>
  );
}
