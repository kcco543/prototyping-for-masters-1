"use client";

/**
 * The homepage cat tree: a rotatable, 3D-looking cat tree whose rooms are
 * the prototypes. Click a room to "enter" that cat's room.
 *
 * How the 3D works (no 3D library needed):
 * - Every solid piece is built from flat <div> "faces" placed in 3D space
 *   with CSS transforms (translate3d / rotateX / rotateY). A box has 6
 *   faces; a round post is a ring of thin strips.
 * - The whole tree sits inside one "scene" element. Rotating the scene
 *   (with `transform-style: preserve-3d` and `perspective` on its parent)
 *   rotates every piece together, so it looks like a real object.
 * - Some things are "billboards": flat pictures that always turn to face you
 *   (the name tags, the glass bubble, the pom-poms). They undo the scene's
 *   rotation using the CSS variables --rx and --ry.
 * - Flat shading (each side a slightly different tint) gives the
 *   illustration-style look used across the site.
 *
 * Coordinates are in px, measured from the photo: x → right, y → down
 * (negative is up; y = 0 is the floor), z → towards you.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import s from "./CatTree.module.css";

/* ---------- Public types ---------- */

/** The rooms you can put a prototype in. */
export type RoomId = "perch" | "bubble" | "barrel" | "house" | "hammock";

export type TreePrototype = {
  title: string;
  description: string;
  path: string;
  /** Which room of the cat tree it lives in. Leave out to list it under the tree instead. */
  room?: RoomId;
  /** Colour for the name tag's cat ears */
  accent?: string;
};

/**
 * Events fired on `window` while the tree is being dragged, so other parts of
 * the page can react. The cats use them to stop chasing the laser dot.
 */
export const TREE_DRAG_START = "cattree:dragstart";
export const TREE_DRAG_END = "cattree:dragend";

/* ---------- Tree layout ---------- */

/** Everything is shifted down by this much so the tree spins around its middle, not its feet. */
const Y0 = 300;

/** Where each room is (its centre) and where its name tag hangs. */
const ROOMS: Record<RoomId, { centre: [number, number, number]; tag: [number, number, number] }> = {
  perch: { centre: [-111, -585, 0], tag: [-222, -592, 10] },
  bubble: { centre: [-84, -466, 10], tag: [40, -448, 30] },
  barrel: { centre: [-100, -395, 0], tag: [-218, -392, 20] },
  house: { centre: [63, -288, 0], tag: [196, -262, 40] },
  hammock: { centre: [0, -195, 0], tag: [0, -126, 40] },
};

const PERSPECTIVE = 1500;
const PERSPECTIVE_Y = 0.45; // matches perspective-origin in the CSS

/**
 * Where does a point of the tree appear on screen?
 * This does the same maths the browser does for the scene's CSS transform
 * (scale → rotateX → rotateY, then perspective), so the flat name tags can
 * be drawn on top of the 3D tree and never get hidden behind a shelf.
 */
function project([x, y, z]: [number, number, number], rxDeg: number, ryDeg: number, scale: number, w: number, h: number) {
  const ry = (ryDeg * Math.PI) / 180;
  const rx = (rxDeg * Math.PI) / 180;
  const py = y + Y0;
  // rotateY
  const x1 = x * Math.cos(ry) + z * Math.sin(ry);
  const z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  // rotateX
  const y2 = py * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = py * Math.sin(rx) + z1 * Math.cos(rx);
  // scale, then perspective (seen from the perspective origin)
  const X = x1 * scale;
  const Y = y2 * scale + h * (0.5 - PERSPECTIVE_Y);
  const f = PERSPECTIVE / (PERSPECTIVE - z2 * scale);
  return [w / 2 + X * f, h * PERSPECTIVE_Y + Y * f];
}

/* ---------- Colours (flat illustration palette) ---------- */

const WOOD = "#ecc9a0";
const CUSHION = "#fbf6ec";
const SISAL = "#ecdcc0";
const SISAL_LINE = "#cdb48c";

/** Lighten (f > 1) or darken (f < 1) a hex colour. */
function tint(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c.join(",")})`;
}

const GRAIN = "repeating-linear-gradient(0deg, rgba(150,100,55,0.09) 0 1px, transparent 1px 7px)";

/** Each side of a box gets its own flat tint, as if lit from the top-left. */
function material(kind: "wood" | "cushion") {
  const base = kind === "wood" ? WOOD : CUSHION;
  const g = kind === "wood" ? `${GRAIN}, ` : "";
  return {
    front: g + tint(base, 1),
    back: g + tint(base, 0.82),
    left: g + tint(base, 0.92),
    right: g + tint(base, 0.86),
    top: g + tint(base, 1.06),
    bottom: g + tint(base, 0.74),
  };
}

/* ---------- 3D building blocks ---------- */

type BoxProps = {
  x?: number;
  y?: number;
  z?: number;
  w: number;
  h: number;
  d: number;
  /** tilt around the z axis (degrees), used for the hammock's corners */
  rz?: number;
  kind?: "wood" | "cushion";
  /** custom background for the front face (e.g. the house's round door) */
  front?: string;
  /** things painted on the front face */
  children?: ReactNode;
};

/** A box made of 6 faces. (x, y, z) is its centre. */
function Box({ x = 0, y = 0, z = 0, w, h, d, rz = 0, kind = "wood", front, children }: BoxProps) {
  const m = material(kind);
  const face = (key: string, fw: number, fh: number, transform: string, background: string) => (
    <div key={key} className={s.face} style={{ width: fw, height: fh, marginLeft: -fw / 2, marginTop: -fh / 2, background, transform }} />
  );
  return (
    <div className={s.obj} style={{ transform: `translate3d(${x}px, ${y + Y0}px, ${z}px) rotateZ(${rz}deg)` }}>
      {face("front", w, h, `translateZ(${d / 2}px)`, front ?? m.front)}
      {face("back", w, h, `rotateY(180deg) translateZ(${d / 2}px)`, m.back)}
      {face("right", d, h, `rotateY(90deg) translateZ(${w / 2}px)`, m.right)}
      {face("left", d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, m.left)}
      {face("top", w, d, `rotateX(90deg) translateZ(${h / 2}px)`, m.top)}
      {face("bottom", w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, m.bottom)}
      {children && (
        <div className={s.obj} style={{ transform: `translateZ(${d / 2 + 0.6}px)` }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** A round sisal scratching post: a ring of thin striped strips. */
function Post({ x, top, bottom, r, n = 14 }: { x: number; top: number; bottom: number; r: number; n?: number }) {
  const h = bottom - top;
  const fw = 2 * r * Math.tan(Math.PI / n) + 0.8; // strip width (+ a hair of overlap to hide seams)
  return (
    <div className={s.obj} style={{ transform: `translate3d(${x}px, ${(top + bottom) / 2 + Y0}px, 0)` }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i * 360) / n;
        const light = 0.78 + 0.24 * Math.max(0, Math.cos(((a - 25) * Math.PI) / 180));
        return (
          <div
            key={i}
            className={s.face}
            style={{
              width: fw,
              height: h,
              marginLeft: -fw / 2,
              marginTop: -h / 2,
              background: `repeating-linear-gradient(0deg, ${tint(SISAL, light)} 0 3px, ${tint(SISAL_LINE, light)} 3px 4.5px)`,
              transform: `rotateY(${a}deg) translateZ(${r}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

/** The barrel tunnel: a cylinder lying on its side (along x), made of planks. */
function Barrel({ x, y, len, r, n = 16, children }: { x: number; y: number; len: number; r: number; n?: number; children?: ReactNode }) {
  const fw = 2 * r * Math.tan(Math.PI / n) + 0.8;
  return (
    <div className={s.obj} style={{ transform: `translate3d(${x}px, ${y + Y0}px, 0)` }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i * 360) / n;
        const light = 0.74 + 0.3 * Math.max(0, Math.cos(((a + 35) * Math.PI) / 180));
        return (
          <div
            key={i}
            className={s.face}
            style={{
              width: len,
              height: fw,
              marginLeft: -len / 2,
              marginTop: -fw / 2,
              background: `linear-gradient(0deg, rgba(120,75,40,0.35) 0 1px, transparent 1px calc(100% - 1px), rgba(255,255,255,0.25) calc(100% - 1px)), ${GRAIN}, ${tint(WOOD, light)}`,
              transform: `rotateX(${a}deg) translateZ(${r}px)`,
            }}
          />
        );
      })}
      {/* closed end (left) */}
      <div className={`${s.face} ${s.round}`} style={{ width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, background: `${GRAIN}, ${tint(WOOD, 0.9)}`, transform: `rotateY(-90deg) translateZ(${len / 2}px)` }} />
      {/* open end (right): a dark doorway with a wooden rim */}
      <div
        className={`${s.face} ${s.round}`}
        style={{ width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, background: `radial-gradient(circle, #3b2b22 0 72%, ${tint(WOOD, 0.95)} 73%)`, transform: `rotateY(90deg) translateZ(${len / 2}px)` }}
      >
        {children}
      </div>
    </div>
  );
}

/** A flat picture that always faces you, placed at (x, y, z). */
function Billboard({ x, y, z = 0, children }: { x: number; y: number; z?: number; children: ReactNode }) {
  return (
    <div className={s.obj} style={{ transform: `translate3d(${x}px, ${y + Y0}px, ${z}px)` }}>
      <div className={s.billboard}>{children}</div>
    </div>
  );
}

/** Two glowing cat eyes that blink open in a dark doorway when you hover the room. */
function Eyes({ x = 0, y = 0, gap = 12 }: { x?: number; y?: number; gap?: number }) {
  return (
    <span className={s.eyes} style={{ left: x - gap / 2 - 4, top: y - 3, gap }} aria-hidden="true">
      <span className={s.eye} />
      <span className={s.eye} />
    </span>
  );
}

/* ---------- The component ---------- */

type Hovered = TreePrototype | null;

export default function CatTree({ prototypes }: { prototypes: TreePrototype[] }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [hovered, setHovered] = useState<Hovered>(null);
  const [entering, setEntering] = useState<{ proto: TreePrototype; px: number; py: number; open: boolean } | null>(null);

  // Rotation state lives in a ref and is applied directly every frame (smooth, no re-renders)
  const rot = useRef({ rx: -12, ry: -24, vy: 0, dragging: false, lastInteract: 0, sway: 0, scale: 1, entering: false, w: 0, h: 0 });
  const tagRefs = useRef(new Map<RoomId, HTMLAnchorElement>());
  const dragged = useRef(false);

  const byRoom = new Map<RoomId, TreePrototype>();
  for (const p of prototypes) if (p.room && !byRoom.has(p.room)) byRoom.set(p.room, p);
  const homeless = prototypes.filter((p) => !p.room || byRoom.get(p.room) !== p);

  /* ----- Fit the tree to the available space ----- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fit = () => {
      const k = Math.min(1.05, el.clientWidth / 540, (window.innerHeight - 150) / 720);
      const v = Math.max(0.5, k);
      rot.current.scale = v;
      rot.current.w = el.clientWidth;
      rot.current.h = 720 * v;
      setScale(v);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  /* ----- Animation loop: inertia, gentle idle sway, and "turn to face me" when entering ----- */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = rot.current;
      if (r.entering) {
        // turn to face the front, taking the shortest way round
        const target = Math.round(r.ry / 360) * 360;
        const k = 1 - Math.exp(-dt * 7);
        r.ry += (target - r.ry) * k;
        r.rx += (0 - r.rx) * k;
        r.sway += (0 - r.sway) * k;
      } else if (!r.dragging) {
        // keep spinning a little after you let go, slowing down
        r.ry += r.vy * dt;
        r.vy *= Math.exp(-dt * 2.5);
        // after a few quiet seconds, the tree sways gently on its own
        const idle = now - r.lastInteract > 2500 && !reduced;
        r.sway += ((idle ? 1 : 0) - r.sway) * (1 - Math.exp(-dt * 0.8));
      } else {
        r.sway += (0 - r.sway) * (1 - Math.exp(-dt * 6));
      }
      const t = now / 1000;
      const ry = r.ry + Math.sin(t * 0.45) * 16 * r.sway;
      const rx = r.rx + Math.sin(t * 0.31) * 3 * r.sway;
      const scene = sceneRef.current;
      if (scene) {
        scene.style.transform = `scale(${r.scale}) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        scene.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        scene.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
      }
      // Place the flat name tags over their rooms (see project() below)
      for (const [id, el] of tagRefs.current) {
        let [x, y] = project(ROOMS[id].tag, rx, ry, r.scale, r.w, r.h);
        // keep the whole tag on screen (matters on narrow phones)
        const half = el.offsetWidth / 2 + 4;
        x = Math.max(half, Math.min(r.w - half, x));
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ----- Drag to rotate ----- */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || rot.current.entering) return;
    const r = rot.current;
    const start = { x: e.clientX, y: e.clientY, rx: r.rx, ry: r.ry, t: performance.now() };
    const touch = e.pointerType !== "mouse";
    let lastX = e.clientX;
    let lastT = start.t;
    dragged.current = false;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!r.dragging && Math.hypot(dx, dy) > 6) {
        r.dragging = true;
        dragged.current = true;
        // tell the page's cats to ignore the laser while the tree is being spun
        window.dispatchEvent(new Event(TREE_DRAG_START));
        wrapRef.current?.classList.add(s.grabbing);
      }
      if (!r.dragging) return;
      r.ry = start.ry + dx * 0.45;
      if (!touch) r.rx = Math.max(-38, Math.min(14, start.rx - dy * 0.3)); // tilt up/down (mouse only)
      const now = performance.now();
      r.vy = ((ev.clientX - lastX) * 0.45) / Math.max(0.001, (now - lastT) / 1000);
      lastX = ev.clientX;
      lastT = now;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (performance.now() - lastT > 80) r.vy = 0; // held still before letting go: no fling
      r.vy = Math.max(-400, Math.min(400, r.vy));
      if (r.dragging) window.dispatchEvent(new Event(TREE_DRAG_END));
      r.dragging = false;
      r.lastInteract = performance.now();
      wrapRef.current?.classList.remove(s.grabbing);
      // the click that ends a drag should not open a room
      window.setTimeout(() => (dragged.current = false), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  /* ----- Keyboard: arrow keys rotate ----- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const r = rot.current;
    const k = { ArrowLeft: [0, -20], ArrowRight: [0, 20], ArrowUp: [-8, 0], ArrowDown: [8, 0] }[e.key];
    if (!k || e.target !== e.currentTarget) return;
    e.preventDefault();
    r.rx = Math.max(-38, Math.min(14, r.rx + k[0]));
    r.ry += k[1];
    r.lastInteract = performance.now();
  };

  /* ----- Entering a room ----- */
  const enter = useCallback(
    (proto: TreePrototype, tagEl: HTMLElement) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        router.push(proto.path);
        return;
      }
      router.prefetch(proto.path);
      const rect = tagEl.getBoundingClientRect();
      rot.current.entering = true;
      setEntering({ proto, px: rect.left + rect.width / 2, py: rect.top + rect.height / 2, open: false });
      // 1) turn to face the room and zoom in … 2) a round "doorway" opens … 3) go!
      window.setTimeout(() => setEntering((e) => (e ? { ...e, open: true } : e)), 380);
      window.setTimeout(() => router.push(proto.path), 1000);
    },
    [router],
  );

  const onRoomClick = (proto: TreePrototype) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (dragged.current) {
      e.preventDefault(); // that was a drag, not a click
      return;
    }
    // let ⌘/Ctrl/Shift-click open a new tab as usual
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    const tag = (proto.room && tagRefs.current.get(proto.room)) || e.currentTarget;
    enter(proto, tag);
  };

  /**
   * Wraps a room's 3D parts in a link, and adds its hanging name tag.
   * (A plain function, not a component, so React doesn't rebuild the room
   * on every hover — that would lose keyboard focus.)
   */
  const room = (id: RoomId, children: ReactNode) => {
    const proto = byRoom.get(id);
    if (!proto) return <div key={id} className={s.obj}>{children}</div>; // empty room: just decoration
    return (
      <Link
        key={id}
        href={proto.path}
        className={`${s.room} ${hovered === proto || entering?.proto === proto ? s.roomActive : ""}`}
        {...roomHandlers(proto)}
        // the name tag (below) is the keyboard-focusable link; this one is for mouse clicks on the room itself
        tabIndex={-1}
        aria-hidden="true"
        draggable={false}
      >
        {children}
      </Link>
    );
  };

  /** Shared hover/focus/click handlers for a room and its name tag. */
  const roomHandlers = (proto: TreePrototype) => ({
    onClick: onRoomClick(proto),
    onMouseEnter: () => {
      setHovered(proto);
      router.prefetch(proto.path);
    },
    onMouseLeave: () => setHovered((h) => (h === proto ? null : h)),
  });

  // Zoom towards the room while entering
  const zoom = entering
    ? (() => {
        const [x, y] = ROOMS[entering.proto.room!].centre;
        return `scale(1.9) translate(${-x * scale}px, ${-(y + Y0) * scale}px)`;
      })()
    : "none";

  return (
    <div className={s.wrap}>
      <div
        ref={wrapRef}
        className={s.viewport}
        style={{ height: 720 * scale, "--tree-scale": scale } as CSSProperties}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="group"
        aria-label="A cat tree. Drag, or use the arrow keys, to spin it. Each room is a prototype; press Tab to reach the rooms."
      >
        <div className={s.zoomer} style={{ transform: zoom }}>
          <div ref={sceneRef} className={s.scene}>
            {/* soft shadow on the floor */}
            <div className={s.obj} style={{ transform: `translate3d(0, ${Y0}px, 0) rotateX(90deg)` }}>
              <div className={s.floorShadow} />
            </div>

            {/* ----- base and posts ----- */}
            <Box y={-7} w={266} h={14} d={150} />
            <Box y={-15.5} w={258} h={3} d={142} kind="cushion" />
            <Post x={-99} top={-573} bottom={-14} r={13} />
            <Post x={102} top={-492} bottom={-14} r={14} />

            {/* ----- shelves and steps ----- */}
            <Box x={4} y={-490} w={268} h={8} d={100} />
            {/* the lounge bed on the upper shelf, with a napping cat */}
            <Box x={68} y={-496} w={136} h={4} d={94} kind="cushion" />
            <Box x={68} y={-506} z={-44} w={136} h={18} d={6} kind="cushion" />
            <Box x={133} y={-503} w={6} h={14} d={94} kind="cushion" />
            <Billboard x={70} y={-512} z={4}>
              <NappingCat />
            </Billboard>

            <Box x={-1} y={-236} w={262} h={8} d={100} />
            <Box x={-68} y={-241.5} w={124} h={3} d={94} kind="cushion" />
            <Box x={104} y={-412} w={92} h={7} d={80} />
            <Box x={104} y={-417} w={86} h={3} d={74} kind="cushion" />
            <Box x={104} y={-128} w={92} h={7} d={80} />
            <Box x={104} y={-133} w={86} h={3} d={74} kind="cushion" />

            {/* pom-pom on a string under the bubble, and one on the post */}
            <div className={s.obj} style={{ transform: `translate3d(-73px, ${-398 + Y0}px, 0)` }}>
              <div className={s.string} />
              <div className={s.string} style={{ transform: "rotateY(90deg)" }} />
            </div>
            <Billboard x={-73} y={-350}>
              <span className={s.pom} style={{ width: 26, height: 26, marginLeft: -13, marginTop: -13 }} />
            </Billboard>
            <Billboard x={-84} y={-190} z={8}>
              <span className={s.pom} style={{ width: 24, height: 24, marginLeft: -12, marginTop: -12 }} />
            </Billboard>

            {/* ----- the rooms ----- */}

            {/* Perch bed at the very top */}
            {room("perch", <>
              <Box x={-111} y={-573} w={84} h={6} d={72} />
              <Box x={-111} y={-579} w={80} h={6} d={68} kind="cushion" />
              <Box x={-111} y={-589} z={-31} w={80} h={20} d={6} kind="cushion" />
              <Box x={-148} y={-586} w={6} h={14} d={68} kind="cushion" />
              <Box x={-74} y={-586} w={6} h={14} d={68} kind="cushion" />
            </>)}

            {/* Glass bubble → crystal ball */}
            {room("bubble", <>
              <Billboard x={-84} y={-466} z={10}>
                <span className={s.bubble}>
                  <span className={s.sparkle} style={{ left: "30%", top: "58%" }} />
                  <span className={s.sparkle} style={{ left: "62%", top: "40%", animationDelay: "0.6s" }} />
                  <span className={s.sparkle} style={{ left: "48%", top: "72%", animationDelay: "1.2s" }} />
                </span>
              </Billboard>
            </>)}

            {/* Barrel tunnel */}
            {room("barrel", <>
              <Barrel x={-100} y={-395} len={112} r={43}>
                <Eyes x={43} y={43} gap={14} />
              </Barrel>
            </>)}

            {/* Cube house with the round door */}
            {room("house", <>
              <Box x={50} y={-340} w={164} h={7} d={116} />
              <Box x={50} y={-345} w={160} h={3} d={112} kind="cushion" />
              <Box
                x={63}
                y={-288}
                w={134}
                h={96}
                d={108}
                front={`radial-gradient(circle at 34% 50%, #3b2b22 0 19px, rgba(120,75,40,0.35) 19px 20.5px, transparent 21px), ${GRAIN}, ${WOOD}`}
              >
                <Eyes x={134 * 0.34 - 67} y={0} gap={12} />
              </Box>
            </>)}

            {/* U-shaped hammock under the middle shelf */}
            {room("hammock", <>
              <Box x={-62} y={-208} w={9} h={50} d={72} />
              <Box x={62} y={-208} w={9} h={50} d={72} />
              <Box x={-50} y={-176} w={30} h={9} d={72} rz={45} />
              <Box x={50} y={-176} w={30} h={9} d={72} rz={-45} />
              <Box x={0} y={-167} w={76} h={9} d={72} />
              <Box x={0} y={-172.5} w={72} h={2} d={66} kind="cushion" />
            </>)}
          </div>
        </div>

        {/* Name tags: flat, always on top, moved every frame to sit over their rooms */}
        <div className={`${s.tags} ${entering ? s.tagsHidden : ""}`}>
          {[...byRoom.entries()].map(([id, proto]) => (
            <Link
              key={id}
              ref={(el) => {
                if (el) tagRefs.current.set(id, el);
                else tagRefs.current.delete(id);
              }}
              href={proto.path}
              className={`${s.tag} ${hovered === proto ? s.tagActive : ""}`}
              style={{ "--accent": proto.accent ?? "#f0893d" } as CSSProperties}
              {...roomHandlers(proto)}
              onFocus={() => {
                setHovered(proto);
                // turn the tree back to the front so the focused room is easy to see
                rot.current.ry = Math.round(rot.current.ry / 360) * 360;
                rot.current.rx = -8;
                rot.current.vy = 0;
                rot.current.lastInteract = performance.now();
              }}
              onBlur={() => setHovered((h) => (h === proto ? null : h))}
              aria-label={`${proto.title}: ${proto.description}`}
              draggable={false}
            >
              {proto.title}
            </Link>
          ))}
        </div>
      </div>

      {/* What's in the room you're pointing at */}
      <div className={s.info} aria-live="polite">
        {hovered ? (
          <>
            <p className={s.infoTitle}>{hovered.title}</p>
            <p className={s.infoText}>{hovered.description}</p>
          </>
        ) : (
          <p className={s.hint}>Drag to spin the cat tree · click a room to visit its cat</p>
        )}
      </div>

      {/* Prototypes that don't have a room yet */}
      {homeless.length > 0 && (
        <div className={s.more}>
          <p className={s.moreTitle}>More rooms</p>
          <div className={s.moreList}>
            {homeless.map((p) => (
              <Link key={p.path} href={p.path} className={s.moreLink} style={{ "--accent": p.accent ?? "#f0893d" } as CSSProperties}>
                {p.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* The doorway that opens when you enter a room */}
      {entering && (
        <div
          className={`${s.portal} ${entering.open ? s.portalOpen : ""}`}
          style={{ "--px": `${entering.px}px`, "--py": `${entering.py}px`, "--accent": entering.proto.accent ?? "#f0893d" } as CSSProperties}
          aria-hidden="true"
        >
          <p className={s.portalText}>Knock knock… entering {entering.proto.title}</p>
        </div>
      )}
    </div>
  );
}

/** A little cat curled up asleep on the lounge bed (in the homepage cats' style). */
function NappingCat() {
  return (
    <svg className={s.napper} viewBox="0 0 120 64" aria-hidden="true">
      <path d="M14 60 C4 60 2 40 16 32 C34 22 70 20 92 26 C110 30 116 46 112 60Z" fill="#b8633a" />
      <path d="M20 58 C44 64 84 64 104 56" stroke="#9a4f2c" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M78 36 C76 20 80 8 84 2 L94 14 C98 13 102 13 106 14 L114 4 C118 12 120 26 116 38 C112 48 100 52 92 52 C84 52 80 46 78 36Z" fill="#b8633a" />
      <path d="M88 32 q3 3 6 0 M100 32 q3 3 6 0" stroke="#2b2725" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M95.5 38 h3 l-1.5 2Z" fill="#e98a86" />
      <text x="58" y="18" className={s.zzz}>z</text>
    </svg>
  );
}
