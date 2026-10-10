/**
 * Artwork for Weather Cat.
 *
 * Two things are drawn here, both with plain SVG shapes (no image files):
 *
 *   <WeatherScene>  the big picture: the sky, the weather and the orange tabby.
 *   <WeatherIcon>   the small symbols used in the hourly and daily forecast.
 *
 * This file only DRAWS. The decisions (how many clouds, how hard the wind
 * blows, what colour the sky is) are made in `scene.ts` and arrive here as
 * one `SceneSettings` object.
 *
 * How the scene is layered (SVG paints in order, so later = on top):
 *   sky → stars → sun or moon → rain or snow → clouds → ground → cat → props
 */

import type { CSSProperties, ReactNode } from "react";
import { GrainFilter } from "../../components/playful-cats/PlayfulCats";
import { SCENE_H as H, SCENE_W as W, type SceneSettings } from "./scene";
import { MOOD_NAME, type Mood } from "./weather";
import styles from "./styles.module.css";

/* ---------- Palette (the same warm colours as the homepage cats) ---------- */
const INK = "#2b2725";
const CREAM = "#fffaf2";
const PINK = "#ec8e85";
const PINK_DARK = "#cf6d64";
const YELLOW = "#f3c04a";
const MOONLIGHT = "#f6e7b4";
const ORANGE = "#f0893d";
const ORANGE_DARK = "#cd5f26";
const ORANGE_LIGHT = "#f7b27a";
const NOSE = "#e98a86";
const EYE = "#f8f2e6";

/** The speckled "printed" texture on the cat's fur (the filter itself comes from <GrainFilter />). */
const GRAIN = "url(#catGrain)";
/** The sky's colour blend, defined once in the scene and reused by anything that must match it. */
const SKY = "url(#weatherCatSky)";

/* ---------- Scene measurements ---------- */

/** The cat is drawn on its own 280 × 175 grid. We slide it to here inside the scene. */
const CAT_X = 40;
const CAT_Y = 72;

/** Where the cat's eyes end up after that slide (they sit at 67,78 and 93,78 on the cat's grid). */
const EYE_L = CAT_X + 67;
const EYE_R = CAT_X + 93;
const EYE_Y = CAT_Y + 78;

/** Describes the picture in words for people using a screen reader. */
const SCENE_DESCRIPTION: Record<Mood, string> = {
  clearDay: "wearing sunglasses in the sunshine",
  clearNight: "asleep in a sleep mask under the night sky",
  clouds: "lying under passing clouds",
  rain: "sheltering under a pink umbrella in the rain",
  storm: "sheltering under an umbrella while lightning flashes",
  snow: "wearing a woolly hat as snow falls",
  mist: "peering through bands of fog",
};

/**
 * Rotating an SVG part needs a pivot point. This sets the pivot using
 * coordinates from the drawing's own grid, e.g. the base of the tail.
 */
const pivot = (x: number, y: number): CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

/**
 * CSS custom properties (the `--name` kind) let React hand a number to an
 * animation written in the CSS file. TypeScript doesn't know about custom
 * names, so this small helper marks them as a valid style.
 */
const cssVars = (vars: Record<string, string>) => vars as CSSProperties;

/* ---------- The cat ---------- */

/*
  This is the homepage's orange tabby, redrawn here shape for shape. It needs
  its own copy because the shared drawing's tail and whiskers are fixed, and
  here the wind has to move them.
*/

/** The cat-head outline: a round face with two pointy ears. cx/cy is the centre of the face. */
function headD(cx: number, cy: number) {
  const p = (x: number, y: number) => `${cx + x} ${cy + y}`;
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

/*
  The tail is one curvy line made of two bends. Each shape below is the same
  list of 7 points (x,y pairs), so we can slide smoothly from one shape to
  another just by moving every number part of the way.
*/
type TailShape = number[];
/** Still air: curled along the ground, the way the homepage tabby holds it. */
const TAIL_CALM: TailShape = [236, 146, 262, 150, 270, 164, 250, 166, 226, 168, 214, 160, 198, 164];
/** A light breeze towards the right: flopped over to that side, still resting on the ground. */
const TAIL_BREEZE_RIGHT: TailShape = [236, 146, 258, 150, 270, 161, 284, 160, 296, 159, 304, 153, 313, 156];
/** A strong wind towards the right: lifted and streaming out behind the cat in a long wave. */
const TAIL_BLOWN_RIGHT: TailShape = [236, 146, 258, 148, 262, 128, 280, 128, 297, 128, 296, 108, 315, 104];
/** A strong wind towards the left: stretched out long and flat along the ground. */
const TAIL_BLOWN_LEFT: TailShape = [236, 146, 260, 152, 264, 170, 238, 169, 212, 168, 184, 172, 158, 162];

/** Moves every number in `from` part of the way towards `to` (amount 0 to 1). */
const blend = (from: TailShape, to: TailShape, amount: number) => from.map((value, i) => +(value + (to[i] - value) * amount).toFixed(1));

const tailPath = (n: TailShape) => `M${n[0]} ${n[1]} C${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[6]} ${n[7]} C${n[8]} ${n[9]} ${n[10]} ${n[11]} ${n[12]} ${n[13]}`;

function Tabby({ windSide, windStrength }: { windSide: 1 | -1; windStrength: number }) {
  /*
    Which tail shape to draw.
    - Towards the left, the calm tail already points that way, so it simply
      stretches out further as the wind grows.
    - Towards the right, the tail first flops over to that side (a breeze),
      then lifts off the ground and streams out (a strong wind). Blending
      straight from "curled left" to "streaming right" would pass through a
      squashed stump in the middle, which is why there is a breeze shape.
    - In almost still air it stays curled, whichever way the wind points.
  */
  let tailShape = TAIL_CALM;
  if (windSide < 0) tailShape = blend(TAIL_CALM, TAIL_BLOWN_LEFT, Math.min(1, windStrength * 1.5));
  else if (windStrength >= 0.1) tailShape = blend(TAIL_BREEZE_RIGHT, TAIL_BLOWN_RIGHT, Math.min(1, (windStrength - 0.1) / 0.6));
  const tail = tailPath(tailShape);

  // Stronger wind = bigger and quicker flutter. In still air the tail sways lazily.
  const tailFlutter = cssVars({
    "--swing": `${(2.5 + windStrength * 5).toFixed(1)}deg`,
    "--beat": `${(0.45 + 4.5 * (1 - windStrength) ** 2).toFixed(2)}s`,
  });
  const whiskerFlutter = cssVars({
    "--swing": `${(windStrength * 5).toFixed(1)}deg`,
    "--beat": `${(0.25 + 1.6 * (1 - windStrength) ** 2).toFixed(2)}s`,
  });

  const noseY = 87;

  return (
    <g>
      {/* tail (drawn first, so the body covers where it joins) */}
      <g className={styles.flutter} style={{ ...pivot(236, 146), ...tailFlutter }}>
        <path d={tail} stroke={ORANGE} strokeWidth={10} fill="none" strokeLinecap="round" />
        {/* the tabby rings: the same line again, drawn as short dark dashes */}
        <path d={tail} stroke={ORANGE_DARK} strokeWidth={10} fill="none" strokeDasharray="2.5 14" strokeDashoffset={-12} />
      </g>

      {/* body and front paw */}
      <g filter={GRAIN}>
        <path d="M60 150 C40 150 36 118 60 104 C90 88 140 86 190 88 C236 90 256 112 250 136 C246 152 226 156 200 154Z" fill={ORANGE} />
        <path d="M66 150 C42 152 24 150 20 142 C18 134 28 132 42 136 L72 138Z" fill={ORANGE} />
      </g>
      {/* stripes across the back, and the curve of the back leg */}
      <path
        d="M150 92 C156 104 158 118 154 130 M170 90 C178 104 180 120 176 132 M190 92 C198 106 200 120 196 132 M212 96 C220 108 222 122 218 132"
        stroke={ORANGE_DARK}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <path d="M190 152 C176 138 186 118 206 118 C228 118 236 136 226 152" stroke={ORANGE_DARK} strokeWidth={1.8} fill="none" />
      {/* toes */}
      <path d="M24 148 l0 -4 M29 148 l0 -4" stroke={INK} strokeWidth={1} strokeLinecap="round" />

      {/* head */}
      <g filter={GRAIN}>
        <path d={headD(80, 76)} fill={ORANGE} />
      </g>
      <path d="M53 40 L66 50 L55 55Z" fill={ORANGE_LIGHT} />
      <path d="M72 48 l2 8 M80 46 l0 9 M88 48 l-2 8" stroke={ORANGE_DARK} strokeWidth={2.5} strokeLinecap="round" />

      {/* eyes (they blink now and then) */}
      <g className={styles.blink}>
        {[67, 93].map((x) => (
          <g key={x} transform={`translate(${x} 78)`}>
            <path d="M-6.5 0 Q0 -5.8 6.5 0 Q0 5.8 -6.5 0Z" fill={EYE} stroke={INK} strokeWidth={1.1} />
            <ellipse rx={1.3} ry={3.5} fill={INK} />
          </g>
        ))}
      </g>

      {/* nose and mouth */}
      <path d="M77 85.5 L83 85.5 L80 89Z" fill={NOSE} />
      <path d="M80 89 Q77.5 92.5 75 90.5 M80 89 Q82.5 92.5 85 90.5" stroke={INK} strokeWidth={1.1} fill="none" strokeLinecap="round" />

      {/* whiskers: three on each side of the nose */}
      {[-1, 1].map((side) => (
        <g key={side} className={styles.flutter} style={{ ...pivot(80 + side * 11, noseY + 3.5), ...whiskerFlutter }}>
          {[0, 1, 2].map((i) => {
            const rootX = 80 + side * 11;
            const rootY = noseY + 1 + i * 2.5;
            const tipX = 80 + side * 31;
            const tipY = noseY - 4 + i * 6;
            // Each whisker is a curve from its root, through the middle of where
            // it normally sits, to its tip. The wind pushes the tip sideways:
            // whiskers on the sheltered side stretch out, the others bend back.
            const blownTipX = tipX + windSide * windStrength * 9;
            const blownTipY = tipY - windStrength * 3;
            return (
              <path
                key={i}
                d={`M${rootX} ${rootY} Q${(rootX + tipX) / 2} ${(rootY + tipY) / 2} ${blownTipX.toFixed(1)} ${blownTipY.toFixed(1)}`}
                stroke={INK}
                strokeWidth={0.9}
                fill="none"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ))}
    </g>
  );
}

/* ---------- Things in the sky ---------- */

function Sun({ x, y, opacity, colour }: { x: number; y: number; opacity: number; colour: string }) {
  return (
    <g opacity={opacity}>
      <g className={styles.spin} style={pivot(x, y)} stroke={colour} strokeWidth={5} strokeLinecap="round">
        {Array.from({ length: 8 }, (_, i) => {
          // 8 rays, evenly spaced around the circle
          const angle = (i * Math.PI) / 4;
          const point = (radius: number) => ({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
          const from = point(35);
          const to = point(45);
          return <line key={i} x1={from.x.toFixed(1)} y1={from.y.toFixed(1)} x2={to.x.toFixed(1)} y2={to.y.toFixed(1)} />;
        })}
      </g>
      <circle cx={x} cy={y} r={26} fill={colour} />
    </g>
  );
}

/** A crescent moon, drawn as one shape so stars and clouds show through the gap. */
function Moon({ x, y, opacity }: { x: number; y: number; opacity: number }) {
  return (
    <path
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      d="M-2.79 -23.84 A24 24 0 1 0 21.81 10 A21 21 0 0 1 -2.79 -23.84Z"
      fill={MOONLIGHT}
      opacity={opacity}
    />
  );
}

const STARS = [
  [38, 44, 2.2],
  [84, 22, 1.6],
  [146, 40, 2],
  [204, 24, 1.5],
  [244, 92, 1.8],
  [332, 118, 2.2],
  [58, 92, 1.5],
  [22, 136, 1.8],
  [286, 30, 1.4],
  [176, 84, 1.3],
];

function Stars({ brightness }: { brightness: number }) {
  return (
    <g fill={MOONLIGHT} opacity={brightness}>
      {STARS.map(([x, y, r], i) => (
        <circle key={i} className={styles.twinkle} style={{ animationDelay: `${i * 0.45}s` }} cx={x} cy={y} r={r} />
      ))}
    </g>
  );
}

function Lightning() {
  return <path className={styles.flash} d="M298 84 L282 120 L295 120 L286 150 L312 110 L299 110 L308 84Z" fill={YELLOW} />;
}

/* ----- Clouds ----- */

/** One cloud outline, 72 wide and 40 tall, with its top-left corner at 0,0. */
const CLOUD_D = "M14 40 C4 40 0 33 0 27 C0 19 7 14 14 14 C16 6 24 0 34 0 C45 0 53 7 55 16 C64 15 72 21 72 29 C72 36 67 40 60 40Z";

/**
 * Eight places a cloud can sit. `at` is how far across the sky it rests
 * (0 = left edge, 1 = right edge). The list is in the order clouds are added,
 * so the first few are spread out and the later ones fill the gaps.
 */
const CLOUD_SPOTS = [
  { y: 18, scale: 1.4, at: 0.66 },
  { y: 30, scale: 0.9, at: 0.06 },
  { y: 56, scale: 0.8, at: 0.36 },
  { y: 8, scale: 1.1, at: 0.9 },
  { y: 60, scale: 1.0, at: 0.78 },
  { y: 34, scale: 1.25, at: 0.2 },
  { y: 70, scale: 0.75, at: 0.54 },
  { y: 6, scale: 0.95, at: 0.46 },
];

/**
 * `count` clouds that travel across the sky with the wind.
 *
 * Each cloud loops forever along one straight track: in from the side the
 * wind comes from, out the other side, and round again. The animation is
 * started part-way through (a negative delay), so at the first moment every
 * cloud is exactly at its resting spot. That matters when animations are
 * switched off: the clouds then simply stay at those spots.
 */
function Clouds({ count, fill, windSide, seconds }: { count: number; fill: string; windSide: 1 | -1; seconds: number }) {
  return (
    <g>
      {CLOUD_SPOTS.slice(0, count).map((spot, i) => {
        const width = 72 * spot.scale;
        const rest = spot.at * (W - width);
        const offLeft = -width - 12;
        const offRight = W + 12;
        const enter = windSide > 0 ? offLeft : offRight;
        const leave = windSide > 0 ? offRight : offLeft;
        // Clouds don't all move at the same pace, which looks more natural.
        const time = seconds * (0.85 + (i % 3) * 0.15);
        const alreadyTravelled = (rest - enter) / (leave - enter);
        return (
          <g key={i} transform={`translate(${rest.toFixed(1)} ${spot.y})`}>
            <g
              className={styles.cloudTravel}
              style={{
                ...cssVars({ "--from": `${(enter - rest).toFixed(1)}px`, "--to": `${(leave - rest).toFixed(1)}px` }),
                animationDuration: `${time.toFixed(1)}s`,
                animationDelay: `${(-alreadyTravelled * time).toFixed(1)}s`,
              }}
            >
              <path d={CLOUD_D} fill={fill} transform={`scale(${spot.scale})`} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/* ----- Rain and snow ----- */

/*
  Falling rain is one "tile" of scattered drops, drawn twice: once in view and
  once just above it. CSS slides both down by exactly one tile height, over
  and over, so the loop has no visible jump. In wind, the slide also moves
  sideways (the "lean"), and the tile is extra wide so there are always drops
  to blow in from the side.

  The multiply-and-remainder maths spreads the drops out evenly without using
  Math.random, so the picture is identical every time it is drawn.
*/
const DROPS = Array.from({ length: 140 }, (_, i) => ({ x: ((i * 167 + 13) % 700) - 170, y: (i * 101 + 7) % H }));
const FLAKES = Array.from({ length: 150 }, (_, i) => ({ x: ((i * 229 + 20) % 860) - 250, y: (i * 89 + 11) % H, r: 1.6 + (i % 3) * 0.7 }));

/** `intensity` 0–1 sets how many drops there are; `lean` is how far sideways they travel while falling. */
function Rain({ intensity, lean, colour }: { intensity: number; lean: number; colour: string }) {
  const count = Math.round(18 + intensity * 122);
  const length = 11 + intensity * 9;
  // Each drop is a short line tilted along the direction it is travelling.
  const tile = DROPS.slice(0, count).map((drop, i) => <line key={i} x1={drop.x} y1={drop.y} x2={(drop.x + (lean / H) * length).toFixed(1)} y2={drop.y + length} />);
  return (
    <g
      className={styles.fall}
      style={{ ...cssVars({ "--lean": `${lean.toFixed(1)}px` }), animationDuration: `${(1.05 - intensity * 0.55).toFixed(2)}s` }}
      stroke={colour}
      strokeWidth={1.7 + intensity * 0.7}
      strokeLinecap="round"
      opacity={0.8}
    >
      <g>{tile}</g>
      <g transform={`translate(${(-lean).toFixed(1)} ${-H})`}>{tile}</g>
    </g>
  );
}

function Snow({ intensity, lean, windStrength }: { intensity: number; lean: number; windStrength: number }) {
  const count = Math.round(14 + intensity * 61);
  // Two layers falling at different speeds give a little feeling of depth.
  const layer = (pick: number, layerLean: number, seconds: number, opacity: number) => {
    const tile = FLAKES.filter((_, i) => i % 2 === pick)
      .slice(0, count)
      .map((flake, i) => <circle key={i} cx={flake.x} cy={flake.y} r={flake.r} />);
    return (
      <g className={styles.fall} opacity={opacity} style={{ ...cssVars({ "--lean": `${layerLean.toFixed(1)}px` }), animationDuration: `${seconds.toFixed(1)}s` }}>
        <g>{tile}</g>
        <g transform={`translate(${(-layerLean).toFixed(1)} ${-H})`}>{tile}</g>
      </g>
    );
  };
  return (
    <g fill="#ffffff">
      {layer(0, lean * 0.7, 16 - windStrength * 7, 0.75)}
      {layer(1, lean, 10 - windStrength * 5, 1)}
    </g>
  );
}

function Fog({ bands, colour }: { bands: { x: number; y: number; w: number }[]; colour: string }) {
  return (
    <g fill={colour} opacity={0.6}>
      {bands.map((band, i) => (
        <rect key={i} className={styles.drift} style={{ animationDelay: `${i * -2.3}s` }} x={band.x} y={band.y} width={band.w} height={16} rx={8} />
      ))}
    </g>
  );
}

/* ---------- Props for the cat ---------- */

function Sunglasses() {
  const middle = (EYE_L + EYE_R) / 2;
  return (
    <g>
      {/* arms reaching back towards the ears */}
      <path d={`M${EYE_L - 11} ${EYE_Y - 2} L${EYE_L - 19} ${EYE_Y - 6} M${EYE_R + 11} ${EYE_Y - 2} L${EYE_R + 19} ${EYE_Y - 6}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      {/* bridge over the nose */}
      <path d={`M${EYE_L + 10} ${EYE_Y - 3} Q${middle} ${EYE_Y - 7} ${EYE_R - 10} ${EYE_Y - 3}`} stroke={INK} strokeWidth={2.4} fill="none" />
      {[EYE_L, EYE_R].map((x) => (
        <g key={x}>
          <rect x={x - 11} y={EYE_Y - 8} width={22} height={15} rx={6.5} fill={INK} />
          {/* a little glint on each lens */}
          <path d={`M${x - 6} ${EYE_Y - 1} L${x - 1} ${EYE_Y - 5}`} stroke={CREAM} strokeWidth={1.6} strokeLinecap="round" opacity={0.7} />
        </g>
      ))}
    </g>
  );
}

function SleepMask() {
  return (
    <g>
      <path d={`M${EYE_L - 13} ${EYE_Y - 1} L${EYE_L - 19} ${EYE_Y - 4} M${EYE_R + 13} ${EYE_Y - 1} L${EYE_R + 19} ${EYE_Y - 4}`} stroke={PINK_DARK} strokeWidth={3} strokeLinecap="round" />
      <rect x={EYE_L - 13} y={EYE_Y - 8} width={EYE_R - EYE_L + 26} height={17} rx={8.5} fill={PINK} />
      {/* closed, happy eyes stitched onto the mask */}
      {[EYE_L, EYE_R].map((x) => (
        <path key={x} d={`M${x - 6} ${EYE_Y - 1} q6 5 12 0`} stroke={PINK_DARK} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      ))}
    </g>
  );
}

function Zzz() {
  return (
    <g className={styles.zzz} fill={CREAM}>
      {[
        { x: 166, y: 120, size: 16 },
        { x: 181, y: 102, size: 21 },
        { x: 199, y: 82, size: 27 },
      ].map((z, i) => (
        <text key={i} className={styles.z} style={{ animationDelay: `${i * 0.5}s` }} x={z.x} y={z.y} fontSize={z.size}>
          z
        </text>
      ))}
    </g>
  );
}

/** The umbrella's stick. Drawn before the cat, so the cat's head hides the lower half. */
function UmbrellaHandle() {
  return <path d="M120 58 L120 150" stroke={INK} strokeWidth={3} strokeLinecap="round" />;
}

function UmbrellaTop() {
  return (
    <g>
      <path d="M54 98 C58 50 182 50 186 98 Q170 86 153 98 Q137 86 120 98 Q104 86 87 98 Q70 86 54 98Z" fill={PINK} />
      {/* the two middle panels, a shade darker */}
      <path d="M87 98 Q96 70 120 62 Q144 70 153 98 Q137 86 120 98 Q104 86 87 98Z" fill={PINK_DARK} />
      <path d="M120 62 L120 54" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

/**
 * A patch of plain sky under the umbrella, painted over the rain.
 * It leans the same way as the rain, so in a strong wind the dry area is
 * pushed sideways, just like a real umbrella's shelter.
 */
function DryPatch({ lean }: { lean: number }) {
  // The patch runs from the umbrella (y = 96) down to the bottom of the picture.
  const shift = (lean * (H - 96)) / H;
  return <path d={`M56 96 L184 96 L${(184 + shift).toFixed(1)} ${H} L${(56 + shift).toFixed(1)} ${H}Z`} fill={SKY} />;
}

function WoollyHat() {
  return (
    <g>
      <path d="M105 122 C105 100 135 100 135 122Z" fill={PINK_DARK} />
      <rect x={102} y={117} width={36} height={9} rx={4.5} fill={CREAM} />
      <circle cx={120} cy={103} r={6} fill={CREAM} />
    </g>
  );
}

/* ---------- The scene ---------- */

export function WeatherScene({ mood, scene }: { mood: Mood; scene: SceneSettings }) {
  const wet = scene.rain !== null;
  const windy = scene.windStrength > 0.3;

  // How far sideways rain and snow travel while falling the height of the picture.
  // Snow is lighter than rain, so the same wind carries it further.
  const rainLean = scene.windSide * scene.windStrength * 160;
  const snowLean = scene.windSide * scene.windStrength * 240;

  const label = `An orange tabby cat ${SCENE_DESCRIPTION[mood]}. ${scene.phase} sky${windy ? ", and the wind is blowing its tail and whiskers" : ""}.`;

  return (
    <svg className={styles.scene} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <GrainFilter />
        {/* The sky: one colour at the top blending into another at the horizon */}
        <linearGradient id="weatherCatSky" gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={H}>
          <stop offset="0" stopColor={scene.skyTop} />
          <stop offset="0.85" stopColor={scene.skyBottom} />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill={SKY} />

      {/* ----- in the sky ----- */}
      {scene.stars > 0.02 && <Stars brightness={scene.stars} />}
      {scene.sun && <Sun {...scene.sun} />}
      {scene.moon && <Moon {...scene.moon} />}
      {mood === "mist" && (
        <Fog
          colour={scene.cloud}
          bands={[
            { x: 30, y: 40, w: 190 },
            { x: 150, y: 76, w: 180 },
            { x: -20, y: 112, w: 150 },
          ]}
        />
      )}

      {/* ----- falling from the sky ----- */}
      {scene.rain !== null && (
        <>
          <Rain intensity={scene.rain} lean={rainLean} colour={scene.rainColour} />
          <DryPatch lean={rainLean} />
        </>
      )}
      {scene.snow !== null && <Snow intensity={scene.snow} lean={snowLean} windStrength={scene.windStrength} />}

      {/* Clouds are painted after the rain and snow, so the drops appear to fall out of them. */}
      <Clouds count={scene.cloudCount} fill={scene.cloud} windSide={scene.windSide} seconds={scene.cloudSeconds} />
      {mood === "storm" && <Lightning />}

      {/* ----- the ground: one soft hill ----- */}
      <path d={`M0 218 C90 204 270 204 ${W} 218 L${W} ${H} L0 ${H}Z`} fill={scene.ground} />

      {/* ----- the cat ----- */}
      {wet && <UmbrellaHandle />}
      <g transform={`translate(${CAT_X} ${CAT_Y})`}>
        <Tabby windSide={scene.windSide} windStrength={scene.windStrength} />
      </g>

      {/* ----- what the cat is wearing or holding ----- */}
      {mood === "clearDay" && <Sunglasses />}
      {mood === "clearNight" && (
        <>
          <SleepMask />
          <Zzz />
        </>
      )}
      {wet && <UmbrellaTop />}
      {mood === "snow" && <WoollyHat />}
      {mood === "mist" && (
        <Fog
          colour={scene.cloud}
          bands={[
            { x: 150, y: 170, w: 230 },
            { x: -10, y: 206, w: 200 },
          ]}
        />
      )}
    </svg>
  );
}

/* ---------- Small forecast icons ---------- */

const ICON_CLOUD_D = "M9 24 C5 24 3 21.5 3 18.5 C3 15.5 5.5 13.5 8.5 13.5 C9.5 9.8 12.8 7.5 16.5 7.5 C20.8 7.5 24 10.5 24.6 14.4 C27.6 14.6 29.5 16.8 29.5 19.4 C29.5 22 27.5 24 24.8 24Z";

/** A cloud nudged up to make room for whatever is falling out of it. */
const raisedCloud = (fill: string) => <path d={ICON_CLOUD_D} fill={fill} transform="translate(0 -5)" />;

const ICONS: Record<Mood, ReactNode> = {
  clearDay: (
    <g stroke={YELLOW} strokeWidth={2.4} strokeLinecap="round">
      <circle cx={16} cy={16} r={6} fill={YELLOW} stroke="none" />
      <path d="M16 3.5 V6.5 M16 25.5 V28.5 M3.5 16 H6.5 M25.5 16 H28.5 M7.2 7.2 L9.3 9.3 M22.7 22.7 L24.8 24.8 M7.2 24.8 L9.3 22.7 M22.7 9.3 L24.8 7.2" />
    </g>
  ),
  clearNight: <path d="M22.5 20.6 A9.5 9.5 0 1 1 13.2 6.6 A7.5 7.5 0 0 0 22.5 20.6Z" fill="#7f8bb5" />,
  clouds: <path d={ICON_CLOUD_D} fill="#a9b3ba" />,
  rain: (
    <g>
      {raisedCloud("#a9b3ba")}
      <path d="M10 22.5 L8.6 27.5 M16 22.5 L14.6 27.5 M22 22.5 L20.6 27.5" stroke="#5a86c9" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  storm: (
    <g>
      {raisedCloud("#6d6d71")}
      <path d="M17.5 18 L12.5 25 H16 L14.5 30.5 L21 22.5 H17.5 L19 18Z" fill={YELLOW} stroke={INK} strokeWidth={0.6} strokeLinejoin="round" />
    </g>
  ),
  snow: (
    <g>
      {raisedCloud("#a9b3ba")}
      <g fill="#7fa9dc">
        <circle cx={10} cy={24.5} r={1.8} />
        <circle cx={16} cy={27} r={1.8} />
        <circle cx={22} cy={24.5} r={1.8} />
      </g>
    </g>
  ),
  mist: <path d="M5 11 H24 M9 16 H28 M5 21 H21" stroke="#a9b3ba" strokeWidth={2.6} strokeLinecap="round" />,
};

/** A small symbol for the forecast rows. `className` sets its size. */
export function WeatherIcon({ mood, className }: { mood: Mood; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" role="img" aria-label={MOOD_NAME[mood]}>
      {ICONS[mood]}
    </svg>
  );
}
