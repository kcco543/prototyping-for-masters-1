"use client";

/**
 * A Constellation of Stories — the star map (the "Constellation" view).
 *
 * HOW IT'S BUILT
 * The map is one big "world" element, moved and zoomed by the camera
 * (camera.ts) with a single CSS transform. Inside it:
 *
 *   1. An <svg> with the drawing: faint coordinate circles, the ecliptic,
 *      each constellation's dotted region and name, and the lines.
 *   2. One <button> per book: its cover, glow, letter and title. Real
 *      buttons, so they work with the keyboard (Tab) and screen readers.
 *   3. The tooltip of the book under the mouse.
 *
 * Around the map (not zoomed): the index of constellations with the search
 * (AtlasIndex.tsx), the zoom buttons, and on phones a strip of covers along
 * the bottom, so every book can be reached with a simple tap.
 *
 * DRAGGING VS CLICKING
 * A press only becomes a drag once the pointer has moved more than 6 pixels.
 * A click on a book (which barely moves) opens it; a drag that happens to
 * start on a book moves the map and does not open it.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { AtlasIndex } from "./AtlasIndex";
import { Camera, type Insets, type View } from "./camera";
import { Cover, prefersLessMotion, RatingStars, ratingWords, useReducedMotion } from "./parts";
import { chart, COVER, hash, LABEL_LINES, type Box, type Catalogue, type Chart, type ConstellationInfo, type Figure, type Orientation, type Placed, type Point } from "./sky";
import styles from "./sky.module.css";

/** Where the camera was, so coming back from the bookshelf returns to the same spot. */
export type SkyMemory = { view: View; orientation: Orientation };

type Props = {
  catalogue: Catalogue;
  /** The chosen constellation (a genre), or null for all of them. Shared with the bookshelf view. */
  genre: string | null;
  onGenre: (key: string | null) => void;
  /** The book whose page is open, if any */
  openId: string | null;
  /** Asks the library to open a book's page. `origin` is the cover it should grow out of. */
  onOpenBook: (id: string, origin: HTMLElement | null, list: string[]) => void;
  /** A book to find and highlight (sent from the bookshelf's "Find in the constellation") */
  locateId: string | null;
  onLocated: () => void;
  /** Shared with the starfield, so the sky behind moves a little when the map moves */
  parallax: RefObject<{ x: number; y: number }>;
  memory: RefObject<SkyMemory | null>;
};

/** How a star, line or region looks right now: under the mouse, highlighted, or dimmed (a little or a lot). */
type Tone = "hot" | "lit" | "soft" | "dim" | undefined;
/** Where the tooltip sits: beside the book, or (on narrow screens) below it, nudged sideways by `shift` pixels to stay on screen. */
type Tip = { id: string; side: "left" | "right" | "below"; shift: number };

const pad = (box: Box, by: number): Box => ({ minX: box.minX - by, minY: box.minY - by, maxX: box.maxX + by, maxY: box.maxY + by });

export function SkyMap({ catalogue, genre, onGenre, openId, onOpenBook, locateId, onLocated, parallax, memory }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // The layout depends on the screen's shape, so it waits until the screen has been measured
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const sky = useMemo(() => (orientation ? chart(catalogue, orientation) : null), [catalogue, orientation]);
  const skyRef = useRef<Chart | null>(null);
  const orientationRef = useRef<Orientation | null>(null);
  useLayoutEffect(() => {
    skyRef.current = sky;
    orientationRef.current = orientation;
  }, [sky, orientation]);

  const [tip, setTip] = useState<Tip | null>(null);
  const [found, setFound] = useState<string | null>(null);
  const [indexOpen, setIndexOpen] = useState(false); // phones only: the index is a sheet

  /* ---------- The camera ---------- */

  const cameraRef = useRef<Camera | null>(null);
  if (cameraRef.current === null) {
    cameraRef.current = new Camera((camera) => {
      const element = world.current;
      if (element) {
        element.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`;
        // The labels and tooltip read --k to stay readable at any zoom
        element.style.setProperty("--k", camera.k.toFixed(4));
      }
      if (parallax.current) {
        parallax.current.x = camera.x;
        parallax.current.y = camera.y;
      }
    });
  }
  const camera = cameraRef.current;

  /**
   * How much of the screen the page's own panels cover (the title, the index,
   * the strip on phones). Elements say which side they're on with
   * data-chrome="top", "wide:right" (only on wide screens) or "narrow:bottom".
   */
  const measureInsets = (): Insets => {
    const narrow = window.matchMedia("(max-width: 760px)").matches;
    const insets = { top: 24, right: 24, bottom: 24, left: 24 };
    const root = viewport.current?.closest("[data-library]") ?? document.body;
    root.querySelectorAll<HTMLElement>("[data-chrome]").forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return; // hidden on this screen size
      for (const rule of (element.dataset.chrome ?? "").split(" ")) {
        const [when, side] = rule.includes(":") ? rule.split(":") : ["any", rule];
        if ((when === "wide" && narrow) || (when === "narrow" && !narrow)) continue;
        if (side === "top") insets.top = Math.max(insets.top, rect.bottom + 18);
        if (side === "bottom") insets.bottom = Math.max(insets.bottom, camera.height - rect.top + 14);
        if (side === "right") insets.right = Math.max(insets.right, camera.width - rect.left + 24);
        if (side === "left") insets.left = Math.max(insets.left, rect.right + 24);
      }
    });
    return insets;
  };

  /** The middle of the free part of the screen */
  const middle = (): Point => {
    const insets = measureInsets();
    return {
      x: insets.left + (camera.width - insets.left - insets.right) / 2,
      y: insets.top + (camera.height - insets.top - insets.bottom) / 2,
    };
  };

  const frameAll = (duration?: number) => {
    const current = skyRef.current;
    if (!current) return;
    const { focus, anchor } = camera.framing(current.box, measureInsets(), 1.1);
    void camera.flyTo(focus, { anchor, duration: prefersLessMotion() ? 0 : duration });
  };

  const frameGenre = (key: string, duration?: number) => {
    const figure = skyRef.current?.figures.find((item) => item.info.key === key);
    if (!figure) return frameAll(duration);
    const { focus, anchor } = camera.framing(pad(figure.box, 30), measureInsets(), 1.5);
    void camera.flyTo(focus, { anchor, duration: prefersLessMotion() ? 0 : duration });
  };

  const buttonFor = (id: string) => viewport.current?.querySelector<HTMLElement>(`[data-book-button="${CSS.escape(id)}"]`) ?? null;

  /** Shows a book's tooltip, on whichever side has room. */
  const showTip = (id: string) => {
    const star = skyRef.current?.stars.get(id);
    if (!star) return;
    const onScreen = camera.toScreen(star);
    const CARD = 250; // the card's width, see .tipCard
    if (camera.width < 600) {
      // Narrow screen: below the book, kept 12px inside the screen's edges
      const left = Math.min(Math.max(onScreen.x - CARD / 2, 12), camera.width - CARD - 12);
      setTip({ id, side: "below", shift: Math.round(left - onScreen.x) });
      return;
    }
    setTip({ id, side: onScreen.x > camera.width - CARD - 90 ? "left" : "right", shift: 0 });
  };

  /* ---------- Measuring the screen, placing the camera ---------- */

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    camera.resize(element.clientWidth, element.clientHeight);
    setOrientation(element.clientWidth < element.clientHeight ? "portrait" : "landscape");

    const watcher = new ResizeObserver(() => {
      const { clientWidth: width, clientHeight: height } = element;
      if (!width || !height) return;
      camera.resize(width, height);
      const next: Orientation = width < height ? "portrait" : "landscape";
      setOrientation((current) => (current === next ? current : next));
    });
    watcher.observe(element);
    return () => {
      watcher.disconnect();
      // Remember the spot for when you come back from the bookshelf
      if (orientationRef.current) memory.current = { view: camera.view, orientation: orientationRef.current };
      camera.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each time the layout is (re)made: set the zoom limits and frame the sky
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (!sky || !orientation) return;
    camera.content = pad(sky.box, 60);
    camera.minZoom = 0.05;
    camera.maxZoom = 10;
    const whole = camera.framing(sky.box, measureInsets()).focus.k;
    camera.minZoom = Math.min(0.85, whole) * 0.6;
    camera.maxZoom = Math.max(2.6, whole * 3);

    const remembered = memory.current;
    if (!placed.current && remembered && remembered.orientation === orientation) {
      camera.set(remembered.view.x, remembered.view.y, remembered.view.k);
    } else if (genre !== null) {
      frameGenre(genre, 0);
    } else {
      frameAll(0);
    }
    placed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sky]);

  /* ---------- Reacting to the rest of the page ---------- */

  // A constellation was chosen (here, or on the bookshelf): glide to it
  const genreShown = useRef(genre);
  useEffect(() => {
    if (genreShown.current === genre) return;
    genreShown.current = genre;
    setTip(null);
    if (genre === null) frameAll();
    else frameGenre(genre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre]);

  // Stepping to the next book on the open page: glide to it behind the page
  const openShown = useRef(openId);
  useEffect(() => {
    const previous = openShown.current;
    openShown.current = openId;
    if (!openId || !previous || openId === previous) return;
    const star = skyRef.current?.stars.get(openId);
    if (star) void camera.flyTo({ x: star.x, y: star.y, k: camera.k }, { duration: prefersLessMotion() ? 0 : 700 });
  }, [openId, camera]);

  // "Find in the constellation", sent from the bookshelf
  useEffect(() => {
    if (!locateId || !sky) return;
    const star = sky.stars.get(locateId);
    onLocated();
    if (star) locate(star);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateId, sky]);

  /* ---------- Actions ---------- */

  /** Glides to a book, rings it, shows its tooltip and gives it keyboard focus. */
  const locate = (star: Placed) => {
    setIndexOpen(false);
    setFound(star.book.id);
    setTip(null);
    // On a narrow screen the tooltip goes below the book: leave room for it
    const anchor = middle();
    if (camera.width < 600) anchor.y -= 100;
    void camera
      .flyTo({ x: star.x, y: star.y, k: Math.max(camera.k, 1.3) }, { anchor, duration: prefersLessMotion() ? 0 : undefined })
      .then((arrived) => {
        if (!arrived) return;
        showTip(star.book.id);
        buttonFor(star.book.id)?.focus({ preventScroll: true });
      });
  };

  /** "Click a book to enter its world": glide it to the middle of the screen, a little closer, then open its page. */
  const open = async (star: Placed) => {
    setTip(null);
    setIndexOpen(false);
    const closer = Math.min(camera.maxZoom, Math.max(camera.k * 1.15, 1.45));
    const arrived = await camera.flyTo({ x: star.x, y: star.y, k: closer }, { duration: prefersLessMotion() ? 0 : undefined });
    if (!arrived) return;
    const figure = skyRef.current?.figures.find((item) => item.info.key === star.key);
    const cover = buttonFor(star.book.id)?.querySelector<HTMLElement>("[data-cover]") ?? null;
    onOpenBook(star.book.id, cover, figure ? figure.stars.map((item) => item.book.id) : [star.book.id]);
  };

  const chooseGenre = (key: string | null) => {
    setIndexOpen(false);
    setFound(null);
    if (key === genre) {
      // Already chosen: glide back to it (handy after wandering off)
      if (key === null) frameAll();
      else frameGenre(key);
      return;
    }
    onGenre(key);
  };

  const resetView = () => {
    setFound(null);
    setTip(null);
    if (genre !== null) onGenre(null); // the effect above glides to the whole sky
    else frameAll();
  };

  const zoomBy = (factor: number) => {
    const point = middle();
    camera.zoomSmoothly(point.x, point.y, factor, prefersLessMotion());
  };

  /* ---------- Dragging, pinching, the wheel, the keyboard ---------- */

  type Drag = { id: number; startX: number; startY: number; lastX: number; lastY: number; time: number; vx: number; vy: number; moved: boolean };
  const drag = useRef<Drag | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; middle: Point } | null>(null);
  /** True for a moment after a drag, so the click that follows it doesn't open a book */
  const justDragged = useRef(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    camera.stop();
    if (pointers.current.size === 2) {
      // A second finger: start pinching
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      drag.current = null;
      return;
    }
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      time: event.timeStamp,
      vx: 0,
      vy: 0,
      moved: false,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const point = pointers.current.get(event.pointerId);
    if (!point) return;
    point.x = event.clientX;
    point.y = event.clientY;

    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      camera.zoomAround(centre.x, centre.y, camera.k * (distance / pinch.current.distance));
      camera.set(camera.x + centre.x - pinch.current.middle.x, camera.y + centre.y - pinch.current.middle.y, camera.k);
      pinch.current = { distance, middle: centre };
      justDragged.current = true;
      return;
    }

    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (!current.moved) {
      if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 6) return;
      current.moved = true;
      // From now on this pointer belongs to the map, even if it passes over a book or a panel
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.grabbing = "";
      setTip(null);
    }
    const dx = event.clientX - current.lastX;
    const dy = event.clientY - current.lastY;
    const dt = Math.max(1, event.timeStamp - current.time);
    current.vx = current.vx * 0.3 + (dx / dt) * 0.7;
    current.vy = current.vy * 0.3 + (dy / dt) * 0.7;
    current.lastX = event.clientX;
    current.lastY = event.clientY;
    current.time = event.timeStamp;
    camera.set(camera.x + dx, camera.y + dy, camera.k);
  };

  const endPointer = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const current = drag.current;
    if (!current || current.id !== event.pointerId) {
      if (pointers.current.size === 0) window.setTimeout(() => (justDragged.current = false), 0);
      return;
    }
    drag.current = null;
    delete event.currentTarget.dataset.grabbing;
    if (current.moved) {
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      // Let go while still moving: coast to a gentle stop
      if (!cancelled && !prefersLessMotion() && event.timeStamp - current.time < 80) camera.coast(current.vx, current.vy);
    } else if (!(event.target as Element).closest("[data-book-button], [data-label]")) {
      // A plain click on empty sky puts down whatever was found
      setFound(null);
    }
  };

  // The wheel zooms around the mouse. (Added by hand because React's onWheel can't stop the page from scrolling.)
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      const delta = Math.max(-150, Math.min(150, event.deltaY * unit));
      // Pinching a trackpad sends small wheel steps with ctrlKey held: make those count more
      const factor = Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.0018));
      const rect = element.getBoundingClientRect();
      camera.zoomSmoothly(event.clientX - rect.left, event.clientY - rect.top, factor, prefersLessMotion());
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [camera]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const STEP = 90;
    switch (event.key) {
      case "ArrowLeft":
        camera.panBy(STEP, 0);
        break;
      case "ArrowRight":
        camera.panBy(-STEP, 0);
        break;
      case "ArrowUp":
        camera.panBy(0, STEP);
        break;
      case "ArrowDown":
        camera.panBy(0, -STEP);
        break;
      case "+":
      case "=":
        zoomBy(1.3);
        break;
      case "-":
      case "_":
        zoomBy(1 / 1.3);
        break;
      case "0":
        resetView();
        break;
      case "Escape":
        setFound(null);
        setTip(null);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /** A book got keyboard focus: show its tooltip, and bring it on screen if it's off the edge. */
  const onStarFocus = (star: Placed, button: HTMLElement) => {
    if (!button.matches(":focus-visible")) return; // focus from a mouse click: the hover already handles it
    showTip(star.book.id);
    const insets = measureInsets();
    const spot = camera.toScreen(star);
    const margin = 70;
    const outside =
      spot.x < insets.left + margin || spot.x > camera.width - insets.right - margin || spot.y < insets.top + margin || spot.y > camera.height - insets.bottom - margin;
    if (outside) {
      void camera.flyTo({ x: star.x, y: star.y, k: Math.max(camera.k, 0.9) }, { anchor: middle(), duration: prefersLessMotion() ? 0 : 600 }).then((arrived) => {
        if (arrived) showTip(star.book.id);
      });
    }
  };

  /* ---------- What's highlighted ---------- */

  const tipStar = tip && sky ? (sky.stars.get(tip.id) ?? null) : null;
  const hoverKey = tipStar?.key ?? null;

  /** A chosen genre dims the others a lot; hovering a book dims the other constellations a little. */
  const toneOf = (key: string): Tone => {
    if (genre !== null) return key === genre || key === hoverKey ? "lit" : "dim";
    if (hoverKey !== null) return key === hoverKey ? "lit" : "soft";
    return undefined;
  };

  const focusInfo = genre !== null ? (catalogue.byKey.get(genre) ?? null) : null;
  const stripStars: Placed[] = sky
    ? genre !== null
      ? (sky.figures.find((figure) => figure.info.key === genre)?.stars ?? [])
      : sky.figures.flatMap((figure) => figure.stars)
    : [];

  return (
    <>
      <div
        ref={viewport}
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-roledescription="star map"
        aria-label="Star map of the bookstore. Every book is a star and every genre a constellation. Use the arrow keys to move around, plus and minus to zoom, and 0 to see everything."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => endPointer(event, false)}
        onPointerCancel={(event) => endPointer(event, true)}
        onKeyDown={onKeyDown}
      >
        <div ref={world} className={styles.world}>
          {sky && (
            <>
              <SkyDrawing
                sky={sky}
                toneOf={toneOf}
                tipId={tip?.id ?? null}
                moving={!reduced}
                onLabel={(key) => {
                  if (!justDragged.current) chooseGenre(key);
                }}
              />
              <div className={styles.starLayer}>
                {sky.figures.map((figure) =>
                  figure.stars.map((star) => (
                    <StarButton
                      key={star.book.id}
                      star={star}
                      info={figure.info}
                      tone={star.book.id === tip?.id ? "hot" : toneOf(star.key)}
                      isOpen={openId === star.book.id}
                      isFound={found === star.book.id}
                      onEnter={(pointerType) => {
                        if (pointerType !== "touch" && !drag.current?.moved) showTip(star.book.id);
                      }}
                      onLeave={() => setTip((current) => (current?.id === star.book.id ? null : current))}
                      onFocus={(button) => onStarFocus(star, button)}
                      onClick={() => {
                        if (!justDragged.current) void open(star);
                      }}
                    />
                  )),
                )}
              </div>
              {tipStar && tip && <StarTip star={tipStar} info={catalogue.byKey.get(tipStar.key)!} side={tip.side} shift={tip.shift} />}
            </>
          )}
        </div>
      </div>

      <AtlasIndex
        catalogue={catalogue}
        genre={genre}
        onGenre={chooseGenre}
        onFind={(id) => {
          const star = skyRef.current?.stars.get(id);
          if (star) locate(star);
        }}
        isOpen={indexOpen}
        onClose={() => setIndexOpen(false)}
      />

      {focusInfo && (
        <div className={styles.focusChip} data-chrome="wide:bottom" style={{ "--accent": focusInfo.accent } as CSSProperties}>
          <span className={styles.focusStar} aria-hidden="true">
            ✦
          </span>
          <span className={styles.focusText}>
            <span className={styles.focusNumeral}>Constellation {focusInfo.numeral}</span> <strong className={styles.focusGenre}>{focusInfo.genre}</strong>{" "}
            <span className={styles.focusCount}>
              {focusInfo.entries.length} {focusInfo.entries.length === 1 ? "book" : "books"}
            </span>
          </span>
          <button type="button" className={styles.focusClear} onClick={() => chooseGenre(null)}>
            All constellations
          </button>
        </div>
      )}
      {/* Read out by screen readers when a constellation is chosen */}
      <p className={styles.srOnly} role="status">
        {focusInfo ? `${focusInfo.genre}: ${focusInfo.entries.length} ${focusInfo.entries.length === 1 ? "book" : "books"}` : ""}
      </p>

      <div className={styles.controls} data-chrome="narrow:bottom">
        <button
          type="button"
          className={styles.indexToggle}
          aria-expanded={indexOpen}
          aria-controls="atlas-index"
          onClick={() => setIndexOpen((value) => !value)}
        >
          <span aria-hidden="true">☰</span> Index &amp; search
        </button>
        <div className={styles.zoom} role="group" aria-label="Zoom">
          <button type="button" className={styles.zoomButton} onClick={() => zoomBy(1.35)} aria-label="Zoom in">
            <svg viewBox="0 0 16 16" className={styles.zoomIcon} aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
          <button type="button" className={styles.zoomButton} onClick={() => zoomBy(1 / 1.35)} aria-label="Zoom out">
            <svg viewBox="0 0 16 16" className={styles.zoomIcon} aria-hidden="true">
              <path d="M3 8h10" />
            </svg>
          </button>
          <button type="button" className={styles.zoomReset} onClick={resetView}>
            <svg viewBox="0 0 16 16" className={styles.zoomIcon} aria-hidden="true">
              <circle cx="8" cy="8" r="5" />
              <path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3" />
            </svg>
            Reset view
          </button>
        </div>
      </div>

      {/* Phones: every book in view as a row of covers, one tap away */}
      <nav className={styles.strip} data-chrome="narrow:bottom" aria-label={focusInfo ? `Books in ${focusInfo.genre}` : "All books"}>
        <ol className={styles.stripList}>
          {stripStars.map((star) => (
            <li key={star.book.id} className={styles.stripItem}>
              <button
                type="button"
                className={styles.stripButton}
                style={{ "--accent": catalogue.byKey.get(star.key)?.accent } as CSSProperties}
                onClick={() => void open(star)}
              >
                <span className={styles.stripCover}>
                  <Cover book={star.book} />
                </span>
                <span className={styles.stripTitle}>
                  <span className={styles.stripLetter}>{star.letter}</span> {star.book.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}

/* ---------- The drawing: coordinates, regions, names, lines ---------- */

function SkyDrawing({
  sky,
  toneOf,
  tipId,
  moving,
  onLabel,
}: {
  sky: Chart;
  toneOf: (key: string) => Tone;
  tipId: string | null;
  moving: boolean;
  onLabel: (key: string) => void;
}) {
  // The SVG covers the coordinate circles, which surround everything else
  const reach = sky.radius + 90;
  const graticule = useMemo(() => <Graticule radius={sky.radius} />, [sky.radius]);
  const accents = new Map(sky.figures.map((figure) => [figure.info.key, figure.info.accent]));

  const lineTone = (from: Placed, to: Placed, key: string | null): Tone => {
    if (tipId && (from.book.id === tipId || to.book.id === tipId)) return "hot";
    if (key !== null) return toneOf(key);
    // An author's arc between constellations: lit if either end is
    const a = toneOf(from.key);
    const b = toneOf(to.key);
    return a === "lit" || b === "lit" ? "lit" : a;
  };

  return (
    <svg
      className={styles.drawing}
      viewBox={`${-reach} ${-reach} ${reach * 2} ${reach * 2}`}
      width={reach * 2}
      height={reach * 2}
      style={{ left: -reach, top: -reach }}
      aria-hidden="true"
    >
      {graticule}

      {sky.figures.map((figure) => (
        <Region key={figure.info.key || "uncharted"} figure={figure} tone={toneOf(figure.info.key)} onLabel={onLabel} />
      ))}

      <g>
        {sky.links.map((link) => (
          <path
            key={link.id}
            d={link.path}
            className={link.kind === "figure" ? styles.line : styles.authorLine}
            data-tone={lineTone(link.from, link.to, link.kind === "figure" ? link.key : null)}
            style={link.kind === "figure" ? ({ "--accent": accents.get(link.key) } as CSSProperties) : undefined}
          />
        ))}
      </g>

      {/* Now and then, a faint spark of light travels along a constellation line */}
      {moving && (
        <g>
          {sky.links
            .filter((link) => link.kind === "figure")
            .map((link) => {
              const seed = hash(link.id);
              const cycle = 18 + (seed % 1400) / 100; // every 18 to 32 seconds
              const delay = ((seed >>> 8) % 2000) / 100;
              return (
                <circle key={link.id} r="1.8" className={styles.spark} opacity="0">
                  <animateMotion dur={`${cycle}s`} begin={`${delay}s`} repeatCount="indefinite" path={link.path} keyPoints="0;1;1" keyTimes="0;0.13;1" calcMode="linear" />
                  <animate attributeName="opacity" dur={`${cycle}s`} begin={`${delay}s`} repeatCount="indefinite" values="0;0.9;0.9;0;0" keyTimes="0;0.02;0.1;0.13;1" />
                </circle>
              );
            })}
        </g>
      )}
    </svg>
  );
}

/** One constellation's dotted region and its name. Click the name to choose the constellation. */
function Region({ figure, tone, onLabel }: { figure: Figure; tone: Tone; onLabel: (key: string) => void }) {
  const { info, label } = figure;
  const count = info.entries.length;
  const epithet = info.lore.epithet.charAt(0).toUpperCase() + info.lore.epithet.slice(1);
  return (
    <g className={styles.region} data-tone={tone} style={{ "--accent": info.accent } as CSSProperties}>
      <path d={figure.region} className={styles.regionShape} />
      <g className={styles.regionLabel} data-label="" onClick={() => onLabel(info.key)}>
        <text x={label.x} y={label.y + LABEL_LINES.kicker} className={styles.regionKicker}>
          {`${info.numeral} · ${info.lore.latin}`.toUpperCase()}
        </text>
        <text x={label.x} y={label.y + LABEL_LINES.name} className={styles.regionName}>
          {info.genre}
        </text>
        <text x={label.x} y={label.y + LABEL_LINES.epithet} className={styles.regionEpithet}>
          {`${epithet} · ${count} ${count === 1 ? "book" : "books"}`}
        </text>
      </g>
    </g>
  );
}

/** Faint circles and spokes behind everything, like the coordinate grid of an old star atlas. */
function Graticule({ radius }: { radius: number }) {
  const rings = [0.3, 0.55, 0.8, 1].map((share) => share * radius);
  const hours = Array.from({ length: 12 }, (_, index) => index);
  const ticks = Array.from({ length: 72 }, (_, index) => index);
  const at = (angle: number, distance: number) => ({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance });
  const ecliptic = `M${-radius * 0.97},${radius * 0.2} Q0,${-radius * 0.46} ${radius * 0.97},${-radius * 0.04}`;
  const NUMERALS = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
  return (
    <g>
      {rings.map((ring, index) => (
        <circle key={ring} r={ring} className={index % 2 ? styles.ringDotted : styles.ring} />
      ))}
      {hours.map((hour) => {
        const angle = (hour / 12) * Math.PI * 2;
        const from = at(angle, rings[0]);
        const to = at(angle, radius);
        return <line key={hour} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={styles.spoke} />;
      })}
      {ticks.map((tick) => {
        const angle = (tick / 72) * Math.PI * 2;
        const from = at(angle, radius);
        const to = at(angle, radius + (tick % 6 === 0 ? 16 : 7));
        return <line key={tick} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={styles.tick} />;
      })}
      {hours.map((hour) => {
        const spot = at((hour / 12) * Math.PI * 2 - Math.PI / 2, radius + 40);
        return (
          <text key={hour} x={spot.x} y={spot.y} className={styles.hour}>
            {NUMERALS[hour]}
          </text>
        );
      })}
      <path id="sky-ecliptic" d={ecliptic} className={styles.ecliptic} />
      <text className={styles.eclipticLabel}>
        <textPath href="#sky-ecliptic" startOffset="6%">
          ECLIPTICA · THE PATH OF THE READING YEAR
        </textPath>
      </text>
    </g>
  );
}

/* ---------- One book: a star with its cover ---------- */

type StarProps = {
  star: Placed;
  info: ConstellationInfo;
  tone: Tone;
  isOpen: boolean;
  isFound: boolean;
  onEnter: (pointerType: string) => void;
  onLeave: () => void;
  onFocus: (button: HTMLElement) => void;
  onClick: () => void;
};

function StarButton({ star, info, tone, isOpen, isFound, onEnter, onLeave, onFocus, onClick }: StarProps) {
  const { book } = star;
  const seed = hash(book.id);
  const look = {
    transform: `translate(${star.x}px, ${star.y}px)`,
    "--accent": info.accent,
    // Rating → glow: a higher rating means a bigger, brighter halo
    "--glow": `${Math.round(110 + 120 * star.brightness)}px`,
    "--shine": (0.3 + 0.6 * star.brightness).toFixed(2),
    "--glint": `${Math.round(9 + 13 * star.brightness)}px`,
    // Each star breathes and floats on its own rhythm
    "--delay": `${-((seed % 9000) / 1000).toFixed(2)}s`,
    "--cover-width": `${COVER.width}px`,
    "--cover-height": `${COVER.height}px`,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={styles.star}
      style={look}
      data-book-button={book.id}
      data-tone={tone}
      data-open={isOpen || undefined}
      data-found={isFound || undefined}
      aria-label={`${book.title}${book.author ? ` by ${book.author}` : ""}. ${info.genre}, ${ratingWords(book.rating)}. Star ${star.designation}.`}
      aria-describedby={tone === "hot" ? "star-tip" : undefined}
      onPointerEnter={(event) => onEnter(event.pointerType)}
      onPointerLeave={onLeave}
      onFocus={(event) => onFocus(event.currentTarget)}
      onBlur={onLeave}
      onClick={onClick}
    >
      <span className={styles.starHalo} aria-hidden="true" />
      <span className={styles.starBody}>
        <span className={styles.starFloat}>
          <span className={styles.starCover} data-cover="">
            <Cover book={book} />
          </span>
        </span>
        <span className={styles.starGlint} aria-hidden="true" />
      </span>
      <span className={styles.starLabel} aria-hidden="true">
        <span className={styles.starLetter}>{star.letter}</span> {book.title}
      </span>
    </button>
  );
}

/** The floating card next to a book under the mouse. It stays the same size at any zoom. */
function StarTip({ star, info, side, shift }: { star: Placed; info: ConstellationInfo; side: Tip["side"]; shift: number }) {
  const { book } = star;
  // The anchor point, in map units: beside the cover, or below its title
  const reach = COVER.width / 2 + 14;
  const anchor =
    side === "below" ? { x: star.x, y: star.y + COVER.height / 2 + 52 } : { x: star.x + (side === "right" ? reach : -reach), y: star.y };
  return (
    <div
      className={styles.tip}
      data-side={side}
      style={{ left: anchor.x, top: anchor.y, "--accent": info.accent, "--shift": `${shift}px` } as CSSProperties}
    >
      <div className={styles.tipCard} id="star-tip" role="tooltip">
        <p className={styles.tipKicker}>
          <span className={styles.tipLetter}>{star.letter}</span> {info.lore.genitive}
        </p>
        <p className={styles.tipTitle}>{book.title}</p>
        <p className={styles.tipAuthor}>{book.author ? `by ${book.author}` : "Author unknown"}</p>
        <p className={styles.tipGenre}>
          <span className={styles.tipDot} aria-hidden="true" />
          {info.genre}
        </p>
        <RatingStars rating={book.rating} />
        <p className={styles.tipHint}>Click to enter its world</p>
      </div>
    </div>
  );
}
