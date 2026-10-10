/**
 * Weather Cat — turning weather numbers into picture settings.
 *
 * `art.tsx` only knows how to DRAW. This file decides WHAT to draw:
 *
 *   wind speed + direction  →  which way things blow, and how hard
 *   cloud cover %           →  how many clouds
 *   rain / snow in mm/h     →  how dense the rain or snow is
 *   the time, sunrise, sunset → the colour of the sky and where the sun is
 *
 * Keeping the maths here (with no drawing code) makes each rule easy to find
 * and change. Everything is collected by `describeScene` at the bottom.
 *
 * COMPASS: the picture is laid out like a map. West is on the left and east
 * is on the right. So a wind from the west blows things towards the right,
 * and the sun comes up on the right and goes down on the left.
 */

import type { CurrentWeather, Mood } from "./weather";

/** The scene's own coordinate grid: 360 wide, 250 tall. */
export const SCENE_W = 360;
export const SCENE_H = 250;

/** Keeps a number between two limits (0 and 1 unless told otherwise). */
const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));

/**
 * Blends two colours written as "#rrggbb".
 * amount 0 gives all of `a`, 1 gives all of `b`, 0.5 is halfway.
 */
export function mix(a: string, b: string, amount: number): string {
  const t = clamp(amount);
  // Each colour is three numbers (red, green, blue) written in pairs of hex digits.
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((index) =>
        Math.round(channel(a, index) + (channel(b, index) - channel(a, index)) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/* ---------- 1. The sky follows the clock ---------- */

export type SkyPhase = "Night" | "Dawn" | "Sunrise" | "Day" | "Golden hour" | "Dusk";

/** A sky colour at the top, another at the horizon, and how light it is (0 = night, 1 = full day). */
type SkyColours = { top: string; bottom: string; light: number };

const NIGHT: SkyColours = { top: "#232c52", bottom: "#39446e", light: 0 };
const FIRST_LIGHT: SkyColours = { top: "#3a4273", bottom: "#8f7fa6", light: 0.2 };
const SUNRISE: SkyColours = { top: "#7f97c6", bottom: "#f6bfa2", light: 0.55 };
const MORNING: SkyColours = { top: "#a3d0ea", bottom: "#f3e3c4", light: 0.9 };
const DAY: SkyColours = { top: "#a9d9ee", bottom: "#d6eff5", light: 1 };
const GOLDEN: SkyColours = { top: "#9cc3df", bottom: "#f8d695", light: 0.85 };
const SUNSET: SkyColours = { top: "#6c7db3", bottom: "#f3a37b", light: 0.5 };
const DUSK: SkyColours = { top: "#3d4674", bottom: "#9a7fa3", light: 0.2 };

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const WHOLE_DAY = 24 * HOUR;

type ClockSky = SkyColours & {
  phase: SkyPhase;
  /** How far the sun is along its path: 0 = rising, 0.5 = highest, 1 = setting. null when it is down. */
  sun: number | null;
  /** The same for the moon, through the night. */
  moon: number | null;
};

/**
 * Works out the sky for one moment.
 *
 * Think of the day as a row of "stops", each with its own colours: night,
 * first light, sunrise, morning, day, golden hour, sunset, dusk, night again.
 * The stops are placed relative to the real sunrise and sunset, so they move
 * with the seasons and with the place. For a time between two stops we blend
 * their colours, which is why the sky changes smoothly instead of jumping.
 *
 * All times are in seconds since 1970 (the same units the API uses).
 */
function skyByClock(now: number, sunrise: number, sunset: number, isDay: boolean): ClockSky {
  // Some places have no sunrise or sunset (polar summer and winter). Fall back to plain day or night.
  if (!sunrise || !sunset || sunset <= sunrise) {
    return isDay ? { ...DAY, phase: "Day", sun: 0.3, moon: null } : { ...NIGHT, phase: "Night", sun: null, moon: 0.3 };
  }

  // The sunrise and sunset we have are for one particular day. Slide `now`
  // by whole days until it sits next to them.
  let time = now;
  while (time < sunrise - 6 * HOUR) time += WHOLE_DAY;
  while (time > sunrise + 18 * HOUR) time -= WHOLE_DAY;

  // On very short winter days the morning and evening stops could overlap.
  // Stopping them at midday keeps them in order.
  const midday = (sunrise + sunset) / 2;
  const afterSunrise = (minutes: number) => Math.min(sunrise + minutes * MINUTE, midday);
  const beforeSunset = (minutes: number) => Math.max(sunset - minutes * MINUTE, midday);

  const stops: [time: number, colours: SkyColours][] = [
    [sunrise - 90 * MINUTE, NIGHT],
    [sunrise - 35 * MINUTE, FIRST_LIGHT],
    [sunrise, SUNRISE],
    [afterSunrise(50), MORNING],
    [afterSunrise(110), DAY],
    [beforeSunset(110), DAY],
    [beforeSunset(50), GOLDEN],
    [sunset, SUNSET],
    [sunset + 35 * MINUTE, DUSK],
    [sunset + 90 * MINUTE, NIGHT],
  ];

  // Find the two stops that `time` falls between, and blend them.
  let colours: SkyColours = NIGHT;
  for (let i = 0; i < stops.length - 1; i++) {
    const [startTime, start] = stops[i];
    const [endTime, end] = stops[i + 1];
    if (time >= startTime && time <= endTime) {
      const along = endTime > startTime ? (time - startTime) / (endTime - startTime) : 0;
      colours = {
        top: mix(start.top, end.top, along),
        bottom: mix(start.bottom, end.bottom, along),
        light: start.light + (end.light - start.light) * along,
      };
      break;
    }
  }

  let phase: SkyPhase = "Day";
  if (time < sunrise - 35 * MINUTE || time > sunset + 35 * MINUTE) phase = "Night";
  else if (time < sunrise) phase = "Dawn";
  else if (time < afterSunrise(50)) phase = "Sunrise";
  else if (time > sunset) phase = "Dusk";
  else if (time >= beforeSunset(60)) phase = "Golden hour";

  // The sun travels from sunrise (0) to sunset (1). A little past each end is
  // allowed so it can sink behind the hill instead of vanishing.
  const sunAlong = (time - sunrise) / (sunset - sunrise);
  const sunIsUp = sunAlong >= -0.06 && sunAlong <= 1.06;

  // The moon takes the night shift: from sunset to the next sunrise.
  const nightStart = time > sunset ? sunset : sunset - WHOLE_DAY;
  const nightEnd = time > sunset ? sunrise + WHOLE_DAY : sunrise;
  const moonAlong = (time - nightStart) / (nightEnd - nightStart);

  return { ...colours, phase, sun: sunIsUp ? sunAlong : null, moon: sunIsUp ? null : moonAlong };
}

/**
 * The path the sun and moon follow across the picture: up from the horizon on
 * the right (east), over the top, and down to the horizon on the left (west).
 */
function onArc(along: number) {
  // sin() gives a smooth hill: 0 at each horizon, 1 at the top.
  const hill = Math.sin(Math.PI * along);
  // Raising it to the power 0.6 flattens the top of the hill, so the sun
  // climbs quickly, then spends most of the day high above the cat's head.
  // (Math.sign keeps this working just below the horizon, where `hill` is negative.)
  const height = Math.sign(hill) * Math.abs(hill) ** 0.6;
  return {
    x: Math.round((330 - 300 * along) * 10) / 10,
    y: Math.round((212 - 165 * height) * 10) / 10,
  };
}

/* ---------- Colours that depend on the weather ---------- */

/** Ground and cloud colours for each kind of weather: [at night, in daylight]. */
const GROUND: Record<Mood, [night: string, day: string]> = {
  clearDay: ["#3d564b", "#b9d48b"],
  clearNight: ["#3d564b", "#b9d48b"],
  clouds: ["#3d564b", "#b5c79a"],
  rain: ["#3a5046", "#9fb48e"],
  storm: ["#34463f", "#6f8272"],
  snow: ["#b9c4d4", "#fdfbf6"],
  mist: ["#4a5a52", "#bfcab4"],
};

const CLOUD: Record<Mood, [night: string, day: string]> = {
  clearDay: ["#8791a8", "#ffffff"],
  clearNight: ["#8791a8", "#ffffff"],
  clouds: ["#7f8aa3", "#ffffff"],
  rain: ["#5b6680", "#7d8a96"],
  storm: ["#1f2535", "#3f4758"],
  snow: ["#8d99b0", "#ffffff"],
  mist: ["#aab2c0", "#ffffff"],
};

/* ---------- Tuning: change these to change how the picture reacts ---------- */

/** Wind speed (metres per second) that counts as "full strength" in the picture. 14 m/s is about 50 km/h. */
const FULL_WIND = 14;
/** How many clouds a completely overcast sky gets. */
const MAX_CLOUDS = 8;
/** Rain (mm per hour) that fills the picture with drops. Meteorologists call 10 mm/h heavy rain. */
const HEAVY_RAIN = 10;
/** The same for snow, which is measured as melted water, so the numbers are smaller. */
const HEAVY_SNOW = 4;

/* ---------- Everything the picture needs to know ---------- */

export type SceneSettings = {
  phase: SkyPhase;
  skyTop: string;
  skyBottom: string;
  ground: string;
  cloud: string;
  rainColour: string;
  /** 0 = night, 1 = full daylight */
  light: number;
  sun: { x: number; y: number; opacity: number; colour: string } | null;
  moon: { x: number; y: number; opacity: number } | null;
  /** 0 = no stars, 1 = bright stars */
  stars: number;

  /** Which way things blow: 1 = towards the right (east), -1 = towards the left (west) */
  windSide: 1 | -1;
  /** 0 = still air, 1 = a very strong wind */
  windStrength: number;
  /** How many seconds a cloud takes to cross the sky */
  cloudSeconds: number;

  cloudCount: number;
  /** 0 = a few drops, 1 = a downpour. null when it isn't raining. */
  rain: number | null;
  snow: number | null;
};

export function describeScene(current: CurrentWeather, now: number): SceneSettings {
  const { mood } = current;
  const wet = mood === "rain" || mood === "storm";
  const falling = wet || mood === "snow";
  const sky = skyByClock(now, current.sunrise, current.sunset, current.isDay);
  const cover = clamp(current.cloudCover / 100);

  /* ----- How hard it is raining or snowing, from 0 to 1 ----- */
  // The square root makes light rain easier to tell apart: 1 mm/h and 3 mm/h
  // look clearly different, instead of both looking like "almost nothing".
  // If it is raining but no amount was reported, assume a light shower.
  const rain = wet ? clamp(Math.sqrt((current.rainRate || (mood === "storm" ? 4 : 1)) / HEAVY_RAIN), 0.12, 1) : null;
  const snow = mood === "snow" ? clamp(Math.sqrt((current.snowRate || 0.5) / HEAVY_SNOW), 0.15, 1) : null;

  /* ----- Sky colour: the clock sets it, then heavy weather greys it ----- */
  // Light cloud barely changes the sky; thick cloud dulls it a lot (hence the power of 1.5).
  let greyness = 0.6 * cover ** 1.5;
  if (mood === "rain") greyness = Math.max(greyness, 0.65 + 0.25 * (rain ?? 0));
  if (mood === "snow") greyness = Math.max(greyness, 0.55);
  if (mood === "mist") greyness = Math.max(greyness, 0.7);
  if (mood === "storm") greyness = 0.88;

  // The grey itself is darker at night than in the day, and darker in a downpour than in drizzle.
  let grey = mix("#343b51", "#b3c0c8", sky.light);
  if (mood === "rain") grey = mix(grey, mix("#2a3044", "#74818d", sky.light), (rain ?? 0) * 0.7);
  if (mood === "storm") grey = mix("#232838", "#667186", sky.light);
  if (mood === "mist") grey = mix("#474f61", "#d9e0dd", sky.light);

  const skyTop = mix(sky.top, grey, greyness);
  const skyBottom = mix(sky.bottom, mix(grey, "#ffffff", 0.12), greyness);

  // Ground and clouds pick up a little of the horizon colour, so a golden sky warms them too.
  const ground = mix(mix(GROUND[mood][0], GROUND[mood][1], sky.light), skyBottom, 0.12);
  const cloud = mix(mix(CLOUD[mood][0], CLOUD[mood][1], sky.light), skyBottom, 0.18);

  /* ----- Sun, moon and stars: hidden by bad weather, dimmed by thick cloud ----- */
  const hidden = falling || mood === "mist";
  const throughCloud = hidden ? 0 : 1 - 0.8 * clamp((current.cloudCover - 55) / 40);

  let sun: SceneSettings["sun"] = null;
  if (sky.sun !== null && throughCloud > 0) {
    // Height above the horizon, 0 to 1. The sun turns orange when it is low.
    const height = Math.sin(Math.PI * clamp(sky.sun));
    sun = { ...onArc(sky.sun), opacity: throughCloud, colour: mix("#f08a3c", "#f3c04a", height * 2.2) };
  }
  const moon = sky.moon !== null && throughCloud > 0 ? { ...onArc(sky.moon), opacity: throughCloud } : null;
  const stars = hidden ? 0 : (1 - sky.light) ** 2 * (1 - 0.85 * cover);

  /* ----- Wind ----- */
  // Compass degrees say where the wind comes FROM. It blows TOWARDS the
  // opposite side, so a wind from the west (270°) pushes things east (right).
  const towardsEast = -Math.sin((current.windDirection * Math.PI) / 180);
  const windSide = towardsEast >= 0 ? 1 : -1;
  const windStrength = clamp(current.windSpeed / FULL_WIND);
  // Faster wind, quicker clouds: 5 m/s crosses in about 50 seconds, 15 m/s in about 17.
  const cloudSeconds = clamp(260 / Math.max(current.windSpeed, 0.8), 16, 320);

  /* ----- Clouds ----- */
  // 25% cover → 2 clouds, 50% → 4, 100% → 8. Rain and snow need something to fall from.
  const cloudCount = Math.max(Math.round(cover * MAX_CLOUDS), falling ? 3 : 0);

  return {
    phase: sky.phase,
    skyTop,
    skyBottom,
    ground,
    cloud,
    rainColour: sky.light < 0.45 || mood === "storm" ? "#c9d6e6" : "#5f7f9a",
    light: sky.light,
    sun,
    moon,
    stars,
    windSide,
    windStrength,
    cloudSeconds,
    cloudCount,
    rain,
    snow,
  };
}
