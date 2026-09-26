"use client";

/**
 * The Magician — summon a cat through typography.
 *
 * 1. Choose: scroll the mouse wheel (or swipe, use the arrow keys, or tap a
 *    font in the list) to cycle the word "cat" through 12 typefaces.
 * 2. Reveal: the letters float up in a puff of sparkles…
 * 3. …and a cat whose looks match that font's personality appears.
 *
 * The page moves between three "phases": choose → casting → revealed.
 */

import BackHome from "../../components/back-home/BackHome";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./styles.module.css";
import { caveat, instrumentSans } from "../../fonts";
import { SPELLS } from "./spells";
import * as sound from "./sound";

type Phase = "choose" | "casting" | "revealed";

const CASTING_MS = 1500; // length of the "puff of magic" before the cat appears
const WHEEL_STEP = 60; // how much wheel movement counts as one step
const WHEEL_COOLDOWN_MS = 160; // pause between steps so trackpads don't race through

/** Decorative twinkling stars: [left %, top %, size px, colour, delay s] */
const STARS: [number, number, number, string, number][] = [
  [8, 14, 18, "#f0893d", 0], [88, 10, 14, "#e97fc7", 0.8], [14, 78, 14, "#f2c230", 1.4],
  [92, 70, 20, "#f0893d", 0.4], [74, 22, 10, "#f2c230", 2], [24, 34, 10, "#e97fc7", 1.1],
  [80, 88, 12, "#e97fc7", 1.7], [6, 50, 12, "#f2c230", 2.4],
];

/** Sparkle burst directions for the casting animation (degrees). */
const BURST = Array.from({ length: 14 }, (_, i) => i * (360 / 14));

export default function TheMagician() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [phase, setPhase] = useState<Phase>("choose");
  const [muted, setMuted] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const wheel = useRef({ total: 0, lastStep: 0 });
  const castTimer = useRef<number | undefined>(undefined);

  const spell = SPELLS[index];
  const count = SPELLS.length;

  /** Move to the next (+1) or previous (-1) typeface, wrapping around. */
  const step = useCallback(
    (d: 1 | -1) => {
      setDir(d);
      setIndex((i) => (i + d + count) % count);
      sound.tick();
    },
    [count],
  );

  const choose = (i: number) => {
    sound.unlock();
    setDir(i >= index ? 1 : -1);
    setIndex(i);
    sound.tick();
  };

  const reveal = useCallback(() => {
    if (phase !== "choose") return;
    sound.unlock();
    setPhase("casting");
    sound.spell();
    castTimer.current = window.setTimeout(() => setPhase("revealed"), CASTING_MS);
  }, [phase]);

  const again = () => setPhase("choose");

  useEffect(() => () => window.clearTimeout(castTimer.current), []);

  /*
   * Mouse wheel. React's onWheel can't stop the page from scrolling
   * (it is "passive"), so we attach a native listener with { passive: false }
   * and call preventDefault ourselves.
   */
  useEffect(() => {
    const el = stageRef.current;
    if (!el || phase !== "choose") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const w = wheel.current;
      w.total += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      const now = performance.now();
      if (Math.abs(w.total) >= WHEEL_STEP && now - w.lastStep > WHEEL_COOLDOWN_MS) {
        step(w.total > 0 ? 1 : -1);
        w.total = 0;
        w.lastStep = now;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [phase, step]);

  // Keyboard: ↑/↓ (or ←/→) to change font, Enter to reveal, Escape to go back
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (phase === "choose") {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); sound.unlock(); step(1); }
        if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); sound.unlock(); step(-1); }
        if (e.key === "Enter" && tag !== "BUTTON" && tag !== "A") reveal();
      } else if (phase === "revealed" && e.key === "Escape") {
        again();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, reveal, step]);

  // Touch: swipe up/down (or left/right) on the stage to change font
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || phase !== "choose") return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
    if (Math.abs(d) > 40) {
      sound.unlock();
      step(d < 0 ? 1 : -1);
    }
  };

  // Keep the active font visible in the side list (without scrolling the page)
  useEffect(() => {
    const rail = railRef.current;
    const item = rail?.children[index] as HTMLElement | undefined;
    if (!rail || !item) return;
    const vertical = rail.scrollHeight > rail.clientHeight + 4;
    rail.scrollTo({
      top: vertical ? item.offsetTop - rail.clientHeight / 2 + item.clientHeight / 2 : 0,
      left: vertical ? 0 : item.offsetLeft - rail.clientWidth / 2 + item.clientWidth / 2,
      behavior: "smooth",
    });
  }, [index]);

  const wordStyle = {
    fontFamily: spell.fontFamily,
    "--word-scale": spell.scale,
  } as CSSProperties;

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      <header className={styles.topBar}>
        {/* Shared back button, in the pink sparkle from the stage */}
        <BackHome accent="#e97fc7" />
        <h1 className={styles.title}>The Magician</h1>
        <button
          type="button"
          className={styles.pillButton}
          onClick={() => {
            sound.setMuted(!muted);
            setMuted(!muted);
          }}
          aria-pressed={muted}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
      </header>

      <div className={styles.layout}>
        {/* ---------- The stage ---------- */}
        <div
          ref={stageRef}
          className={`${styles.stage} ${phase !== "choose" ? styles.stageBusy : ""}`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          <div className={styles.curtain} aria-hidden="true" />
          {STARS.map(([l, t, s, c, d], i) => (
            <span
              key={i}
              className={styles.star}
              style={{ left: `${l}%`, top: `${t}%`, width: s, height: s, background: c, animationDelay: `${d}s` }}
              aria-hidden="true"
            />
          ))}

          {phase !== "revealed" && (
            <div className={styles.chooser}>
              <p className={styles.counter} aria-live="polite">
                Spell {index + 1} of {count}
              </p>

              {/* key={index} re-mounts the word so its entrance animation replays */}
              <div className={styles.wordWrap}>
                <p
                  key={index}
                  className={`${styles.word} ${dir > 0 ? styles.enterFromBelow : styles.enterFromAbove} ${phase === "casting" ? styles.casting : ""}`}
                  style={wordStyle}
                  aria-label={`cat, set in ${spell.font}`}
                >
                  {"cat".split("").map((ch, i) => (
                    <span key={i} className={styles.letter} style={{ animationDelay: phase === "casting" ? `${i * 0.12}s` : undefined }}>
                      {ch}
                    </span>
                  ))}
                </p>

                {phase === "casting" && (
                  <div className={styles.burst} aria-hidden="true">
                    {BURST.map((deg, i) => (
                      <span key={deg} className={styles.spark} style={{ "--angle": `${deg}deg`, animationDelay: `${0.35 + (i % 3) * 0.08}s` } as CSSProperties} />
                    ))}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={`p${i}`} className={styles.puff} style={{ "--i": i } as CSSProperties} />
                    ))}
                  </div>
                )}
              </div>

              <p className={styles.fontName}>{spell.font}</p>
              <ul className={styles.traits}>
                {spell.traits.map((t) => (
                  <li key={t} className={styles.trait}>
                    {t}
                  </li>
                ))}
              </ul>

              <div className={styles.controls}>
                <button type="button" className={styles.arrow} onClick={() => { sound.unlock(); step(-1); }} aria-label="Previous typeface" disabled={phase !== "choose"}>
                  ↑
                </button>
                <button type="button" className={styles.revealButton} onClick={reveal} disabled={phase !== "choose"}>
                  <span className={styles.wand} aria-hidden="true" /> Reveal
                </button>
                <button type="button" className={styles.arrow} onClick={() => { sound.unlock(); step(1); }} aria-label="Next typeface" disabled={phase !== "choose"}>
                  ↓
                </button>
              </div>
              <p className={styles.hint}>
                <span className={styles.hintMouse}>Scroll</span>
                <span className={styles.hintTouch}>Swipe</span> to shuffle the spell, then reveal your cat
              </p>
            </div>
          )}

          {phase === "revealed" && (
            <div className={styles.reveal}>
              <div className={styles.portal} style={{ background: spell.cat.portal }}>
                <Image src={spell.cat.image} alt={spell.cat.alt} className={styles.catImage} sizes="(max-width: 700px) 70vw, 360px" priority />
              </div>
              <p className={styles.summoned}>You summoned</p>
              <h2 className={styles.catName} style={wordStyle}>
                {spell.cat.name}
              </h2>
              <p className={styles.fromFont}>conjured from {spell.font}</p>

              <ul className={styles.transforms}>
                {spell.transforms.map(([from, to]) => (
                  <li key={from} className={styles.transform}>
                    <span className={styles.from}>{from}</span>
                    <span className={styles.becomes} aria-label="became">
                      ✦
                    </span>
                    <span className={styles.to}>{to}</span>
                  </li>
                ))}
              </ul>

              <button type="button" className={styles.revealButton} onClick={again} autoFocus>
                Summon another
              </button>
            </div>
          )}
        </div>

        {/* ---------- All spells, each written in its own font ---------- */}
        <nav className={styles.railWrap} aria-label="Typefaces">
          <div ref={railRef} className={styles.rail}>
            {SPELLS.map((s, i) => (
              <button
                key={s.font}
                type="button"
                className={`${styles.railItem} ${i === index ? styles.railActive : ""}`}
                onClick={() => {
                  if (phase === "revealed") setPhase("choose");
                  if (phase !== "casting") choose(i);
                }}
                aria-current={i === index}
                aria-label={s.font}
                title={s.font}
              >
                <span className={styles.railWord} style={{ fontFamily: s.fontFamily }}>
                  cat
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
