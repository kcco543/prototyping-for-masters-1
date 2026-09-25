/**
 * Artwork for "The Tower".
 *
 * Everything is drawn with plain SVG shapes in the same flat, printed style
 * as the reference illustration: bold colour blocks, simple folk patterns
 * (flowers, dots, stripes, hearts, cherries, plums) and a mint wall with
 * dotty trees. No image files are needed.
 *
 * Coordinates: every cup is drawn with its bottom-centre at (0, 0), so the
 * game can place it on a shelf just by moving that point.
 */

import { memo, type CSSProperties, type ReactNode } from "react";
import styles from "./styles.module.css";

/* ---------- Palette sampled from the reference image ---------- */
export const C = {
  ink: "#2b2725",
  white: "#fdfbf6",
  red: "#e8453c",
  navy: "#2a3f86",
  blue: "#5a86c9",
  sky: "#8fb4e3",
  yellow: "#f6e45a",
  lime: "#c6dc3a",
  green: "#3a9a52",
  teal: "#2aa3a8",
  pink: "#e8506c",
  plum: "#4b5bb0",
  gold: "#f2c230",
  mint: "#a9dccf",
  wood: "#ebc9a0",
  woodDark: "#cf9f73",
  orange: "#f0893d",
  orangeDark: "#cd5f26",
  peach: "#f9d2b4",
  peachDark: "#f0b491",
};

/** Sets a rotation pivot using SVG coordinates. */
const pivot = (x: number, y: number): CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

/** Tiny seeded random generator so the background looks the same every time. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Cups ---------- */

type Shape = "teacup" | "mug" | "bowl";
type Pattern =
  | "flower"
  | "leaves"
  | "cherries"
  | "blueFlowers"
  | "dots"
  | "sunflower"
  | "hearts"
  | "bigFlower"
  | "spikes"
  | "plums"
  | "stripes"
  | "rings";

export type CupDesign = {
  shape: Shape;
  body: string;
  pattern: Pattern;
  /** Main pattern colour */
  a: string;
  /** Secondary pattern colour */
  b?: string;
  saucer?: string;
};

/** 16 cups, 4 per shelf, top shelf first — loosely following the reference. */
export const CUPS: CupDesign[] = [
  { shape: "teacup", body: C.white, pattern: "flower", a: C.teal, b: C.green },
  { shape: "teacup", body: C.red, pattern: "leaves", a: C.white },
  { shape: "mug", body: C.white, pattern: "cherries", a: C.red, b: C.green },
  { shape: "teacup", body: C.blue, pattern: "leaves", a: C.white, saucer: C.white },

  { shape: "mug", body: C.white, pattern: "blueFlowers", a: C.navy },
  { shape: "bowl", body: C.navy, pattern: "dots", a: C.white },
  { shape: "teacup", body: C.yellow, pattern: "sunflower", a: C.lime, b: C.teal },
  { shape: "bowl", body: C.white, pattern: "hearts", a: C.pink },

  { shape: "teacup", body: C.white, pattern: "blueFlowers", a: C.blue },
  { shape: "mug", body: C.yellow, pattern: "cherries", a: C.red, b: C.green, saucer: C.red },
  { shape: "teacup", body: C.white, pattern: "bigFlower", a: C.yellow },
  { shape: "mug", body: C.white, pattern: "spikes", a: C.ink },

  { shape: "bowl", body: C.white, pattern: "plums", a: C.plum, b: C.green },
  { shape: "teacup", body: C.white, pattern: "stripes", a: C.red, saucer: C.white },
  { shape: "bowl", body: C.white, pattern: "rings", a: C.gold },
  { shape: "mug", body: C.white, pattern: "bigFlower", a: C.yellow, saucer: C.lime },
];

/** Cups are drawn a little larger than their base coordinates. */
export const CUP_SCALE = 1.2;

const SHAPE_HEIGHT: Record<Shape, number> = { teacup: 46, mug: 58, bowl: 38 };

function bodyPath(shape: Shape) {
  switch (shape) {
    case "teacup":
      return "M-36 -46 L36 -46 C34 -18 24 0 12 0 L-12 0 C-24 0 -34 -18 -36 -46Z";
    case "mug":
      return "M-29 -58 L29 -58 L28 -5 C28 -2 26 0 23 0 L-23 0 C-26 0 -28 -2 -28 -5Z";
    case "bowl":
      return "M-44 -38 L44 -38 C42 -14 26 -2 12 -2 L-12 -2 C-26 -2 -42 -14 -44 -38Z";
  }
}

function handlePath(shape: Shape) {
  if (shape === "teacup") return "M31 -38 C50 -40 52 -16 26 -14";
  if (shape === "mug") return "M28 -48 C48 -48 50 -16 28 -16";
  return null;
}

/** Draws one decorative pattern, centred on the cup's belly. */
function PatternArt({ d, h }: { d: CupDesign; h: number }) {
  const mid = -h / 2;
  const a = d.a;
  const b = d.b ?? C.green;
  switch (d.pattern) {
    case "flower":
      return (
        <g>
          <ellipse cx={-20} cy={mid + 6} rx={9} ry={4} fill={b} transform={`rotate(-30 -20 ${mid + 6})`} />
          <ellipse cx={20} cy={mid - 4} rx={9} ry={4} fill={b} transform={`rotate(-30 20 ${mid - 4})`} />
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx={0} cy={mid - 10} rx={2.6} ry={8} fill={a} transform={`rotate(${i * 30} 0 ${mid})`} />
          ))}
          <circle cx={0} cy={mid} r={5} fill={C.navy} />
          <circle cx={0} cy={mid} r={2} fill={C.white} />
        </g>
      );
    case "leaves":
      return (
        <g fill={a}>
          <rect x={-50} y={-h} width={100} height={5} />
          {Array.from({ length: 8 }, (_, i) => {
            const x = -42 + i * 12;
            const top = -h + 7;
            return <path key={i} d={`M${x} ${top} C${x - 6} ${top + 8} ${x - 4} ${top + 16} ${x} ${top + 21} C${x + 4} ${top + 16} ${x + 6} ${top + 8} ${x} ${top}Z`} />;
          })}
        </g>
      );
    case "cherries":
      return (
        <g>
          {[
            [-16, -40], [10, -46], [-4, -24], [18, -18], [-22, -12],
          ].map(([x, y], i) => (
            <g key={i}>
              <path d={`M${x - 3} ${y} Q${x} ${y - 11} ${x + 4} ${y - 12} M${x + 4} ${y} Q${x + 4} ${y - 8} ${x + 4} ${y - 12}`} stroke={C.ink} strokeWidth={0.9} fill="none" />
              <ellipse cx={x + 7} cy={y - 12} rx={3.2} ry={1.6} fill={b} />
              <circle cx={x - 3} cy={y} r={3.6} fill={a} />
              <circle cx={x + 4} cy={y + 1} r={3.6} fill={a} />
            </g>
          ))}
        </g>
      );
    case "blueFlowers":
      return (
        <g fill={a}>
          {[
            [-18, mid - 12], [12, mid - 14], [-4, mid + 6], [24, mid + 8], [-28, mid + 10],
          ].map(([x, y], i) => (
            <g key={i}>
              {[0, 90, 180, 270].map((r) => (
                <ellipse key={r} cx={x} cy={y - 5} rx={3.4} ry={5} transform={`rotate(${r + 45} ${x} ${y})`} />
              ))}
              <circle cx={x} cy={y} r={1.6} fill={C.white} />
            </g>
          ))}
        </g>
      );
    case "dots":
      return (
        <g fill={a}>
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 9 }, (_, col) => (
              <circle key={`${row}-${col}`} cx={-44 + col * 11 + (row % 2) * 5.5} cy={-32 + row * 9} r={3.2} />
            )),
          )}
        </g>
      );
    case "sunflower":
      return (
        <g>
          <path d={`M4 ${mid + 4} Q-6 ${mid + 16} -14 ${mid + 26}`} stroke={C.green} strokeWidth={2} fill="none" />
          <ellipse cx={-12} cy={mid + 18} rx={7} ry={3} fill={C.green} transform={`rotate(-40 -12 ${mid + 18})`} />
          {Array.from({ length: 10 }, (_, i) => (
            <ellipse key={i} cx={4} cy={mid - 12} rx={3.2} ry={8} fill={a} stroke={C.ink} strokeWidth={0.6} transform={`rotate(${i * 36} 4 ${mid - 4})`} />
          ))}
          <circle cx={4} cy={mid - 4} r={5} fill={C.gold} stroke={b} strokeWidth={2} />
        </g>
      );
    case "hearts":
      return (
        <g fill={a}>
          {[-24, 0, 24].map((x) => (
            <path key={x} d={`M${x} ${mid + 8} C${x - 12} ${mid} ${x - 9} ${mid - 9} ${x} ${mid - 4} C${x + 9} ${mid - 9} ${x + 12} ${mid} ${x} ${mid + 8}Z`} />
          ))}
        </g>
      );
    case "bigFlower":
      return (
        <g>
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx={0} cy={mid - 13} rx={6} ry={11} fill={a} stroke={C.ink} strokeWidth={0.8} transform={`rotate(${i * 30} 0 ${mid})`} />
          ))}
          <circle cx={0} cy={mid} r={8} fill={C.ink} />
          <circle cx={0} cy={mid} r={4.5} fill={C.gold} />
          <circle cx={0} cy={mid} r={1.6} fill={C.ink} />
        </g>
      );
    case "spikes":
      return (
        <g fill={a}>
          {Array.from({ length: 10 }, (_, i) => {
            const x = -40 + i * 8.5;
            return <path key={i} d={`M${x - 3.5} ${-h} L${x + 3.5} ${-h} L${x} ${-8}Z`} />;
          })}
        </g>
      );
    case "plums":
      return (
        <g>
          {[-16, 16].map((x, i) => (
            <g key={x}>
              <path d={`M${x} ${mid - 8} q2 -6 6 -8`} stroke={C.ink} strokeWidth={1} fill="none" />
              <ellipse cx={x + 8} cy={mid - 14} rx={5} ry={2.4} fill={b} transform={`rotate(-20 ${x + 8} ${mid - 14})`} />
              <ellipse cx={x} cy={mid + 2} rx={9} ry={10} fill={i ? C.sky : a} />
            </g>
          ))}
        </g>
      );
    case "stripes":
      return (
        <g fill={a}>
          {Array.from({ length: 7 }, (_, i) => (
            <rect key={i} x={-45 + i * 14} y={-h} width={7} height={h} />
          ))}
        </g>
      );
    case "rings":
      return (
        <g>
          {[-24, 0, 24].map((x) => (
            <g key={x}>
              <circle cx={x} cy={mid} r={9} fill={a} />
              <circle cx={x} cy={mid} r={5} fill="none" stroke={C.ink} strokeWidth={1.4} />
            </g>
          ))}
        </g>
      );
  }
}

/**
 * One cup. `memo` means React only redraws the artwork when the design
 * changes — while falling, only the outer position transform changes.
 */
export const CupArt = memo(function CupArt({ id, design }: { id: number; design: CupDesign }) {
  const h = SHAPE_HEIGHT[design.shape];
  const body = bodyPath(design.shape);
  const handle = handlePath(design.shape);
  const clipId = `cup-clip-${id}`;
  return (
    <g transform={`scale(${CUP_SCALE})`}>
      {design.saucer && (
        <path d="M-46 -4 L46 -4 C44 1 36 4 26 4 L-26 4 C-36 4 -44 1 -46 -4Z" fill={design.saucer} stroke={design.saucer === C.white ? "#e2dccf" : "none"} strokeWidth={1} />
      )}
      {handle && <path d={handle} stroke={design.body === C.white ? "#e9e3d6" : design.body} strokeWidth={6} fill="none" strokeLinecap="round" />}
      {design.shape === "bowl" && <rect x={-14} y={-4} width={28} height={5} rx={1.5} fill={design.body === C.white ? "#e9e3d6" : design.body} />}
      <clipPath id={clipId}>
        <path d={body} />
      </clipPath>
      <path d={body} fill={design.body} />
      <g clipPath={`url(#${clipId})`}>
        <PatternArt d={design} h={h} />
      </g>
      {/* soft shading on the right side, like the flat print style */}
      <path d={body} fill="none" stroke="rgba(43,39,37,0.08)" strokeWidth={1.2} />
    </g>
  );
});

/** Colours used for broken pieces. */
export function shardColors(d: CupDesign) {
  return [d.body, d.a, d.b ?? d.a, d.body === C.white ? "#ece6d8" : C.white];
}

export function cupHeight(d: CupDesign) {
  return SHAPE_HEIGHT[d.shape];
}

/* ---------- Background: mint wall with dotty trees ---------- */

export const Backdrop = memo(function Backdrop({ w, h, floorY }: { w: number; h: number; floorY: number }) {
  const rand = seeded(42);
  // Round to 1 decimal so server and browser produce identical numbers
  // (tiny floating-point differences would cause a hydration warning).
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const trees: ReactNode[] = [];
  for (let t = 0; t < 8; t++) {
    const tx = (t % 4) * 170 + 30 + rand() * 60;
    const ty = Math.floor(t / 4) * 380 + 150 + rand() * 80;
    const dots: ReactNode[] = [];
    for (let i = 0; i < 70; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * 62;
      dots.push(<circle key={`d${i}`} cx={r1(tx + Math.cos(ang) * rad)} cy={r1(ty + Math.sin(ang) * rad * 0.85)} r={r1(2 + rand() * 3.5)} fill="#c7ece2" />);
    }
    for (let i = 0; i < 7; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * 58;
      dots.push(<circle key={`p${i}`} cx={r1(tx + Math.cos(ang) * rad)} cy={r1(ty + Math.sin(ang) * rad * 0.85)} r={3.2} fill="#f3b48f" />);
    }
    trees.push(
      <g key={t}>
        <path d={`M${r1(tx)} ${r1(ty + 150)} L${r1(tx)} ${r1(ty)} M${r1(tx)} ${r1(ty + 40)} L${r1(tx - 26)} ${r1(ty + 10)} M${r1(tx)} ${r1(ty + 70)} L${r1(tx + 30)} ${r1(ty + 36)}`} stroke="#c7ece2" strokeWidth={3} strokeLinecap="round" />
        {dots}
      </g>,
    );
  }
  return (
    <g>
      <rect width={w} height={h} fill={C.mint} />
      {trees}
      {/* floor */}
      <rect y={floorY} width={w} height={h - floorY} fill="#f4e1c6" />
      <rect y={floorY} width={w} height={4} fill={C.woodDark} opacity={0.5} />
      {Array.from({ length: 6 }, (_, i) => (
        <line key={i} x1={i * 110 + 40} y1={floorY + 10} x2={i * 110 + 40} y2={h} stroke="#e6cca9" strokeWidth={2} />
      ))}
    </g>
  );
});

/** A wooden shelf plank. y = the top surface the cups stand on. */
export function Shelf({ y, x0, x1 }: { y: number; x0: number; x1: number }) {
  return (
    <g>
      <rect x={x0} y={y} width={x1 - x0} height={13} rx={2} fill={C.wood} />
      <rect x={x0} y={y + 10} width={x1 - x0} height={3} fill={C.woodDark} opacity={0.6} />
      <rect x={x0} y={y + 13} width={x1 - x0} height={6} fill="rgba(43,39,37,0.08)" />
    </g>
  );
}

/* ---------- The cat (ginger tabby, poster style, facing right) ---------- */

function headD(cx: number, cy: number, s = 1) {
  const p = (x: number, y: number) => `${cx + x * s} ${cy + y * s}`;
  return `M${p(-32, 4)} C${p(-34, -14)} ${p(-32, -28)} ${p(-28, -42)} L${p(-10, -26)} C${p(-3, -28)} ${p(5, -28)} ${p(12, -26)} L${p(30, -42)} C${p(34, -28)} ${p(36, -12)} ${p(33, 4)} C${p(30, 24)} ${p(14, 32)} ${p(0, 32)} C${p(-16, 32)} ${p(-30, 22)} ${p(-32, 4)}Z`;
}

export type CatPose = "walk" | "stand" | "jump" | "happy";

export function CatSprite({ pose }: { pose: CatPose }) {
  const leg = (x: number, cls: string, fill: string) => (
    <g className={cls} style={pivot(x + 5, -28)}>
      <rect x={x} y={-32} width={11} height={32} rx={5.5} fill={fill} />
      <path d={`M${x + 3.5} 0 v-3.5 M${x + 7.5} 0 v-3.5`} stroke={C.ink} strokeWidth={0.9} />
    </g>
  );
  const s = 0.72;
  const hx = 44;
  const hy = -66;
  return (
    <g className={`${styles.cat} ${styles[`pose_${pose}`]}`}>
      <g className={styles.catTail} style={pivot(-40, -46)}>
        <path d="M-40 -46 C-62 -50 -72 -76 -60 -98" stroke={C.orange} strokeWidth={9} fill="none" strokeLinecap="round" />
        <path d="M-58 -58 l-7 3 M-64 -74 l-7 0 M-63 -88 l-7 -2" stroke={C.orangeDark} strokeWidth={2.4} strokeLinecap="round" />
      </g>
      {leg(-38, styles.legB, "#e27a31")}
      {leg(20, styles.legA, "#e27a31")}
      <path d="M-46 -40 C-46 -60 -24 -64 0 -62 L30 -60 C48 -58 52 -40 46 -28 C42 -20 30 -20 22 -22 L-32 -22 C-44 -22 -46 -30 -46 -40Z" fill={C.orange} />
      <path d="M-26 -61 C-24 -52 -24 -44 -27 -36 M-12 -62 C-10 -52 -10 -44 -13 -36 M2 -62 C4 -52 4 -44 1 -36" stroke={C.orangeDark} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {leg(-26, styles.legA, C.orange)}
      {leg(32, styles.legB, C.orange)}
      <g className={styles.catHead} style={pivot(hx, hy + 20)}>
        <path d={headD(hx, hy, s)} fill={C.orange} />
        <path d={`M${hx - 20} ${hy - 26} L${hx - 12} ${hy - 20} L${hx - 19} ${hy - 16}Z`} fill="#f7b27a" />
        <path d={`M${hx - 5} ${hy - 20} l1 5 M${hx} ${hy - 21} l0 6 M${hx + 5} ${hy - 20} l-1 5`} stroke={C.orangeDark} strokeWidth={2} strokeLinecap="round" />
        {pose === "happy" ? (
          <path d={`M${hx - 13} ${hy + 1} q4 -5 8 0 M${hx + 5} ${hy + 1} q4 -5 8 0`} stroke={C.ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        ) : (
          <g className={styles.catEyes}>
            {[-9, 9].map((dx) => (
              <g key={dx} transform={`translate(${hx + dx} ${hy + 1})`}>
                <path d="M-5 0 Q0 -4.4 5 0 Q0 4.4 -5 0Z" fill={C.white} stroke={C.ink} strokeWidth={0.9} />
                <ellipse rx={1} ry={2.8} fill={C.ink} />
              </g>
            ))}
          </g>
        )}
        <path d={`M${hx - 2} ${hy + 7} h4 l-2 2.5Z`} fill="#e98a86" />
        {pose === "happy" ? (
          <path d={`M${hx - 5} ${hy + 10} q5 7 10 0Z`} fill="#c94f4f" />
        ) : (
          <path d={`M${hx} ${hy + 9.5} q-2 3 -4 1.5 M${hx} ${hy + 9.5} q2 3 4 1.5`} stroke={C.ink} strokeWidth={0.9} fill="none" />
        )}
        {[-1, 1].map((d) =>
          [0, 1, 2].map((i) => (
            <line key={`${d}${i}`} x1={hx + d * 8} y1={hy + 9 + i * 2} x2={hx + d * 23} y2={hy + 5 + i * 4.5} stroke={C.ink} strokeWidth={0.7} />
          )),
        )}
      </g>
    </g>
  );
}

/* ---------- The hand cursor ---------- */

/**
 * The hand is split in two layers so a caught cup can sit *inside* it:
 * fingers (behind the cup) and palm + thumb + sleeve (in front of the cup).
 * The pointer position is the middle of the palm's top edge, at (0, 0).
 */
export function HandBack() {
  return (
    <g>
      {[-31, -15, 1, 17].map((x, i) => (
        <rect key={x} x={x} y={-30 + (i === 0 || i === 3 ? 5 : 0)} width={15} height={34} rx={7.5} fill={C.peachDark} stroke={C.ink} strokeWidth={1.6} transform={`rotate(${(i - 1.5) * 6} ${x + 7} 4)`} />
      ))}
    </g>
  );
}

export function HandFront() {
  return (
    <g>
      {/* sleeve */}
      <rect x={-17} y={40} width={34} height={60} fill={C.yellow} stroke={C.ink} strokeWidth={1.6} />
      <rect x={-20} y={30} width={40} height={14} rx={3} fill={C.red} stroke={C.ink} strokeWidth={1.6} />
      <path d="M-12 30 v14 M-2 30 v14 M8 30 v14" stroke={C.white} strokeWidth={3} />
      {/* palm, shaped like a little bowl */}
      <path d="M-44 -2 C-44 20 -26 36 0 36 C26 36 44 20 44 -2 C28 6 -28 6 -44 -2Z" fill={C.peach} stroke={C.ink} strokeWidth={1.8} strokeLinejoin="round" />
      {/* thumb */}
      <path d="M-40 12 C-52 6 -58 -8 -52 -14 C-46 -18 -40 -8 -34 0" fill={C.peach} stroke={C.ink} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M-18 20 q8 6 18 4 M8 16 q8 2 14 -2" stroke={C.peachDark} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <ellipse cx={24} cy={10} rx={6} ry={3.5} fill="#f4a99a" opacity={0.6} />
    </g>
  );
}
