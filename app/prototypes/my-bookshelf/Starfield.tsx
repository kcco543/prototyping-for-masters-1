"use client";

/**
 * A Constellation of Stories — the night sky behind everything.
 *
 * One <canvas> filling the window, with a few hundred tiny stars in three
 * layers of depth. Each frame:
 *   - a third of the stars twinkle, slowly (each with its own rhythm),
 *   - the whole sky drifts a few pixels per second,
 *   - when you drag the star map (or scroll the bookshelf), the layers move
 *     at different speeds: far stars barely, near stars a little more. That
 *     difference (parallax) is what makes the sky feel deep.
 *
 * To save battery it draws at most 30 times a second, and stops when the tab
 * is hidden. If the visitor prefers less motion, it draws once and stays still.
 */

import { useEffect, useRef, type RefObject } from "react";
import { seeded } from "./sky";
import styles from "./styles.module.css";

type Star = { x: number; y: number; r: number; depth: number; alpha: number; twinkle: number; speed: number; phase: number; color: string };

/** Mostly warm ivory, some lavender, a few gold */
const COLORS = ["#f1e8d8", "#f1e8d8", "#f1e8d8", "#f1e8d8", "#cfc6e6", "#cfc6e6", "#e6cf9c"];

export function Starfield({ parallax }: { parallax?: RefObject<{ x: number; y: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const lessMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const MARGIN = 160; // stars are spread over a slightly larger area, so drifting never shows an edge
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastDraw = 0;

    const build = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      // The same seed every time: the sky looks the same on every visit
      const random = seeded(1801);
      const tileWidth = width + MARGIN * 2;
      const tileHeight = height + MARGIN * 2;
      const count = Math.min(900, Math.round((tileWidth * tileHeight) / 2300));
      stars = Array.from({ length: count }, () => {
        const layer = random();
        return {
          x: random() * tileWidth,
          y: random() * tileHeight,
          r: 0.25 + Math.pow(random(), 3.2) * 1.3, // mostly tiny, a few brighter
          depth: layer < 0.6 ? 0.025 : layer < 0.9 ? 0.06 : 0.11,
          alpha: 0.18 + random() * 0.62,
          twinkle: random() < 0.35 ? 0.2 + random() * 0.4 : 0,
          speed: (Math.PI * 2) / (5000 + random() * 8000), // one twinkle every 5 to 13 seconds
          phase: random() * Math.PI * 2,
          color: COLORS[Math.floor(random() * COLORS.length)],
        };
      });
    };

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      const still = lessMotion.matches;
      const drift = still ? 0 : time * 0.04; // map units per second × depth, below
      const offsetX = parallax?.current?.x ?? 0;
      const offsetY = (parallax?.current?.y ?? 0) - window.scrollY * 2;
      const tileWidth = width + MARGIN * 2;
      const tileHeight = height + MARGIN * 2;
      const wrap = (value: number, size: number) => ((value % size) + size) % size;

      for (const star of stars) {
        const x = wrap(star.x + (offsetX + drift) * star.depth, tileWidth) - MARGIN;
        const y = wrap(star.y + offsetY * star.depth + drift * star.depth * 0.35, tileHeight) - MARGIN;
        if (x < -4 || y < -4 || x > width + 4 || y > height + 4) continue;
        const shimmer = star.twinkle && !still ? 1 - star.twinkle * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase)) : 1;
        context.globalAlpha = star.alpha * shimmer;
        context.fillStyle = star.color;
        context.beginPath();
        context.arc(x, y, star.r, 0, Math.PI * 2);
        context.fill();
        // The brightest few get a faint halo
        if (star.r > 1.2) {
          context.globalAlpha = star.alpha * shimmer * 0.12;
          context.beginPath();
          context.arc(x, y, star.r * 3.2, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    const loop = (time: number) => {
      if (time - lastDraw > 32) {
        draw(time);
        lastDraw = time;
      }
      frame = requestAnimationFrame(loop);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      build();
      if (lessMotion.matches) {
        draw(0);
        // Still redraw now and then, so dragging the map still moves the layers
        frame = requestAnimationFrame(function still(time) {
          if (time - lastDraw > 64) {
            draw(0);
            lastDraw = time;
          }
          frame = requestAnimationFrame(still);
        });
      } else {
        frame = requestAnimationFrame(loop);
      }
    };

    start();
    window.addEventListener("resize", start);
    lessMotion.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", start);
      lessMotion.removeEventListener("change", start);
    };
  }, [parallax]);

  return <canvas ref={canvasRef} className={styles.starfield} aria-hidden="true" />;
}
