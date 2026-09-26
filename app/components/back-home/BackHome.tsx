/**
 * The "back to Jiaqi Yuan's prototypes" button, shared by every subpage.
 *
 * It borrows the homepage's design language:
 * - a cream card with two little cat ears peeking over the top (just like
 *   the prototype cards on the homepage),
 * - a small cat-head icon,
 * - the hand-lettered Caveat font used for the homepage title.
 *
 * Each page dresses it in its own colours:
 * - `accent`  : ears + cat icon (pick a colour from the page's palette)
 * - `surface` : the button's background (default: the homepage's cream)
 * - `ink`     : text and outline colour
 * - `variant` : "soft" (rounded, soft shadow, the homepage style) or
 *               "retro" (outlined with a hard shadow, for boxy retro pages)
 * - `placement`: "inline" (sits in the page's own header) or
 *               "floating" (pinned to the top-left corner of the screen)
 *
 * On narrower screens (under 900px) the label shortens to "Home"; on phones
 * (under 560px) it becomes a compact "← cat" button.
 */

import Link from "next/link";
import type { CSSProperties } from "react";
import { caveat } from "../../fonts";
import styles from "./BackHome.module.css";

type Props = {
  accent?: string;
  surface?: string;
  ink?: string;
  variant?: "soft" | "retro";
  placement?: "inline" | "floating";
};

export default function BackHome({
  accent = "#f0893d",
  surface = "#fffaf2",
  ink = "#2b2725",
  variant = "soft",
  placement = "inline",
}: Props) {
  const colours = { "--bh-accent": accent, "--bh-surface": surface, "--bh-ink": ink } as CSSProperties;

  return (
    <Link
      href="/"
      className={`${styles.backHome} ${styles[variant]} ${placement === "floating" ? styles.floating : ""}`}
      style={colours}
      aria-label="Back to Jiaqi Yuan's prototypes"
    >
      <span className={styles.arrow} aria-hidden="true">
        ←
      </span>
      {/* a tiny cat head: the same round-face-and-pointy-ears shape as the homepage cats */}
      <svg className={styles.catIcon} viewBox="0 0 24 22" aria-hidden="true">
        <path d="M3 21 C1 15 2 9 3.5 3 L8 7.5 C10.6 6.8 13.4 6.8 16 7.5 L20.5 3 C22 9 23 15 21 21Z" />
        <circle className={styles.catEye} cx="8.8" cy="14" r="1.35" />
        <circle className={styles.catEye} cx="15.2" cy="14" r="1.35" />
      </svg>
      <span className={`${styles.label} ${caveat.className}`}>
        <span className={styles.labelFull}>Jiaqi Yuan&apos;s prototypes</span>
        <span className={styles.labelShort}>Home</span>
      </span>
    </Link>
  );
}
