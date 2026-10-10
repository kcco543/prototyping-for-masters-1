/**
 * Weather Cat — the world map card.
 *
 * The 3D picture itself is drawn by `world-map-three.ts`. This file is the
 * page side of the map:
 *
 *   - it passes the weather in (pin colours, which place is on screen),
 *   - it listens to the pointer: hovering shows a city's name and
 *     temperature, clicking chooses it, and on a narrow screen dragging
 *     slides the map sideways,
 *   - it shows the name label, which is ordinary HTML laid over the canvas
 *     (text stays sharp that way), and
 *   - it makes the map usable without a pointer. A canvas is just a picture
 *     to a keyboard or a screen reader, so every city also exists as a real
 *     (hidden) button. Tab reaches the map, and the arrow keys move from city
 *     to city, west to east.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { WeatherIcon } from "./art";
import { toTemp, type Place, type Units, type WeatherNow } from "./weather";
import { createMapScene, TEMP_STOPS, type MapScene } from "./world-map-three";
import styles from "./styles.module.css";

type Props = {
  cities: Place[];
  /** The weather right now in those cities, by city name. Empty until it arrives. */
  weather: Record<string, WeatherNow>;
  /** The weather the page is showing. Its place gets the ring on the map. */
  current: WeatherNow | null;
  units: Units;
  onChoose: (city: Place) => void;
};

/** How close (in pixels) the pointer has to be to a pin to count. Fingers are less exact than a mouse. */
const REACH_MOUSE = 16;
const REACH_TOUCH = 26;
/** Moving further than this many pixels with the button down is a drag, not a click. */
const DRAG_START = 6;

/** The legend's colour bar: the same stops the pins use, spread evenly from left to right. */
const LEGEND_COLOURS = `linear-gradient(90deg, ${TEMP_STOPS.map(([, colour]) => colour).join(", ")})`;
const COLDEST = TEMP_STOPS[0][0];
const HOTTEST = TEMP_STOPS[TEMP_STOPS.length - 1][0];

export function WorldMap({ cities, weather, current, units, onChoose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const cityButtons = useRef<(HTMLButtonElement | null)[]>([]);
  /** The Three.js scene. It is kept in a ref, not in state: changing it shouldn't redraw the React page. */
  const map = useRef<MapScene | null>(null);
  /** A press that is in progress: where it started, where it is now, and whether it has become a drag. */
  const press = useRef<{ startX: number; startY: number; lastX: number; dragging: boolean; moved: boolean } | null>(null);

  /** The city under the pointer or holding keyboard focus (its number in `cities`). */
  const [active, setActive] = useState<number | null>(null);
  /** The city that Tab lands on. Arrow keys move it. */
  const [tabStop, setTabStop] = useState(0);
  const [pannable, setPannable] = useState(false);
  /** True if the 3D map could not start (a browser without WebGL). The cities are then shown as plain buttons. */
  const [noWebGL, setNoWebGL] = useState(false);

  /** The cities' numbers, sorted from west to east: the order the arrow keys follow. */
  const westToEast = useMemo(() => cities.map((_, index) => index).sort((a, b) => cities[a].lon - cities[b].lon), [cities]);

  /* ----- Start the 3D scene once the canvas exists, and stop it when leaving ----- */
  useEffect(() => {
    if (!canvas.current || !box.current) return;

    /** Puts the label just above a pin, without letting it poke out of the map's box. */
    const placeLabel = (x: number, y: number) => {
      const tag = label.current;
      const frame = box.current;
      if (!tag || !frame) return;
      const half = tag.offsetWidth / 2;
      const left = Math.min(Math.max(x - half, 6), frame.clientWidth - tag.offsetWidth - 6);
      // Normally the label sits above the pin. Near the top edge it goes below instead.
      const above = y - tag.offsetHeight - 8;
      tag.style.transform = `translate(${Math.round(left)}px, ${Math.round(above >= 4 ? above : y + 30)}px)`;
    };

    let scene: MapScene;
    try {
      scene = createMapScene(canvas.current, cities, {
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        onLabelMove: placeLabel,
      });
    } catch {
      setNoWebGL(true);
      return;
    }
    map.current = scene;

    // Keep the picture the same size as its box, whenever the box changes.
    const sizeWatcher = new ResizeObserver(([entry]) => {
      scene.resize(entry.contentRect.width, entry.contentRect.height);
      setPannable(scene.pannable);
    });
    sizeWatcher.observe(box.current);

    return () => {
      sizeWatcher.disconnect();
      scene.dispose();
      map.current = null;
    };
  }, [cities]);

  /* ----- Pass each change on to the scene ----- */
  // (These run after the effect above, so the scene already exists.)

  useEffect(() => {
    map.current?.setTemps(cities.map((city) => weather[city.name]?.current.temp ?? null));
  }, [cities, weather]);

  const place = current?.place;
  const temp = current?.current.temp;
  useEffect(() => {
    map.current?.setCurrent(place && temp !== undefined ? { lat: place.lat, lon: place.lon, temp } : null);
  }, [place, temp]);

  useEffect(() => {
    map.current?.setHighlight(active);
    // The label follows the city being pointed at. Otherwise it stays on the place on screen.
    map.current?.setLabelAnchor(active ?? (current ? "current" : null));
  }, [active, current]);

  /* ----- Pointer: hover, click and drag ----- */

  /** Which city is under this pointer event, if any. */
  const cityAt = (event: PointerEvent) => {
    const edge = event.currentTarget.getBoundingClientRect();
    const reach = event.pointerType === "touch" ? REACH_TOUCH : REACH_MOUSE;
    return map.current?.pick(event.clientX - edge.left, event.clientY - edge.top, reach) ?? null;
  };

  const onPointerDown = (event: PointerEvent) => {
    press.current = { startX: event.clientX, startY: event.clientY, lastX: event.clientX, dragging: false, moved: false };
  };

  const onPointerMove = (event: PointerEvent) => {
    const held = press.current;
    if (held) {
      if (Math.hypot(event.clientX - held.startX, event.clientY - held.startY) > DRAG_START) held.moved = true;

      if (!held.dragging && held.moved && map.current?.pannable) {
        held.dragging = true;
        // "Capturing" keeps the drag going even if the pointer leaves the map.
        event.currentTarget.setPointerCapture(event.pointerId);
        setActive(null);
      }
      if (held.dragging) {
        map.current?.panBy(event.clientX - held.lastX);
        held.lastX = event.clientX;
        return;
      }
    }
    // A finger has no "hover": the name appears when the city is chosen instead.
    if (event.pointerType !== "touch") setActive(cityAt(event));
  };

  const onPointerUp = (event: PointerEvent) => {
    const held = press.current;
    press.current = null;
    if (!held || held.moved) return; // that was a drag
    const city = cityAt(event);
    if (city !== null) onChoose(cities[city]);
  };

  const onPointerLeave = () => {
    if (!press.current?.dragging) setActive(null);
  };

  /* ----- Keyboard: arrow keys move between the hidden city buttons ----- */

  const onCityKeyDown = (event: KeyboardEvent, index: number) => {
    const position = westToEast.indexOf(index);
    let next = position;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = position + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = position - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = westToEast.length - 1;
    else return;

    event.preventDefault(); // stop the arrow keys from scrolling the page
    // The % makes the list wrap around: east of the last city is the first one.
    const target = westToEast[(next + westToEast.length) % westToEast.length];
    setTabStop(target);
    cityButtons.current[target]?.focus();
  };

  /* ----- What the label says ----- */

  const labelled = active !== null ? { name: cities[active].name, now: weather[cities[active].name]?.current } : current ? { name: current.place.name, now: current.current } : null;
  const degree = units === "imperial" ? "°F" : "°C";

  return (
    <section className={`${styles.card} ${styles.mapCard}`} aria-label="World map">
      <div className={styles.mapHeader}>
        <h2 className={styles.cardTitle}>Around the world</h2>
        <p className={styles.mapHint}>{pannable ? "Pick a city. Drag sideways to see more." : "Pick a city to see its weather."}</p>
      </div>

      <div ref={box} className={`${styles.mapBox} ${noWebGL ? styles.mapBoxPlain : ""}`}>
        {!noWebGL && (
          <>
            <canvas
              ref={canvas}
              className={`${styles.mapCanvas} ${active !== null ? styles.mapOnCity : pannable ? styles.mapDraggable : ""}`}
              aria-hidden="true"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                press.current = null;
              }}
              onPointerLeave={onPointerLeave}
            />

            {labelled && (
              <div ref={label} className={styles.mapLabel} aria-hidden="true">
                {labelled.now && <WeatherIcon mood={labelled.now.mood} className={styles.mapLabelIcon} />}
                <span className={styles.mapLabelName}>{labelled.name}</span>
                {labelled.now && <span className={styles.mapLabelTemp}>{toTemp(labelled.now.temp, units)}°</span>}
              </div>
            )}

            <div className={styles.legend} aria-hidden="true">
              <span>
                {toTemp(COLDEST, units)}
                {degree}
              </span>
              <span className={styles.legendBar} style={{ background: LEGEND_COLOURS }} />
              <span>
                {toTemp(HOTTEST, units)}
                {degree}
              </span>
            </div>
          </>
        )}

        {/*
          The same cities as real buttons. With the 3D map running they are
          hidden from view (but not from the keyboard or screen readers), and
          only one of them at a time is a Tab stop. Without WebGL they are
          shown, so the map still does its job.
        */}
        <ul className={noWebGL ? styles.cityList : styles.srOnly} aria-label="Cities on the map. Use the arrow keys to move between them.">
          {westToEast.map((index) => {
            const city = cities[index];
            const now = weather[city.name]?.current;
            return (
              <li key={city.name}>
                <button
                  ref={(button) => {
                    cityButtons.current[index] = button;
                  }}
                  type="button"
                  className={styles.cityButton}
                  tabIndex={noWebGL || index === tabStop ? 0 : -1}
                  onFocus={() => {
                    setActive(index);
                    map.current?.reveal(index);
                  }}
                  onBlur={() => setActive(null)}
                  onKeyDown={(event) => onCityKeyDown(event, index)}
                  onClick={() => onChoose(city)}
                >
                  {city.name}
                  {now && (
                    <>
                      <span className={styles.srOnly}>, </span>
                      <span className={styles.cityButtonTemp}>
                        {toTemp(now.temp, units)}
                        {degree}
                      </span>
                      <span className={styles.srOnly}>, {now.description}</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
