"use client";

/**
 * Playful cats for the homepage.
 *
 * Each cat is hand-built from simple SVG shapes, based on the illustrated
 * "stay home" cat poster: flat colour shapes, a soft grainy texture, thin dark
 * linework for faces and toes, and almond eyes with slit pupils.
 *
 * How the interaction works:
 * 1. Every cat is wrapped in <Cat>, which renders a real <button> so it can be
 *    clicked, tapped, or reached with the keyboard.
 * 2. Clicking adds the `acting` class for a set amount of time.
 * 3. The CSS module listens for `.acting` and plays that cat's own animation
 *    (walking, rolling, stretching…). When the timer ends, the class is removed
 *    and the cat goes back to idling.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import styles from "./PlayfulCats.module.css";

/* ---------- Palette sampled from the illustration ---------- */
const INK = "#2b2725";
const CREAM = "#f8f2e6";
const LINE = "#d6cbbb";
const BLACK = "#26221f";
const PINK = "#ec8e85";
const PINK_DARK = "#cf6d64";
const ORANGE = "#f0893d";
const ORANGE_DARK = "#cd5f26";
const ORANGE_LIGHT = "#f7b27a";
const YELLOW = "#f3c04a";
const SAGE = "#aaa99d";
const SLATE = "#6d6d71";
const SLATE_DARK = "#58585c";
const RUST = "#b8633a";
const RUST_DARK = "#9a4f2c";
const AMBER = "#f0a04b";
const GOLD = "#f2c230";
const NOSE = "#e98a86";
const YARN = "#c9653f";
const YARN_DARK = "#a14a2a";

/** Grain texture shared by every cat (defined once in <CatDefs />). */
const GRAIN = "url(#catGrain)";

/**
 * Rotating an SVG part needs a pivot point. This helper sets the pivot using
 * coordinates from the SVG's own viewBox, e.g. the base of a tail.
 */
const pivot = (x: number, y: number): CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

/**
 * One reusable cat-head outline (a round face with two pointy ears).
 * cx/cy is the centre of the face; s scales it.
 */
function headD(cx: number, cy: number, s = 1) {
  const p = (x: number, y: number) => `${cx + x * s} ${cy + y * s}`;
  return [
    `M${p(-32, 4)}`,
    `C${p(-34, -14)} ${p(-32, -28)} ${p(-28, -42)}`,
    `L${p(-10, -26)}`,
    `C${p(-3, -28)} ${p(5, -28)} ${p(12, -26)}`,
    `L${p(30, -42)}`,
    `C${p(34, -28)} ${p(36, -12)} ${p(33, 4)}`,
    `C${p(30, 24)} ${p(14, 32)} ${p(0, 32)}`,
    `C${p(-16, 32)} ${p(-30, 22)} ${p(-32, 4)}Z`,
  ].join(" ");
}

type FaceProps = {
  cx: number;
  cy: number;
  s?: number;
  eye?: string;
  ink?: string;
  nose?: string;
  whisker?: string;
  /** open = normal, closed = happy squint, sleepy = can switch between both */
  mood?: "open" | "closed" | "sleepy";
  blush?: boolean;
};

/** Eyes, nose, mouth and whiskers, drawn in the poster's thin-line style. */
function Face({
  cx,
  cy,
  s = 1,
  eye = AMBER,
  ink = INK,
  nose = NOSE,
  whisker = INK,
  mood = "open",
  blush = false,
}: FaceProps) {
  const ey = cy + 2 * s;
  const dx = 13 * s;
  const ny = cy + 11 * s;

  const openEyes = (
    <g className={`${styles.eyes} ${mood === "sleepy" ? styles.eyesOpen : ""}`}>
      {[-1, 1].map((d) => (
        <g key={d} transform={`translate(${cx + d * dx} ${ey}) scale(${s})`}>
          <path d="M-6.5 0 Q0 -5.8 6.5 0 Q0 5.8 -6.5 0Z" fill={eye} stroke={ink} strokeWidth={1.1} />
          <ellipse rx={1.3} ry={3.5} fill={ink} />
        </g>
      ))}
    </g>
  );

  const closedEyes = (
    <g className={mood === "sleepy" ? styles.eyesClosed : undefined}>
      {[-1, 1].map((d) => (
        <path
          key={d}
          d={`M${cx + d * dx - 5.5 * s} ${ey - 1 * s} Q${cx + d * dx} ${ey + 4.5 * s} ${cx + d * dx + 5.5 * s} ${ey - 1 * s}`}
          stroke={ink}
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </g>
  );

  return (
    <g>
      {blush &&
        [-1, 1].map((d) => (
          <ellipse key={d} cx={cx + d * 19 * s} cy={ny} rx={5 * s} ry={3 * s} fill="#f2a79c" opacity={0.75} />
        ))}
      {mood !== "closed" && openEyes}
      {mood !== "open" && closedEyes}
      <path d={`M${cx - 3 * s} ${ny - 1.5 * s} L${cx + 3 * s} ${ny - 1.5 * s} L${cx} ${ny + 2 * s}Z`} fill={nose} />
      <path
        d={`M${cx} ${ny + 2 * s} Q${cx - 2.5 * s} ${ny + 5.5 * s} ${cx - 5 * s} ${ny + 3.5 * s} M${cx} ${ny + 2 * s} Q${cx + 2.5 * s} ${ny + 5.5 * s} ${cx + 5 * s} ${ny + 3.5 * s}`}
        stroke={ink}
        strokeWidth={1.1}
        fill="none"
        strokeLinecap="round"
      />
      {[-1, 1].map((d) =>
        [0, 1, 2].map((i) => (
          <line
            key={`${d}${i}`}
            x1={cx + d * 11 * s}
            y1={ny + (1 + i * 2.5) * s}
            x2={cx + d * 31 * s}
            y2={ny + (-4 + i * 6) * s}
            stroke={whisker}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        )),
      )}
    </g>
  );
}

/** Little toe marks at the end of a paw. */
function Toes({ x, y, n = 2, gap = 4, color = INK, h = 4 }: { x: number; y: number; n?: number; gap?: number; color?: string; h?: number }) {
  return (
    <path
      d={Array.from({ length: n }, (_, i) => `M${x + i * gap} ${y} l0 ${-h}`).join(" ")}
      stroke={color}
      strokeWidth={1}
      strokeLinecap="round"
    />
  );
}

/* ---------- The clickable wrapper ---------- */

type CatProps = {
  /** Short description used by screen readers, e.g. "Black cat". */
  name: string;
  /** What happens on click, e.g. "swish its tail". */
  action: string;
  /** Text shown in the speech bubble while the cat is acting. */
  say: string;
  /** How long the action lasts, in milliseconds (should match the CSS). */
  duration: number;
  /** Class that places this cat on the page (see the CSS module). */
  spot: string;
  viewBox: string;
  /** Offset for the idle blink so the cats don't all blink together. */
  blinkDelay?: number;
  children: ReactNode;
};

function Cat({ name, action, say, duration, spot, viewBox, blinkDelay = 0, children }: CatProps) {
  const [acting, setActing] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Clear the timer if the page is left mid-animation.
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const play = () => {
    if (acting) return; // let the current action finish first
    setActing(true);
    timer.current = window.setTimeout(() => setActing(false), duration);
  };

  return (
    <button
      type="button"
      className={`${styles.cat} ${spot} ${acting ? styles.acting : ""}`}
      onClick={play}
      aria-label={`${name}. Click to make it ${action}.`}
      style={{ "--blink-delay": `${blinkDelay}s` } as CSSProperties}
    >
      <span className={styles.bubble} aria-hidden="true">
        {say}
      </span>
      <svg viewBox={viewBox} className={styles.catArt} aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}

/* ---------- The nine cats ---------- */

/** Tall black cat sitting upright, tail curling up behind it. */
function BlackCat() {
  return (
    <Cat name="Black cat" action="look around and swish its tail" say="mrrp?" duration={1800} spot={styles.spotBlack} viewBox="0 0 200 240" blinkDelay={1}>
      <g className={`${styles.idleTail} ${styles.blackTail}`} style={pivot(80, 214)}>
        <path d="M80 214 C30 214 14 170 22 132 C28 104 44 92 38 70" stroke={BLACK} strokeWidth={11} fill="none" strokeLinecap="round" />
      </g>
      <g filter={GRAIN}>
        <path d="M70 230 C48 196 58 132 96 112 C128 96 164 110 172 150 C180 190 178 214 170 230Z" fill={BLACK} />
      </g>
      <path d="M124 176 C122 196 124 214 125 228 M147 176 C147 196 147 214 147 228" stroke={CREAM} strokeWidth={1.4} fill="none" opacity={0.8} />
      <Toes x={120} y={230} n={2} gap={5} color={CREAM} />
      <Toes x={143} y={230} n={2} gap={5} color={CREAM} />
      <g className={styles.blackHead} style={pivot(126, 104)}>
        <g filter={GRAIN}>
          <path d={headD(126, 74, 1.05)} fill={BLACK} />
        </g>
        <Face cx={126} cy={74} s={1.05} eye={AMBER} whisker={CREAM} ink={BLACK} />
      </g>
    </Cat>
  );
}

/** Calico standing on four legs: white body, black + pink patches. */
function CalicoCat() {
  const leg = (x: number, cls: string) => (
    <g className={cls} style={pivot(x + 7, 112)}>
      <rect x={x} y={106} width={15} height={86} rx={7} fill={CREAM} stroke={LINE} strokeWidth={1.4} />
      <Toes x={x + 5} y={192} n={2} gap={5} color={LINE} />
    </g>
  );
  return (
    <Cat name="Calico cat" action="get up and go for a little walk" say="*pads off*" duration={4000} spot={`${styles.spotCalico} ${styles.walker}`} viewBox="0 0 280 210" blinkDelay={3}>
      <g className={`${styles.idleTail} ${styles.calicoTail}`} style={pivot(226, 92)}>
        <path d="M226 92 C250 88 262 70 262 50 C262 38 268 31 276 30" stroke={PINK} strokeWidth={10} fill="none" strokeLinecap="round" />
        <path d="M265 38 C267 33 271 30 276 30" stroke={BLACK} strokeWidth={10} fill="none" strokeLinecap="round" />
      </g>
      {leg(80, styles.legA)}
      {leg(196, styles.legB)}
      <g filter={GRAIN}>
        <clipPath id="calicoBodyClip">
          <path d="M70 82 C72 60 100 54 130 56 L200 58 C230 60 238 84 232 104 C226 124 204 126 186 124 L100 122 C76 120 68 104 70 82Z" />
        </clipPath>
        <path d="M70 82 C72 60 100 54 130 56 L200 58 C230 60 238 84 232 104 C226 124 204 126 186 124 L100 122 C76 120 68 104 70 82Z" fill={CREAM} />
        <g clipPath="url(#calicoBodyClip)">
          <path d="M138 50 C170 44 214 52 226 76 C214 98 184 100 160 94 C140 88 130 66 138 50Z" fill={PINK} />
          <path d="M200 50 C228 52 240 80 236 110 C222 110 212 96 208 84 C202 74 196 60 200 50Z" fill={BLACK} />
        </g>
      </g>
      {leg(100, styles.legB)}
      {leg(214, styles.legA)}
      <path d="M86 96 C90 104 93 110 93 118" stroke={LINE} strokeWidth={1.4} fill="none" />
      <g className={styles.bob} style={pivot(62, 94)}>
        <g filter={GRAIN}>
          <clipPath id="calicoHeadClip">
            <path d={headD(60, 64, 0.95)} />
          </clipPath>
          <path d={headD(60, 64, 0.95)} fill={CREAM} />
          <g clipPath="url(#calicoHeadClip)">
            <circle cx={90} cy={26} r={20} fill={BLACK} />
            <path d="M36 28 L47 38 L36 44Z" fill={PINK} />
          </g>
        </g>
        <Face cx={60} cy={64} s={0.95} eye={AMBER} />
      </g>
    </Cat>
  );
}

/** Orange tabby lying down with its paws stretched forward. */
function TabbyCat() {
  return (
    <Cat name="Orange tabby cat" action="roll over" say="wheee!" duration={1700} spot={styles.spotTabby} viewBox="0 0 280 175" blinkDelay={4.5}>
      <g className={styles.roller} style={pivot(150, 120)}>
        <g className={`${styles.idleTail} ${styles.tabbyTail}`} style={pivot(236, 146)}>
          <path d="M236 146 C262 150 270 164 250 166 C226 168 214 160 198 164" stroke={ORANGE} strokeWidth={10} fill="none" strokeLinecap="round" />
          <path d="M246 150 l-3 7 M232 160 l-2 7 M216 160 l-1 6" stroke={ORANGE_DARK} strokeWidth={2.5} strokeLinecap="round" />
        </g>
        <g filter={GRAIN}>
          <path d="M60 150 C40 150 36 118 60 104 C90 88 140 86 190 88 C236 90 256 112 250 136 C246 152 226 156 200 154Z" fill={ORANGE} />
          <path d="M66 150 C42 152 24 150 20 142 C18 134 28 132 42 136 L72 138Z" fill={ORANGE} />
        </g>
        <path
          d="M150 92 C156 104 158 118 154 130 M170 90 C178 104 180 120 176 132 M190 92 C198 106 200 120 196 132 M212 96 C220 108 222 122 218 132"
          stroke={ORANGE_DARK}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <path d="M190 152 C176 138 186 118 206 118 C228 118 236 136 226 152" stroke={ORANGE_DARK} strokeWidth={1.8} fill="none" />
        <Toes x={24} y={148} n={2} gap={5} />
        <g>
          <g filter={GRAIN}>
            <path d={headD(80, 76)} fill={ORANGE} />
          </g>
          <path d="M53 40 L66 50 L55 55Z" fill={ORANGE_LIGHT} />
          <path d="M72 48 l2 8 M80 46 l0 9 M88 48 l-2 8" stroke={ORANGE_DARK} strokeWidth={2.5} strokeLinecap="round" />
          <Face cx={80} cy={76} eye={CREAM} />
        </g>
      </g>
    </Cat>
  );
}

/** Cream cat with yellow spots in a play bow, eyes happily shut. */
function StretchCat() {
  const body = "M70 150 C90 128 130 100 170 70 C196 50 236 54 244 90 C252 126 238 160 214 170 C196 176 180 168 170 158 L110 172 C90 176 70 168 70 150Z";
  return (
    <Cat name="Spotted cream cat" action="do a big stretch" say="stretchhh…" duration={2000} spot={styles.spotStretch} viewBox="0 0 280 200" blinkDelay={2}>
      <g className={`${styles.idleTail} ${styles.stretchTail}`} style={pivot(214, 72)}>
        <path d="M214 72 C216 40 200 20 176 18 C160 18 150 26 148 32" stroke={YELLOW} strokeWidth={11} fill="none" strokeLinecap="round" />
      </g>
      <g filter={GRAIN}>
        <path d="M214 170 C220 180 230 186 244 186 C252 186 252 178 244 176 L236 166Z" fill={CREAM} stroke={LINE} strokeWidth={1.2} />
      </g>
      <g className={styles.stretchBody} style={pivot(244, 176)}>
        <g filter={GRAIN}>
          <clipPath id="stretchBodyClip">
            <path d={body} />
          </clipPath>
          <path d={body} fill={CREAM} />
          <g clipPath="url(#stretchBodyClip)" fill={YELLOW}>
            <path d="M180 60 C200 50 222 60 220 80 C218 98 196 100 184 90 C172 80 170 66 180 60Z" />
            <path d="M226 100 C240 100 250 118 244 136 C236 146 222 138 220 124 C218 112 218 102 226 100Z" />
            <path d="M150 110 C164 104 176 118 170 132 C162 142 146 136 144 124 C142 116 144 112 150 110Z" />
            <path d="M200 146 C212 142 222 154 216 164 C208 170 196 166 196 158Z" />
          </g>
          <path d="M100 160 C70 170 40 176 22 176 C14 176 14 186 24 186 C50 186 80 184 110 178Z" fill={CREAM} stroke={LINE} strokeWidth={1.2} />
        </g>
        <Toes x={20} y={186} n={2} gap={4} />
      </g>
      <g className={styles.stretchHead}>
        <g filter={GRAIN}>
          <clipPath id="stretchHeadClip">
            <path d={headD(62, 142)} />
          </clipPath>
          <path d={headD(62, 142)} fill={CREAM} />
          <g clipPath="url(#stretchHeadClip)" fill={YELLOW}>
            <path d="M50 110 C58 106 70 106 76 110 C72 124 66 130 62 132 C58 126 52 120 50 110Z" />
            <path d="M84 96 L100 96 L96 118 C90 114 86 106 84 96Z" />
          </g>
        </g>
        <Face cx={62} cy={142} mood="closed" />
      </g>
    </Cat>
  );
}

/** Grey-and-white cat sitting up, batting at a dangling ball of yarn. */
function YarnCat() {
  return (
    <Cat name="Grey cat with a ball of yarn" action="play with the yarn" say="got it!" duration={1800} spot={styles.spotYarn} viewBox="0 0 250 270" blinkDelay={5}>
      <g className={styles.yarn} style={pivot(186, 0)}>
        <path d="M186 0 L186 58" stroke={YARN} strokeWidth={1.6} />
        <g transform="translate(186 78)">
          <circle r={21} fill={YARN} filter={GRAIN} />
          <path
            d="M-15 -9 C-4 -15 8 -13 17 -5 M-19 2 C-6 -4 8 -2 19 6 M-13 13 C-2 9 8 11 14 15 M-4 -20 C4 -7 6 6 2 20"
            stroke={YARN_DARK}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          />
        </g>
      </g>
      <g className={`${styles.idleTail} ${styles.yarnTail}`} style={pivot(150, 244)}>
        <path d="M150 244 C190 248 222 240 234 218 C240 208 238 200 232 196" stroke={SAGE} strokeWidth={11} fill="none" strokeLinecap="round" />
        <path d="M237 207 C239 203 237 199 232 196" stroke={CREAM} strokeWidth={11} fill="none" strokeLinecap="round" />
      </g>
      <g filter={GRAIN}>
        <clipPath id="yarnBodyClip">
          <path d="M60 254 C44 214 50 154 80 122 C104 100 140 108 150 144 C162 184 166 226 150 256Z" />
        </clipPath>
        <path d="M60 254 C44 214 50 154 80 122 C104 100 140 108 150 144 C162 184 166 226 150 256Z" fill={SAGE} />
        <path clipPath="url(#yarnBodyClip)" d="M92 144 C110 136 132 150 136 184 C140 218 126 244 108 248 C90 244 82 214 84 184 C84 164 86 150 92 144Z" fill={CREAM} />
        <ellipse cx={56} cy={255} rx={22} ry={7} fill={SAGE} />
        <ellipse cx={124} cy={256} rx={13} ry={6} fill={CREAM} />
      </g>
      <path d="M116 214 L119 252" stroke={LINE} strokeWidth={1.4} />
      <Toes x={120} y={258} n={2} gap={5} />
      <g className={styles.paw} style={pivot(120, 136)}>
        <g filter={GRAIN}>
          <path d="M112 140 C118 116 128 96 140 76 C145 68 156 70 153 80 C146 102 136 122 130 146Z" fill={SAGE} />
          <ellipse cx={147} cy={74} rx={8} ry={7} fill={CREAM} />
        </g>
        <circle cx={145} cy={72} r={1.8} fill={NOSE} />
        <circle cx={150} cy={75} r={1.8} fill={NOSE} />
      </g>
      <g className={styles.yarnHead} style={pivot(92, 118)}>
        <g transform="rotate(-14 92 94)">
          <g filter={GRAIN}>
            <clipPath id="yarnHeadClip">
              <path d={headD(92, 94)} />
            </clipPath>
            <path d={headD(92, 94)} fill={SAGE} />
            <ellipse clipPath="url(#yarnHeadClip)" cx={92} cy={124} rx={16} ry={12} fill={CREAM} />
          </g>
          <Face cx={92} cy={94} eye={GOLD} />
        </g>
      </g>
    </Cat>
  );
}

/** Rust-brown cat lying like a loaf, ready for a nap. */
function LoafCat() {
  return (
    <Cat name="Brown cat lying down" action="take a quick nap" say="zzz…" duration={3200} spot={styles.spotLoaf} viewBox="0 0 290 160" blinkDelay={0.5}>
      <g className={styles.breathe} style={pivot(140, 152)}>
        <g filter={GRAIN}>
          <path d="M30 150 C14 150 12 118 34 106 C70 88 140 84 190 86 C222 88 240 104 244 130 L250 150Z" fill={RUST} />
          <path d="M200 150 C230 152 262 150 272 144 C278 138 270 132 258 134 L220 138Z" fill={RUST} />
        </g>
        <path d="M160 150 C146 136 156 112 182 112" stroke={RUST_DARK} strokeWidth={1.8} fill="none" />
        <Toes x={266} y={146} n={2} gap={4} />
      </g>
      <g className={`${styles.idleTail} ${styles.loafTail}`} style={pivot(40, 148)}>
        <path d="M40 143 C80 151 150 151 198 145" stroke={RUST_DARK} strokeWidth={8} fill="none" strokeLinecap="round" />
      </g>
      <g className={styles.loafHead} style={pivot(212, 108)}>
        <g filter={GRAIN}>
          <path d={headD(212, 76)} fill={RUST} />
        </g>
        <Face cx={212} cy={76} eye={GOLD} nose={INK} mood="sleepy" />
      </g>
      <g className={styles.zzz} fontSize={18} fill={INK}>
        <text className={styles.z} x={244} y={36}>z</text>
        <text className={styles.z} x={256} y={20} fontSize={22}>z</text>
        <text className={styles.z} x={270} y={4} fontSize={26}>Z</text>
      </g>
    </Cat>
  );
}

/** White cat with black patches, lounging on its back with paws up. */
function BackCat() {
  const body = "M50 90 C40 130 60 190 110 214 C150 232 196 216 206 184 C214 156 190 130 160 118 C130 104 110 90 100 76Z";
  return (
    <Cat name="White cat with black patches" action="wiggle around on its back" say="belly rubs?" duration={1800} spot={styles.spotBack} viewBox="0 0 250 250" blinkDelay={2.5}>
      <g className={styles.rolly} style={pivot(130, 170)}>
        <g className={`${styles.idleTail} ${styles.backTail}`} style={pivot(112, 214)}>
          <path d="M112 214 C70 226 30 232 26 212 C24 200 34 196 42 200" stroke={BLACK} strokeWidth={10} fill="none" strokeLinecap="round" />
        </g>
        <g className={styles.kickB} style={pivot(176, 190)}>
          <g filter={GRAIN}>
            <path d="M170 186 C184 206 200 226 216 236 C226 242 232 232 222 226 C206 214 196 196 190 180Z" fill={CREAM} stroke={LINE} strokeWidth={1.2} />
            <path d="M212 232 C218 238 230 238 224 227 C220 226 214 228 212 232Z" fill={BLACK} />
          </g>
        </g>
        <g filter={GRAIN}>
          <clipPath id="backBodyClip">
            <path d={body} />
          </clipPath>
          <path d={body} fill={CREAM} />
          <g clipPath="url(#backBodyClip)" fill={BLACK}>
            <path d="M44 92 C60 86 78 96 76 114 C72 128 54 126 46 114Z" />
            <path d="M150 204 C170 198 200 196 208 180 C212 206 190 226 160 224 C148 216 144 208 150 204Z" />
          </g>
        </g>
        <path d="M150 190 C130 180 128 156 150 148" stroke={LINE} strokeWidth={1.4} fill="none" />
        <g className={styles.kickA} style={pivot(116, 130)}>
          <g filter={GRAIN}>
            <path d="M110 124 C130 112 150 98 168 86 C178 80 188 90 180 98 C162 112 142 126 122 140Z" fill={CREAM} stroke={LINE} strokeWidth={1.2} />
            <path d="M168 86 C178 80 188 90 180 98 C174 98 168 92 168 86Z" fill={BLACK} />
          </g>
        </g>
        <g className={styles.backHead} style={pivot(78, 92)}>
          <g filter={GRAIN}>
            <clipPath id="backHeadClip">
              <path d={headD(78, 62)} />
            </clipPath>
            <path d={headD(78, 62)} fill={CREAM} />
            <g clipPath="url(#backHeadClip)" fill={BLACK}>
              <path d="M50 18 L68 36 C58 40 50 46 46 58 C44 42 46 30 50 18Z" />
              <circle cx={104} cy={24} r={9} />
            </g>
          </g>
          <Face cx={78} cy={62} eye={AMBER} blush />
        </g>
      </g>
    </Cat>
  );
}

/** Dark grey cat perched on a little stack of books. */
function BookCat() {
  return (
    <Cat name="Dark grey cat on books" action="hop up in the air" say="hop!" duration={1300} spot={styles.spotBooks} viewBox="0 0 220 262" blinkDelay={3.5}>
      <g className={styles.books} style={pivot(115, 252)}>
        <rect x={40} y={228} width={150} height={24} rx={4} fill={PINK} filter={GRAIN} />
        <path d="M40 234 H190 M40 246 H190" stroke={PINK_DARK} strokeWidth={1.2} />
        <rect x={86} y={236} width={50} height={8} rx={2} fill={GOLD} />
        <rect x={48} y={206} width={134} height={22} rx={4} fill={CREAM} filter={GRAIN} />
        <path d="M150 206 V228" stroke={LINE} strokeWidth={1.4} />
        <path d="M84 218 c3 -6 6 6 9 0 s6 6 9 0 s6 6 9 0 s6 6 9 0" stroke={YARN} strokeWidth={1.3} fill="none" />
      </g>
      <g className={styles.hopper} style={pivot(115, 206)}>
        <g className={`${styles.idleTail} ${styles.bookTail}`} style={pivot(92, 202)}>
          <path d="M92 202 C62 204 32 202 22 194 C16 188 24 184 32 188" stroke={SLATE} strokeWidth={11} fill="none" strokeLinecap="round" />
        </g>
        <g filter={GRAIN}>
          <path d="M70 206 C56 170 70 120 110 106 C146 96 168 130 172 170 C174 190 168 204 160 206Z" fill={SLATE} />
        </g>
        <path d="M142 150 C112 156 106 190 122 204" stroke={SLATE_DARK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <g className={styles.bookHead} style={pivot(112, 110)}>
          <g filter={GRAIN}>
            <path d={headD(112, 80)} fill={SLATE} />
          </g>
          <Face cx={112} cy={80} eye={AMBER} nose={INK} />
        </g>
      </g>
    </Cat>
  );
}

/** Pink cat with black spots, back arched, striped tail up. */
function ArchCat() {
  const body = "M52 130 C56 80 100 44 140 46 C180 48 206 90 206 140 C206 160 196 164 186 160 C180 120 160 100 130 100 C100 100 84 120 80 150 C70 156 52 150 52 130Z";
  const leg = (x: number) => (
    <g>
      <rect x={x} y={130} width={14} height={92} rx={7} fill={PINK} stroke={PINK_DARK} strokeWidth={1.2} />
      <Toes x={x + 4} y={222} n={2} gap={5} />
    </g>
  );
  return (
    <Cat name="Pink spotted cat" action="puff up and bounce" say="hsss… jk!" duration={1500} spot={styles.spotArch} viewBox="0 0 240 236" blinkDelay={4}>
      <g className={styles.puffer} style={pivot(130, 224)}>
        <g className={`${styles.idleTail} ${styles.archTail}`} style={pivot(196, 120)}>
          <path d="M196 120 C214 96 216 60 204 40 C196 26 200 12 214 10" stroke={PINK} strokeWidth={10} fill="none" strokeLinecap="round" />
          <path d="M196 120 C214 96 216 60 204 40 C196 26 200 12 214 10" stroke={BLACK} strokeWidth={10} fill="none" strokeDasharray="9 11" />
        </g>
        {leg(60)}
        {leg(178)}
        <g filter={GRAIN}>
          <clipPath id="archBodyClip">
            <path d={body} />
          </clipPath>
          <path d={body} fill={PINK} />
          <g clipPath="url(#archBodyClip)" fill={BLACK}>
            <circle cx={128} cy={62} r={14} />
            <circle cx={172} cy={80} r={12} />
            <circle cx={96} cy={78} r={10} />
            <circle cx={196} cy={124} r={10} />
            <circle cx={72} cy={112} r={8} />
          </g>
        </g>
        {leg(78)}
        {leg(194)}
        <g className={styles.archHead} style={pivot(56, 160)}>
          <g filter={GRAIN}>
            <clipPath id="archHeadClip">
              <path d={headD(56, 132)} />
            </clipPath>
            <path d={headD(56, 132)} fill={PINK} />
            <circle clipPath="url(#archHeadClip)" cx={84} cy={98} r={10} fill={BLACK} />
          </g>
          <Face cx={56} cy={132} eye={CREAM} nose={INK} />
        </g>
      </g>
    </Cat>
  );
}

/** The little grey mouse from the poster. It scurries away when clicked. */
function Mouse() {
  return (
    <Cat name="Tiny grey mouse" action="scurry away" say="eek!" duration={2200} spot={`${styles.spotMouse} ${styles.mouse}`} viewBox="0 0 90 44">
      <path className={styles.mouseTail} d="M70 30 C80 26 82 14 90 10" stroke={SAGE} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <path d="M8 32 C12 18 30 12 50 16 C66 18 74 26 70 34Z" fill={SAGE} filter={GRAIN} />
      <circle cx={30} cy={16} r={6} fill={SAGE} />
      <circle cx={30} cy={16} r={3} fill={NOSE} />
      <circle cx={18} cy={26} r={1.6} fill={INK} />
      <circle cx={8} cy={31} r={1.8} fill={NOSE} />
    </Cat>
  );
}

/* ---------- Decorations (not clickable) ---------- */

function Plant({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 100 150" className={`${styles.decor} ${className}`} aria-hidden="true">
      <g className={styles.sway} style={pivot(50, 96)}>
        <path d="M50 96 C48 70 50 40 52 8 M50 80 C38 66 26 60 14 58 M51 70 C62 56 76 50 88 48 M50 52 C40 42 32 34 26 24 M52 40 C60 32 68 26 78 20" stroke={PINK} strokeWidth={2} fill="none" strokeLinecap="round" />
        {[
          [52, 8, 0], [14, 58, -60], [88, 48, 60], [26, 24, -40], [78, 20, 40],
          [34, 66, -70], [70, 56, 70], [38, 40, -50], [64, 30, 50], [51, 24, 0],
        ].map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx={4} ry={9} transform={`rotate(${r} ${x} ${y})`} fill={PINK} />
        ))}
      </g>
      <path d="M24 94 H76 L70 146 H30Z" fill={YELLOW} filter={GRAIN} />
      <path d="M34 98 L37 142 M44 98 L45 142 M54 98 L54 142 M64 98 L62 142" stroke="#e0a42e" strokeWidth={2} />
    </svg>
  );
}

function Leaf({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 90 130" className={`${styles.decor} ${className}`} aria-hidden="true">
      <g className={styles.sway} style={pivot(60, 128)}>
        <path d="M60 128 C54 90 40 50 20 10" stroke={ORANGE} strokeWidth={2} fill="none" />
        {[[26, 22], [34, 40], [40, 58], [46, 76], [52, 94]].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x - 14} cy={y + 4} rx={12} ry={4} transform={`rotate(-30 ${x - 14} ${y + 4})`} fill={ORANGE_LIGHT} />
            <ellipse cx={x + 14} cy={y - 2} rx={12} ry={4} transform={`rotate(-50 ${x + 14} ${y - 2})`} fill={ORANGE_LIGHT} />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* ---------- Exports used by the homepage ---------- */

/**
 * Shared SVG definitions. The grain filter sprinkles tiny light and dark
 * specks over the fur so it looks printed, like the original illustration.
 */
export function CatDefs() {
  return (
    <svg width="0" height="0" className={styles.defs} aria-hidden="true" focusable="false">
      <filter id="catGrain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.8 0 0 0 -0.42" result="dark" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0.8 0 0 -0.42" result="light" />
        <feMerge result="specks">
          <feMergeNode in="dark" />
          <feMergeNode in="light" />
        </feMerge>
        <feComposite in="specks" in2="SourceAlpha" operator="in" result="clipped" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="clipped" />
        </feMerge>
      </filter>
    </svg>
  );
}

/**
 * The cats are split into two groups. On small screens each group shows up
 * as a row of cats (above and below the cards). On wide screens the groups
 * "dissolve" (display: contents) and every cat is placed around the page.
 */
export function TopCats() {
  return (
    <div className={styles.cluster}>
      <BlackCat />
      <CalicoCat />
      <TabbyCat />
      <StretchCat />
      <Mouse />
      <Plant className={styles.spotPlant} />
    </div>
  );
}

export function BottomCats() {
  return (
    <div className={styles.cluster}>
      <YarnCat />
      <LoafCat />
      <BookCat />
      <BackCat />
      <ArchCat />
      <Leaf className={styles.spotLeaf} />
    </div>
  );
}
