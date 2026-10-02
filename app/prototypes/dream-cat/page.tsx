"use client";

/**
 * Dream Cat
 *
 * The orange tabby from the homepage, drawn by PixiJS as a sprite, with a
 * panel of sliders that change four effects: blur, a wavy "dream" filter,
 * colour shift and glow. Moving the mouse (or a finger) across the cat sends
 * ripples through the picture, like dragging a hand through water.
 *
 * How it fits together:
 * 1. The cat drawing is a React SVG component (TabbyArt). We turn it into a
 *    string of SVG, load it as an image, and give that image to PixiJS as a
 *    texture. A sprite then displays the texture.
 * 2. Effects are PixiJS "filters": small GPU programs that change pixels
 *    after the cat is drawn. They are chained: blur → dream + ripples → colour.
 * 3. The glow is a second, blurred copy of the cat placed behind it and drawn
 *    with the "add" blend mode, so it brightens the background like light.
 * 4. The sliders are ordinary HTML <input type="range"> elements. That means
 *    keyboards, screen readers and touch all work without extra code. Each
 *    slider just writes its value into the matching filter.
 *
 * Accessibility:
 * - Every slider has a visible <label> and announces its value with units.
 * - The picture can be focused with Tab. Arrow keys move a ripple marker and
 *   Enter/Space drops a ripple, so keyboard users get the water effect too.
 *   A polite live region tells screen-reader users where the ripple landed.
 * - With "reduce motion" switched on in the system settings, the dream waves
 *   stop drifting on their own (ripples still happen when you ask for them).
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BackHome from "../../components/back-home/BackHome";
import { GrainFilter, TabbyArt } from "../../components/playful-cats/PlayfulCats";
import { caveat, instrumentSans } from "../../fonts";
import styles from "./styles.module.css";

/* ---------- Slider settings ---------- */

type EffectKey = "blur" | "dream" | "hue" | "glow";

type EffectInfo = {
  label: string;
  min: number;
  max: number;
  step: number;
  /** How the value is shown on screen and read out by screen readers */
  format: (value: number) => string;
  hint: string;
};

const EFFECTS: Record<EffectKey, EffectInfo> = {
  blur: { label: "Blur", min: 0, max: 12, step: 0.5, format: (v) => `${v} px`, hint: "Softens the whole picture." },
  dream: { label: "Dream waves", min: 0, max: 100, step: 1, format: (v) => `${v}%`, hint: "Slow, wavy wobble, like a dream." },
  hue: { label: "Colour shift", min: -180, max: 180, step: 1, format: (v) => `${v > 0 ? "+" : ""}${v}°`, hint: "Turns the colour wheel." },
  glow: { label: "Glow", min: 0, max: 100, step: 1, format: (v) => `${v}%`, hint: "A warm light around the cat." },
};

const EFFECT_ORDER: EffectKey[] = ["blur", "dream", "hue", "glow"];

const DEFAULTS: Record<EffectKey, number> = { blur: 0, dream: 35, hue: 0, glow: 45 };

/** The tabby's drawing is 280 × 175 units (its SVG viewBox). */
const ART_W = 280;
const ART_H = 175;

/** The shader keeps track of this many ripples at once. */
const MAX_RIPPLES = 8;
/** Ripples fade out after this many seconds. */
const RIPPLE_LIFE = 2.4;

/* ---------- The dream + ripple shader (GLSL, runs on the graphics card) ---------- */

/*
 * For every pixel, this works out a small offset and reads the colour from
 * that nearby spot instead. Offsetting by a sine wave makes things wobble.
 *
 * - vTextureCoord: where this pixel is, from 0 to 1 across the filtered area.
 * - uInputSize / uOutputFrame: provided by PixiJS, used to convert that into
 *   screen pixels so the ripples line up with the mouse.
 * - uRipples: one vec4 per ripple: x, y (screen px), age (seconds), strength.
 */
const dreamFragment = /* glsl */ `
// High precision: screen-pixel maths needs it, and it must match PixiJS's vertex shader
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uInputClamp;

uniform float uTime;
uniform float uDream;
uniform vec4 uRipples[${MAX_RIPPLES}];

void main() {
  // This pixel's position in screen pixels (CSS pixels, like mouse positions)
  vec2 px = vTextureCoord * uInputSize.xy + uOutputFrame.xy;
  vec2 offset = vec2(0.0);

  // 1. Dream waves: a few slow sine waves layered together
  float a = uDream * 12.0;
  offset.x += sin(px.y * 0.035 + uTime * 1.3) * a + sin(px.y * 0.011 - uTime * 0.7) * a * 0.6;
  offset.y += cos(px.x * 0.028 + uTime * 1.1) * a * 0.5;

  // 2. Water ripples: rings that travel outward from each touch point
  for (int i = 0; i < ${MAX_RIPPLES}; i++) {
    vec4 r = uRipples[i];
    if (r.w <= 0.0) continue;
    vec2 d = px - r.xy;
    float dist = length(d);
    float ring = dist - r.z * 230.0;                       // distance from the moving ring
    float band = exp(-(ring * ring) / (2.0 * 34.0 * 34.0)); // only near the ring
    float fade = exp(-r.z * 1.7);                           // weaker as it ages
    float wave = sin(ring * 0.16) * band * fade * r.w * 11.0;
    if (dist > 0.001) offset += (d / dist) * wave;
  }

  // Convert the pixel offset back to texture coordinates, stay inside the texture
  vec2 uv = vTextureCoord + offset * uInputSize.zw;
  uv = clamp(uv, uInputClamp.xy, uInputClamp.zw);
  finalColor = texture(uTexture, uv);
}
`;

/* ---------- Helpers ---------- */

/** Turns the React cat drawing into an <img> the browser has finished loading. */
function loadCatImage(scale: number): Promise<HTMLImageElement> {
  const svg = renderToStaticMarkup(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${ART_W} ${ART_H}`} width={ART_W * scale} height={ART_H * scale}>
      <defs>
        <GrainFilter />
      </defs>
      <TabbyArt />
    </svg>,
  );
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Describes a spot on the cat in words, for the screen-reader announcement. */
function describeSpot(fx: number, fy: number) {
  const part = fx < 0.36 ? "its head" : fx < 0.72 ? "its back" : "its tail";
  const height = fy < 0.4 ? "top of " : fy > 0.72 ? "bottom of " : "";
  return `${height}${part}`;
}

/** Everything the PixiJS code needs from React, kept in one ref. */
type Engine = {
  setEffect: (key: EffectKey, value: number) => void;
  /** Drop a ripple at a spot on the cat, given as 0–1 fractions of its size */
  rippleAt: (fx: number, fy: number, strength?: number) => void;
  /** Show or hide the keyboard ripple marker */
  setMarker: (fx: number, fy: number, visible: boolean) => void;
};

/* ---------- The page ---------- */

export default function DreamCat() {
  const stageRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [values, setValues] = useState(DEFAULTS);
  const valuesRef = useRef(values);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [announcement, setAnnouncement] = useState("");
  // Keyboard ripple marker position, as fractions of the cat's width/height
  const marker = useRef({ x: 0.5, y: 0.55 });

  useEffect(() => {
    const host = stageRef.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      // PixiJS is loaded here (in the browser only), not during the server build
      const { Application, BlurFilter, ColorMatrixFilter, Container, Filter, Graphics, Sprite, Texture, defaultFilterVert } = await import("pixi.js");

      const resolution = Math.min(window.devicePixelRatio || 1, 2);
      const app = new Application();
      await app.init({
        resizeTo: host,
        backgroundAlpha: 0, // see-through: the dusk gradient is CSS behind the canvas
        antialias: true,
        autoDensity: true,
        resolution,
        preference: "webgl", // our custom shader is written for WebGL
      });
      // React may unmount us while init() was running (dev mode mounts twice)
      if (cancelled) {
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
        return;
      }
      app.canvas.classList.add(styles.canvas);
      app.canvas.setAttribute("aria-hidden", "true"); // the wrapper describes it instead
      host.appendChild(app.canvas);

      // ----- 1. The cat texture (drawn at 3× so it stays crisp when scaled up)
      const TEXTURE_SCALE = 3;
      let texture;
      try {
        texture = Texture.from(await loadCatImage(TEXTURE_SCALE));
      } catch {
        setStatus("error");
        return;
      }
      if (cancelled) return;

      // ----- 2. Build the scene: [glow copy behind] + [the cat], in one container
      const scene = new Container();
      app.stage.addChild(scene);

      const glow = new Sprite({ texture, anchor: 0.5 });
      glow.tint = 0xffc46b; // warm golden light
      glow.blendMode = "add"; // adds light instead of covering what's behind
      glow.filters = [new BlurFilter({ strength: 22, quality: 4 })];
      scene.addChild(glow);

      const cat = new Sprite({ texture, anchor: 0.5 });
      scene.addChild(cat);

      // Marker that shows where a keyboard ripple will land (hidden by default)
      const markerRing = new Graphics()
        .circle(0, 0, 14)
        .stroke({ width: 2, color: 0xfffaf2, alpha: 0.95 })
        .circle(0, 0, 3)
        .fill({ color: 0xfffaf2 });
      markerRing.visible = false;
      app.stage.addChild(markerRing);

      // ----- 3. Filters, applied to the container in this order
      const blur = new BlurFilter({ strength: 0, quality: 4 });

      const rippleData = new Float32Array(MAX_RIPPLES * 4); // x, y, age, strength × 8
      const dream = Filter.from({
        gl: { vertex: defaultFilterVert, fragment: dreamFragment }, // PixiJS's standard filter vertex shader
        resources: {
          dreamUniforms: {
            uTime: { value: 0, type: "f32" },
            uDream: { value: 0, type: "f32" },
            uRipples: { value: rippleData, type: "vec4<f32>", size: MAX_RIPPLES },
          },
        },
        resolution, // match the screen so the cat stays sharp
      });
      const uniforms = dream.resources.dreamUniforms.uniforms;

      const colour = new ColorMatrixFilter();

      scene.filters = [blur, dream, colour];
      // Filter the whole canvas area, so waves and glow are never clipped at the cat's edges
      scene.filterArea = app.screen;

      // ----- 4. Layout: centre the cat and size it to the stage
      const layout = () => {
        const { width, height } = app.screen;
        const scale = Math.min((width * 0.78) / ART_W, (height * 0.7) / ART_H) / TEXTURE_SCALE;
        for (const s of [glow, cat]) {
          s.position.set(width / 2, height / 2);
        }
        cat.scale.set(scale);
        glow.scale.set(scale * 1.05);
      };
      layout();
      app.renderer.on("resize", layout);

      /** Converts a 0–1 spot on the cat into screen pixels. */
      const spotToScreen = (fx: number, fy: number) => {
        const b = cat.getBounds();
        return { x: b.x + fx * b.width, y: b.y + fy * b.height };
      };

      // ----- 5. Ripples
      let nextRipple = 0;
      const addRipple = (x: number, y: number, strength = 1) => {
        const i = nextRipple * 4;
        rippleData[i] = x;
        rippleData[i + 1] = y;
        rippleData[i + 2] = 0; // age
        rippleData[i + 3] = strength;
        nextRipple = (nextRipple + 1) % MAX_RIPPLES; // reuse the oldest slot
      };

      // Mouse / touch: drop a ripple every ~22px of movement over the cat
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      let last: { x: number; y: number } | null = null;
      app.stage.on("pointermove", (e) => {
        const b = cat.getBounds();
        const { x, y } = e.global;
        const overCat = x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
        if (!overCat) {
          last = null;
          return;
        }
        if (!last || Math.hypot(x - last.x, y - last.y) > 22) {
          const speed = last ? Math.min(Math.hypot(x - last.x, y - last.y) / 40, 1.3) : 0.7;
          addRipple(x, y, 0.5 + speed * 0.5);
          last = { x, y };
        }
      });
      app.stage.on("pointerleave", () => (last = null));
      app.stage.on("pointerdown", (e) => addRipple(e.global.x, e.global.y, 1.3));

      // ----- 6. Animation: drift the dream waves, age the ripples
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS / 1000;
        if (!reduceMotion.matches) uniforms.uTime += dt;
        for (let i = 0; i < MAX_RIPPLES; i++) {
          const k = i * 4;
          if (rippleData[k + 3] <= 0) continue;
          rippleData[k + 2] += dt;
          if (rippleData[k + 2] > RIPPLE_LIFE) rippleData[k + 3] = 0; // finished
        }
        dream.resources.dreamUniforms.update(); // tell PixiJS the numbers changed
      });

      // ----- 7. Connect the React sliders to the filters
      const setEffect = (key: EffectKey, value: number) => {
        if (key === "blur") {
          blur.strength = value;
          blur.enabled = value > 0; // skip the work entirely at 0
        } else if (key === "dream") {
          uniforms.uDream = value / 100;
        } else if (key === "hue") {
          colour.hue(value, false); // false = replace, don't stack on top
          colour.enabled = value !== 0;
        } else {
          glow.alpha = (value / 100) * 0.9;
          glow.visible = value > 0;
        }
      };
      for (const key of EFFECT_ORDER) setEffect(key, valuesRef.current[key]);

      engineRef.current = {
        setEffect,
        rippleAt: (fx, fy, strength = 1.2) => {
          const p = spotToScreen(fx, fy);
          addRipple(p.x, p.y, strength);
        },
        setMarker: (fx, fy, visible) => {
          const p = spotToScreen(fx, fy);
          markerRing.position.set(p.x, p.y);
          markerRing.visible = visible;
        },
      };
      setStatus("ready");

      cleanup = () => {
        engineRef.current = null;
        app.renderer.off("resize", layout);
        app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true, texture: true, textureSource: true });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  const updateEffect = useCallback((key: EffectKey, value: number) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      valuesRef.current = next;
      return next;
    });
    engineRef.current?.setEffect(key, value);
  }, []);

  const resetAll = () => {
    for (const key of EFFECT_ORDER) updateEffect(key, DEFAULTS[key]);
    setAnnouncement("All effects reset.");
  };

  /* Keyboard control for the picture: arrows move the marker, Enter/Space ripples */
  const onStageKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.15 : 0.05;
    const m = marker.current;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (e.key in moves) {
      e.preventDefault(); // don't scroll the page
      const [dx, dy] = moves[e.key];
      m.x = Math.min(0.95, Math.max(0.05, m.x + dx));
      m.y = Math.min(0.95, Math.max(0.05, m.y + dy));
      engineRef.current?.setMarker(m.x, m.y, true);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      engineRef.current?.rippleAt(m.x, m.y);
      // Adding a zero-width space when the text repeats makes screen readers say it again
      const text = `Ripple across ${describeSpot(m.x, m.y)}.`;
      setAnnouncement((prev) => (prev === text ? `${text}​` : text));
    }
  };

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      <header className={styles.header}>
        <BackHome accent="#f0893d" />
        <h1 className={styles.title}>Dream Cat</h1>
      </header>

      <main className={styles.layout}>
        <div
          ref={stageRef}
          className={styles.stage}
          tabIndex={0}
          // "application" lets the arrow keys reach our code instead of the screen reader
          role="application"
          aria-label="Dream cat picture: an orange tabby lying down with its paws stretched forward, glowing softly on a dusky background."
          aria-describedby="dream-cat-help"
          onKeyDown={onStageKey}
          onFocus={() => engineRef.current?.setMarker(marker.current.x, marker.current.y, true)}
          onBlur={() => engineRef.current?.setMarker(marker.current.x, marker.current.y, false)}
        >
          {status === "loading" && <p className={styles.notice}>Waking the cat…</p>}
          {status === "error" && <p className={styles.notice}>Sorry, the cat couldn&apos;t be drawn in this browser.</p>}
        </div>

        <section className={styles.panel} aria-labelledby="dream-cat-effects">
          <h2 id="dream-cat-effects" className={styles.panelTitle}>
            Effects
          </h2>

          {EFFECT_ORDER.map((key) => {
            const info = EFFECTS[key];
            const id = `dream-cat-${key}`;
            return (
              <div key={key} className={styles.control}>
                <div className={styles.controlRow}>
                  <label htmlFor={id} className={styles.controlLabel}>
                    {info.label}
                  </label>
                  <output htmlFor={id} className={styles.controlValue}>
                    {info.format(values[key])}
                  </output>
                </div>
                <input
                  id={id}
                  className={styles.slider}
                  type="range"
                  min={info.min}
                  max={info.max}
                  step={info.step}
                  value={values[key]}
                  aria-valuetext={info.format(values[key])}
                  aria-describedby={`${id}-hint`}
                  onChange={(e) => updateEffect(key, Number(e.target.value))}
                />
                <p id={`${id}-hint`} className={styles.controlHint}>
                  {info.hint}
                </p>
              </div>
            );
          })}

          <button type="button" className={styles.reset} onClick={resetAll}>
            Reset effects
          </button>

          <p id="dream-cat-help" className={styles.help}>
            Move your mouse or finger across the cat to make ripples. With a keyboard, focus the picture, move
            the marker with the arrow keys (hold Shift for bigger steps), and press Enter or Space to make a
            ripple.
          </p>
        </section>

        {/* Screen readers read this out politely when it changes */}
        <p className={styles.srOnly} aria-live="polite">
          {announcement}
        </p>
      </main>
    </div>
  );
}
