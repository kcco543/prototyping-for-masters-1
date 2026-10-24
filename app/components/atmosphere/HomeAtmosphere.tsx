"use client";

/**
 * The homepage's living atmosphere: a softly moving colour field behind the
 * whole page, and one small controller that lets the page feel the cursor.
 * Its techniques come from Prompt Bond (components/ui/prompt-bond.tsx).
 *
 * WHAT'S ON SCREEN (all behind the page, never clickable)
 *   1. A still colour field: cream with lavender and blush light pooled in
 *      it (plain CSS). It's always there, so the page looks right at once,
 *      and it's ALL you see without WebGL or with reduced motion.
 *   2. The moving field (ShaderField.tsx), which fades in over the still one
 *      once the page has painted, exactly as Prompt Bond's BondField does.
 *   3. A soft glow of warm light that follows the cursor.
 *
 * WHAT THE CONTROLLER DOES (only with a mouse, and only with motion allowed)
 * It eases the cursor's position into a few CSS variables on the page:
 *   --pointer-x, --pointer-y   -1 to 1 across the window. Decorations move
 *                              by different amounts for depth (parallax).
 *   --glow-x, --glow-y         where the soft glow sits, in pixels.
 * and gives each project card a `--near` from 0 to 1, rising smoothly as the
 * cursor approaches it (Prompt Bond's proximityWeight: a smoothstep, so it
 * never snaps). The cards' CSS turns that into a glow.
 *
 * It listens passively and draws nothing itself, so it can't get in the way
 * of a click, the cat tree's dragging or the cats chasing the laser dot.
 * Its frame loop only runs while something is still easing, then stops.
 */

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import s from "./HomeAtmosphere.module.css";

// Loaded on its own, only in the browser and only when needed: three.js is big.
const ShaderField = dynamic(() => import("./ShaderField"), { ssr: false });

/* ---------- "May things move?" (Prompt Bond's useMotionVisibility, without the in-view part) ---------- */

function subscribeMotion(listener: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    media.removeEventListener("change", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}
/** Motion is on in a visible tab, unless the visitor asked for reduced motion. */
const readMotion = () => document.visibilityState === "visible" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const readReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Can this browser draw WebGL at all? (No: the still field stays, and nothing breaks.) */
function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** If the shader fails anyway (a lost GPU, an old driver), quietly keep the still field. */
class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("Homepage background: the moving field is unavailable, so the still one stays.", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ---------- The cursor controller ---------- */

/** How close (in px from a card's edge) the cursor has to come before the card starts to notice. */
const NEAR_RADIUS = 140;
const smoothstep = (p: number) => p * p * (3 - 2 * p);

function usePointerAtmosphere(host: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const page = host.current?.parentElement;
    if (!page || !enabled) return;
    // A mouse or a trackpad only: on a touch screen there's no cursor to follow.
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const target = { x: 0, y: 0, gx: window.innerWidth / 2, gy: window.innerHeight / 3, inside: false };
    const eased = { x: 0, y: 0, gx: target.gx, gy: target.gy, glow: 0 };
    const cards = () => Array.from(page.querySelectorAll<HTMLElement>("[data-proximity]"));
    const near = new Map<HTMLElement, number>();
    let raf = 0;

    const paint = () => {
      raf = 0;
      // Ease towards the cursor: a fifth of the way each frame (soft, never snappy).
      const k = 0.18;
      eased.x += (target.x - eased.x) * k;
      eased.y += (target.y - eased.y) * k;
      eased.gx += (target.gx - eased.gx) * k;
      eased.gy += (target.gy - eased.gy) * k;
      eased.glow += ((target.inside ? 1 : 0) - eased.glow) * 0.08;
      page.style.setProperty("--pointer-x", eased.x.toFixed(4));
      page.style.setProperty("--pointer-y", eased.y.toFixed(4));
      page.style.setProperty("--glow-x", `${eased.gx.toFixed(1)}px`);
      page.style.setProperty("--glow-y", `${eased.gy.toFixed(1)}px`);
      page.style.setProperty("--glow-on", eased.glow.toFixed(3));

      // Each card: how near is the cursor to it? 0 far away, 1 on it.
      let moving = false;
      for (const card of cards()) {
        const r = card.getBoundingClientRect();
        const dx = Math.max(r.left - target.gx, 0, target.gx - r.right);
        const dy = Math.max(r.top - target.gy, 0, target.gy - r.bottom);
        const want = target.inside ? smoothstep(1 - Math.min(1, Math.hypot(dx, dy) / NEAR_RADIUS)) : 0;
        const was = near.get(card) ?? 0;
        const now = was + (want - was) * 0.2;
        if (Math.abs(now - was) > 0.002) moving = true;
        if (Math.abs(now - was) > 0.0005 || (now === 0) !== (was === 0)) card.style.setProperty("--near", now < 0.001 ? "0" : now.toFixed(3));
        near.set(card, now < 0.001 ? 0 : now);
        // Over the card: where, inside it (for the soft highlight that follows the cursor on hover).
        if (dx === 0 && dy === 0 && target.inside) {
          card.style.setProperty("--mx", `${(target.gx - r.left).toFixed(0)}px`);
          card.style.setProperty("--my", `${(target.gy - r.top).toFixed(0)}px`);
        }
      }

      // Keep going only while something is still on its way.
      const settling =
        moving ||
        Math.abs(target.x - eased.x) > 0.001 ||
        Math.abs(target.y - eased.y) > 0.001 ||
        Math.abs(target.gx - eased.gx) > 0.5 ||
        Math.abs(target.gy - eased.gy) > 0.5 ||
        Math.abs((target.inside ? 1 : 0) - eased.glow) > 0.005;
      if (settling) raf = requestAnimationFrame(paint);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
      target.gx = e.clientX;
      target.gy = e.clientY;
      target.inside = true;
      wake();
    };
    const onLeave = () => {
      target.inside = false;
      target.x = 0;
      target.y = 0;
      wake();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    // Scrolling moves the cards under a still cursor: re-measure them.
    window.addEventListener("scroll", wake, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", wake);
      for (const name of ["--pointer-x", "--pointer-y", "--glow-x", "--glow-y", "--glow-on"]) page.style.removeProperty(name);
      for (const card of near.keys()) for (const name of ["--near", "--mx", "--my"]) card.style.removeProperty(name);
    };
  }, [host, enabled]);
}

/* ---------- The component ---------- */

export default function HomeAtmosphere() {
  const host = useRef<HTMLDivElement>(null);
  const moving = useSyncExternalStore(subscribeMotion, readMotion, () => false);
  const reduced = useSyncExternalStore(subscribeMotion, readReduced, () => true);
  // Like Prompt Bond's BondField: wait for the page's first paint (and a quiet moment) before starting the shader.
  const [painted, setPainted] = useState(false);
  const [webgl, setWebgl] = useState(false);

  useEffect(() => {
    setWebgl(hasWebGL());
    let second = 0;
    let idle = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(() => setPainted(true), { timeout: 800 });
        else setPainted(true);
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, []);

  usePointerAtmosphere(host, !reduced);

  return (
    <div ref={host} className={s.atmosphere} aria-hidden="true">
      <div className={s.still} />
      {/* No moving field with reduced motion: the still one is the calm version. */}
      {painted && webgl && !reduced && (
        <div className={s.field}>
          <ShaderBoundary>
            <ShaderField moving={moving} />
          </ShaderBoundary>
        </div>
      )}
      <div className={s.glow} />
    </div>
  );
}
