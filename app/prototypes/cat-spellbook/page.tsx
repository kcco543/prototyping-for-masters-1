"use client";

/**
 * Cat Spellbook — a magical doodling page.
 *
 * This file is the interface around the drawing: the tool card (brushes,
 * inks, size, undo/redo/clear/save), the sound switch and the tarot card
 * that "Cast a Spell" turns over. The drawing itself is a p5.js sketch
 * (sketch.ts), the sounds are made with Tone.js (sound.ts), and the small
 * illustrations (icons, card pictures, ornaments) live in art.tsx.
 *
 * React and the sketch talk through two small objects:
 *  - `settings` (brush, colour, size): React writes, the sketch reads.
 *  - `api` (undo, redo, clear, download, castSpell): React calls, the sketch does.
 */

import { IM_Fell_English, IM_Fell_English_SC } from "next/font/google";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import BackHome from "../../components/back-home/BackHome";
import { Bell, BrushIcon, CardBack, Crest, Flourish, InkFilters, SpellArtwork } from "./art";
import { BRUSHES, PALETTE, type BrushId } from "./brushes";
import type { Settings, SketchApi } from "./sketch";
import { setSoundEnabled } from "./sound";
import { pickSpell, type Spell } from "./spells";
import styles from "./styles.module.css";

// One old printing typeface for the whole page, like a real book:
// the regular and italic cuts for reading, and its small capitals for labels.
const fell = IM_Fell_English({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });
const fellCaps = IM_Fell_English_SC({ subsets: ["latin"], weight: "400", display: "swap" });

export default function CatSpellbook() {
  const [brush, setBrush] = useState<BrushId>("quill");
  const [color, setColor] = useState(PALETTE[0].value);
  const [size, setSize] = useState(10);
  const [sound, setSound] = useState(false); // muted by default
  const [history, setHistory] = useState({ canUndo: false, canRedo: false, isEmpty: true });
  const [spell, setSpell] = useState<Spell | null>(null);
  const [casting, setCasting] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const api = useRef<SketchApi | null>(null);
  const settings = useRef<Settings>({ brush, color, size });
  const lastSpell = useRef<Spell | null>(null);
  settings.current.brush = brush;
  settings.current.color = color;
  settings.current.size = size;

  /* ----- Start the p5 sketch once ----- */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    (async () => {
      const { mountSketch } = await import("./sketch");
      const sketch = await mountSketch(host, settings.current, {
        onHistory: (canUndo, canRedo, isEmpty) => setHistory({ canUndo, canRedo, isEmpty }),
        onSpellDone: () => {
          const next = pickSpell(lastSpell.current);
          lastSpell.current = next;
          setSpell(next);
          setCasting(false);
        },
      });
      if (cancelled) sketch.destroy();
      else api.current = sketch;
    })();
    return () => {
      cancelled = true;
      api.current?.destroy();
      api.current = null;
      void setSoundEnabled(false);
    };
  }, []);

  /* ----- Keyboard shortcuts: ⌘/Ctrl+Z undo, ⇧⌘Z or Ctrl+Y redo, Escape closes the card ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSpell(null);
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        api.current?.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        api.current?.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleSound = async () => {
    const next = !sound;
    setSound(next);
    await setSoundEnabled(next); // Tone.js is loaded and started here, inside the click
  };

  const castSpell = () => {
    if (casting) return;
    setSpell(null);
    setCasting(true);
    api.current?.castSpell();
  };

  // The brush being held: its row number places the gold star, and its hint becomes the caption
  const selected = BRUSHES.findIndex((b) => b.id === brush);
  const held = BRUSHES[selected];

  return (
    <div className={`${styles.container} ${fell.className}`} style={{ "--font-caps": fellCaps.style.fontFamily } as CSSProperties}>
      <InkFilters />

      <header className={styles.topBar}>
        <BackHome accent="#b8974f" surface="#f3ead7" ink="#1f2a4a" />
        <h1 className={styles.title}>
          <Flourish />
          Cat Spellbook
          <Flourish flip />
        </h1>
        <button type="button" className={styles.soundButton} onClick={toggleSound} aria-pressed={sound}>
          <Bell />
          {sound ? "Sound on" : "Sound off"}
        </button>
      </header>

      <div className={styles.layout}>
        {/* ---------- The tool card ---------- */}
        <aside className={styles.tools} aria-label="Drawing tools">
          <Crest />

          <div className={`${styles.section} ${styles.brushSection}`}>
            <p className={styles.label}>Brush</p>
            <div className={styles.brushes} role="radiogroup" aria-label="Brush" style={{ "--selected": selected } as CSSProperties}>
              {BRUSHES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={brush === b.id}
                  aria-label={b.name}
                  className={styles.brush}
                  data-brush={b.id}
                  onClick={() => setBrush(b.id)}
                  title={b.hint}
                >
                  <BrushIcon brush={b.id} />
                  <span className={styles.brushName}>{b.name}</span>
                </button>
              ))}
              <span className={styles.marker} aria-hidden="true" />
            </div>
          </div>

          <div className={styles.section}>
            <p className={styles.label}>Ink</p>
            <div className={styles.palette} role="radiogroup" aria-label="Ink colour">
              {PALETTE.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={color === c.value}
                  aria-label={c.name}
                  title={c.name}
                  className={styles.swatch}
                  style={{ "--swatch": c.value } as CSSProperties}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <label className={styles.label} htmlFor="brush-size">
              Size
            </label>
            <div className={styles.sizeRow}>
              <input id="brush-size" className={styles.slider} type="range" min={4} max={26} step={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              {/* a dab of the current ink that grows and shrinks with the slider */}
              <span className={styles.sizeDot} aria-hidden="true">
                <span className={styles.sizeInk} style={{ "--dot": `${Math.round(size * 0.8 + 2)}px`, "--swatch": color } as CSSProperties} />
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={() => api.current?.undo()} disabled={!history.canUndo}>
              Undo
            </button>
            <button type="button" className={styles.action} onClick={() => api.current?.redo()} disabled={!history.canRedo}>
              Redo
            </button>
            <button type="button" className={styles.action} onClick={() => api.current?.clear()} disabled={history.isEmpty}>
              Clear
            </button>
            <button type="button" className={styles.action} onClick={() => api.current?.download()} title="Save the page as a PNG picture">
              Save
            </button>
          </div>

          {/* Cast a Spell: a face-down deck. The top card lifts when you point at it. */}
          <button type="button" className={styles.spellButton} onClick={castSpell} disabled={casting}>
            <span className={styles.deck} aria-hidden="true">
              <span className={styles.deckCard} />
              <span className={styles.deckCard} />
              <span className={styles.deckCard}>
                <CardBack className={styles.deckArt} />
              </span>
            </span>
            <span className={styles.spellText}>
              <span className={styles.spellTitle}>Cast a Spell</span>
              <span className={styles.spellHint}>{casting ? "shuffling…" : "turn a card"}</span>
            </span>
          </button>
        </aside>

        {/* ---------- The page ---------- */}
        <div className={styles.pageColumn}>
          <div className={styles.pageWrap}>
            <div
              ref={hostRef}
              className={styles.page}
              role="img"
              aria-label="An enchanted storybook page you can draw on. Three small cats sit on its border and react to what you draw."
            />

            {spell && (
              <div className={styles.cardLayer} onClick={() => setSpell(null)}>
                <div className={styles.card} role="dialog" aria-label="Your spell" onClick={(e) => e.stopPropagation()}>
                  {/* the card arrives face down (cardBack), then turns over to show cardFront */}
                  <div className={styles.cardFlip}>
                    <div className={styles.cardBack} aria-hidden="true">
                      <CardBack className={styles.cardBackArt} />
                    </div>
                    <div className={styles.cardFront}>
                      <p className={styles.numeral}>{spell.numeral}</p>
                      <SpellArtwork art={spell.art} className={styles.cardArt} />
                      <p className={styles.cardName}>{spell.card}</p>
                      <p className={styles.message}>{spell.message}</p>
                      <button type="button" className={styles.cardClose} onClick={() => setSpell(null)} autoFocus>
                        Keep drawing
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* A storybook caption. Changing `key` restarts its fade-in each time the words change. */}
          <p key={casting ? "casting" : brush} className={styles.caption}>
            {casting ? (
              "The cats are consulting the stars…"
            ) : (
              <>
                <span className={styles.captionName}>{held.name}</span> — {held.hint.charAt(0).toLowerCase() + held.hint.slice(1)}.
              </>
            )}
          </p>
        </div>
      </div>

      {/* announce the spell to screen readers */}
      <p className={styles.srOnly} aria-live="polite">
        {spell ? `${spell.card}. ${spell.message}` : ""}
      </p>
    </div>
  );
}
