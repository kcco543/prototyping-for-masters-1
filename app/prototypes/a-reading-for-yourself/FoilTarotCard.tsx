"use client";

/**
 * A tarot card printed on dark card stock with engraved gold details, built
 * on the shared Grain Light Card component (components/ui/grain-light-card.tsx).
 *
 * What it adds on top of Grain Light Card:
 *   - GOLD, NOT RAINBOW: the light that runs along the engraved lines uses a
 *     few warm golds and a hint of lilac (`foilColors`), and every effect is
 *     turned well down, so it reads as foil printed on paper, not a
 *     holographic trading card.
 *   - ENGRAVED LINE ART: the card's borders and ornaments are drawn as SVG
 *     strokes (CardBackLines, CardFaceLines below). Only strokes catch the
 *     light, so these are the parts that glint as you tilt the card. The
 *     card's text and glyphs sit on top as ordinary HTML, unchanged.
 *   - CALM WHEN READ: before it's revealed, the light slowly drifts across
 *     the back (autoSweep). Once revealed, a single golden shimmer passes
 *     over the face, then the card rests and only answers your cursor.
 *
 * The flip itself is Grain Light Card's: the card lifts, tilts and turns
 * over in 3D. Reduced motion: Grain Light Card then holds the light still
 * and turns instantly, and the shimmer is switched off (styles.module.css).
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GrainLightCard } from "@/components/ui/grain-light-card";
import styles from "./styles.module.css";

/** The reading's card size (it was 290 × 470 px before the foil). */
const WIDTH = 290;
const HEIGHT = 470;

/** Warm golds and a whisper of lilac, from the page's palette, instead of the default rainbow. */
const GOLD_FOIL = ["#fbeea4", "#d4af37", "#fff6d8", "#b8892c", "#e8cf8a", "#cdbbe8"] as const;

/** How long the "just revealed" golden shimmer lasts (matches the CSS animation). */
const SHIMMER_MS = 1600;

/*
  The card stock and the line colours, as Grain Light Card's own CSS
  variables. They're set inline because the component's built-in dark theme
  would otherwise win over a class. Values from the page's palette
  (--tarot-card-back / --tarot-card-front and the golds in styles.module.css).
*/
const STOCK: CSSProperties = {
  ["--glc-stock-1" as string]: "#231a3a",
  ["--glc-stock-2" as string]: "#120d20",
  ["--glc-back-1" as string]: "#1d1631",
  ["--glc-back-2" as string]: "#0e0a18",
  ["--glc-line" as string]: "rgba(212, 175, 55, 0.32)",
  ["--glc-line-strong" as string]: "rgba(232, 207, 138, 0.62)",
  ["--glc-ink" as string]: "#f8f5ee",
  /*
    Grain Light Card stops the page scrolling when you drag on it (so a drag
    can tilt it). The reading's cards are tall, so on a phone that would
    trap the page; pan-y lets a vertical swipe scroll while a tap still
    turns the card over.
  */
  touchAction: "pan-y",
};

type Props = {
  /** The card's back: the deck's design (shown until it's revealed). */
  back: ReactNode;
  /** The card's face: its name, glyph and reading. */
  face: ReactNode;
  /** true shows the face. */
  revealed: boolean;
  /** Called when someone clicks, taps or presses Enter on the card to turn it over. */
  onReveal: () => void;
  /** What a screen reader says for the card, e.g. "Click to reveal I. The Origin". */
  label: string;
};

export default function FoilTarotCard({ back, face, revealed, onReveal, label }: Props) {
  // A short golden shimmer right after the card turns face up.
  const [shimmering, setShimmering] = useState(false);
  const wasRevealed = useRef(revealed);

  useEffect(() => {
    const turnedFaceUp = revealed && !wasRevealed.current;
    wasRevealed.current = revealed;
    if (!turnedFaceUp) return;
    setShimmering(true);
    const timer = window.setTimeout(() => setShimmering(false), SHIMMER_MS);
    // Dealt again before the shimmer finished: stop it straight away.
    return () => {
      window.clearTimeout(timer);
      setShimmering(false);
    };
  }, [revealed]);

  return (
    // The shimmer is switched on with a class OUT here, not on the artwork:
    // Grain Light Card rebuilds its light maps whenever its artwork changes.
    <div className={`${styles.foilCard} ${shimmering ? styles.foilCardShimmer : ""}`}>
      <GrainLightCard
        // Grain Light Card's "front" is the side you see first: our deck back.
        front={
          <>
            <CardBackLines />
            {back}
          </>
        }
        back={
          <>
            <CardFaceLines />
            {face}
            <span className={styles.revealShimmer} aria-hidden="true" />
          </>
        }
        flipped={revealed}
        // Only turning face UP is allowed; a revealed card stays revealed until the next deal.
        onFlippedChange={(next) => {
          if (next) onReveal();
        }}
        width="100%"
        aspectRatio={WIDTH / HEIGHT}
        theme="dark"
        foilColors={GOLD_FOIL}
        // Restrained on purpose: the illustration leads, the foil follows.
        flash={shimmering ? 0.8 : revealed ? 0.4 : 0.55}
        foil={revealed ? 0.08 : 0.12}
        glare={revealed ? 0.28 : 0.35}
        sparkle={shimmering ? 0.35 : revealed ? 0.1 : 0.18}
        maxTilt={revealed ? 6 : 8}
        // The slow drifting light: on the back, and during the reveal shimmer.
        autoSweep={!revealed || shimmering}
        label={label}
        // Our own wording, instead of Grain Light Card's "press to turn over".
        aria-label={label}
        style={STOCK}
      />
    </div>
  );
}

/* ---------- The engraved line art (SVG strokes catch the light) ---------- */

/** Points of a small four-pointed star, as an outline. */
function star4(cx: number, cy: number, r: number) {
  const k = r * 0.28;
  return `M${cx} ${cy - r}L${cx + k} ${cy - k}L${cx + r} ${cy}L${cx + k} ${cy + k}L${cx} ${cy + r}L${cx - k} ${cy + k}L${cx - r} ${cy}L${cx - k} ${cy - k}Z`;
}

/** The deck's back: its gold frame, plus a fine engraved halo around the central star. */
function CardBackLines() {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const rays = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    const r1 = 74;
    const r2 = i % 2 ? 80 : 86;
    return `M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}`;
  }).join("");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" aria-hidden="true">
      {/* the card's outer gold edge (was a CSS border) */}
      <rect x="0.75" y="0.75" width={WIDTH - 1.5} height={HEIGHT - 1.5} rx="13" stroke="var(--glc-line-strong)" strokeWidth="1.5" />
      {/* the inner frame (was .backBorder's CSS border), and a hairline inside it */}
      <rect x="10" y="10" width={WIDTH - 20} height={HEIGHT - 20} rx="12" stroke="var(--glc-line-strong)" strokeWidth="1" />
      <rect x="16" y="16" width={WIDTH - 32} height={HEIGHT - 32} rx="8" stroke="var(--glc-line)" strokeWidth="0.5" />
      {/* the halo: two rings and a crown of rays */}
      <circle cx={cx} cy={cy} r="62" stroke="var(--glc-line)" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r="70" stroke="var(--glc-line-strong)" strokeWidth="0.6" />
      <path d={rays} stroke="var(--glc-line)" strokeWidth="0.6" strokeLinecap="round" />
      {/* small stars at the top and bottom of the frame */}
      <path d={star4(cx, 46, 7)} stroke="var(--glc-line-strong)" strokeWidth="0.7" strokeLinejoin="round" />
      <path d={star4(cx, HEIGHT - 82, 6)} stroke="var(--glc-line)" strokeWidth="0.6" strokeLinejoin="round" />
    </svg>
  );
}

/** The card face: its gold edge and frame, with a small diamond at the top and bottom of the frame. */
function CardFaceLines() {
  const cx = WIDTH / 2;
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width={WIDTH - 1.5} height={HEIGHT - 1.5} rx="13" stroke="var(--glc-line-strong)" strokeWidth="1.5" />
      {/* the frame (was .frontBorder's CSS border), and a hairline inside it */}
      <rect x="8" y="8" width={WIDTH - 16} height={HEIGHT - 16} rx="12" stroke="var(--glc-line-strong)" strokeWidth="0.9" />
      <rect x="13" y="13" width={WIDTH - 26} height={HEIGHT - 26} rx="9" stroke="var(--glc-line)" strokeWidth="0.4" />
      {/* the diamonds are filled with the card's colour, so the frame line doesn't run through them */}
      <path d={`M${cx} 2L${cx + 6} 8L${cx} 14L${cx - 6} 8Z`} fill="var(--glc-back-1)" stroke="var(--glc-line-strong)" strokeWidth="0.8" />
      <path d={`M${cx} ${HEIGHT - 2}L${cx + 6} ${HEIGHT - 8}L${cx} ${HEIGHT - 14}L${cx - 6} ${HEIGHT - 8}Z`} fill="var(--glc-back-1)" stroke="var(--glc-line-strong)" strokeWidth="0.8" />
    </svg>
  );
}
