/**
 * Weather Cat — shared types and small helper functions.
 *
 * There is no React in this file. It is imported from two places:
 *   - the server routes in `api/`, which turn OpenWeatherMap's big raw answer
 *     into the small, tidy `WeatherData` shape below, and
 *   - `page.tsx`, which draws that shape on screen.
 *
 * Sharing the types means the server and the page always agree on what the
 * data looks like.
 */

/* ---------- The tidy data shape our own API returns ---------- */

/** The seven kinds of weather the cat knows how to react to. */
export type Mood = "clearDay" | "clearNight" | "clouds" | "rain" | "storm" | "snow" | "mist";

export type Place = {
  name: string;
  state?: string;
  /** Two-letter country code, e.g. "US" */
  country: string;
  lat: number;
  lon: number;
};

export type CurrentWeather = {
  /** When this reading was taken (seconds since 1970, UTC) */
  time: number;
  /** All temperatures are in °C. The page converts to °F when needed. */
  temp: number;
  feelsLike: number;
  /** Percent, 0–100 */
  humidity: number;
  /** Metres per second */
  windSpeed: number;
  /** Where the wind comes FROM, in compass degrees: 0 = north, 90 = east, 180 = south, 270 = west */
  windDirection: number;
  /** How much of the sky is covered by cloud, as a percent (0 = clear, 100 = overcast) */
  cloudCover: number;
  /** Rain and snow falling right now, in millimetres per hour. 0 when dry (or when not reported). */
  rainRate: number;
  snowRate: number;
  /** A short phrase from OpenWeatherMap, e.g. "light rain" */
  description: string;
  mood: Mood;
  isDay: boolean;
  sunrise: number;
  sunset: number;
};

export type HourPoint = {
  time: number;
  temp: number;
  mood: Mood;
  /** Chance of rain or snow, from 0 (none) to 1 (certain) */
  rainChance: number;
};

export type DayPoint = {
  /** The date in the place's own time zone, e.g. "2026-10-09" */
  date: string;
  /** A moment in the middle of that day (used to work out the weekday name) */
  time: number;
  min: number;
  max: number;
  mood: Mood;
  rainChance: number;
};

/**
 * The weather right now at one place, without a forecast. The world map gets
 * one of these for each of its cities, which is how it can show a city's
 * weather the moment it is clicked.
 */
export type WeatherNow = {
  place: Place;
  /** How far the place's clock is from UTC, in seconds (e.g. New York in winter: -18000) */
  timezoneOffset: number;
  current: CurrentWeather;
};

/** The weather right now plus the forecast: everything the page shows. */
export type WeatherData = WeatherNow & {
  hourly: HourPoint[];
  daily: DayPoint[];
};

/** Every way one of our API routes can fail. The page shows a message for each. */
export type ApiErrorCode = "missing_key" | "invalid_key" | "rate_limited" | "bad_request" | "upstream";

export type ApiErrorBody = { error: { code: ApiErrorCode; message: string } };

export type Units = "metric" | "imperial";

/* ---------- Turning OpenWeatherMap's codes into moods ---------- */

/**
 * OpenWeatherMap describes the weather with a number ("condition id").
 * The first digit tells you the family: 2xx thunderstorm, 3xx drizzle,
 * 5xx rain, 6xx snow, 7xx mist/fog/haze, 800 clear, 801–804 clouds.
 * Full list: https://openweathermap.org/weather-conditions
 */
export function moodFromCondition(id: number, isDay: boolean): Mood {
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "mist";
  if (id === 800) return isDay ? "clearDay" : "clearNight";
  return "clouds";
}

/** A plain-English name for each mood, read out by screen readers next to the icons. */
export const MOOD_NAME: Record<Mood, string> = {
  clearDay: "Sunny",
  clearNight: "Clear night",
  clouds: "Cloudy",
  rain: "Rain",
  storm: "Thunderstorm",
  snow: "Snow",
  mist: "Mist",
};

/** What the cat has to say about it. `tempC` lets it complain about heat and cold. */
export function catAdvice(mood: Mood, tempC: number): string {
  if (mood === "storm") return "Thunder! I'll be under the bed.";
  if (mood === "rain") return "Bring an umbrella. I'm staying in.";
  if (mood === "snow") return "Snow! Cold paws. Wear something woolly.";
  if (mood === "mist") return "Foggy out there. Walk slowly, whiskers first.";
  if (tempC >= 30) return "Too hot for fur. Shade and water, please.";
  if (tempC <= 0) return "Brrr. Bundle up, or stay by the radiator with me.";
  if (mood === "clearDay") return "Sunbeam weather. Find a warm windowsill.";
  if (mood === "clearNight") return "Clear skies. A fine night for dreaming.";
  return "Cloudy. A good day for a long nap.";
}

/* ---------- Time helpers ---------- */

/**
 * Times from the API are in UTC. To show a place's own clock time, we shift
 * the time by that place's offset and then format it "as if" it were UTC.
 * That way a viewer in Tokyo sees New York's sunrise in New York time.
 */
const shifted = (unixSeconds: number, timezoneOffset: number) => new Date((unixSeconds + timezoneOffset) * 1000);

/** "2026-10-09" in the place's own time zone. */
export const localDateKey = (unixSeconds: number, timezoneOffset: number) => shifted(unixSeconds, timezoneOffset).toISOString().slice(0, 10);

/** The hour of the day (0–23, with a fraction for minutes) in the place's own time zone. */
const localHour = (unixSeconds: number, timezoneOffset: number) => {
  const d = shifted(unixSeconds, timezoneOffset);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
};

/**
 * The language used for weekday names, clock times and country names.
 * The page's own words are in English, so these match. To follow each
 * visitor's browser language instead, change this to `undefined`.
 */
const LOCALE: string | undefined = "en";

const format = (unixSeconds: number, timezoneOffset: number, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: "UTC" }).format(shifted(unixSeconds, timezoneOffset));

/** e.g. "6:58 AM" */
export const formatClock = (t: number, offset: number) => format(t, offset, { hour: "numeric", minute: "2-digit" });
/** e.g. "3 PM" */
export const formatHour = (t: number, offset: number) => format(t, offset, { hour: "numeric" });
/** e.g. "Mon" */
export const formatWeekday = (t: number, offset: number) => format(t, offset, { weekday: "short" });

/* ---------- Forecast helper ---------- */

export type Reading = { time: number; temp: number; conditionId: number; rainChance: number };

/**
 * The free forecast comes as one reading every 3 hours. This groups those
 * readings by calendar day (in the place's own time zone) and summarises each
 * day: lowest and highest temperature, the highest chance of rain, and the
 * weather around lunchtime as "the day's weather".
 */
export function groupIntoDays(readings: Reading[], timezoneOffset: number, maxDays = 5): DayPoint[] {
  // A Map remembers the order things were added, so the days stay in order.
  const days = new Map<string, Reading[]>();
  for (const reading of readings) {
    const key = localDateKey(reading.time, timezoneOffset);
    const list = days.get(key);
    if (list) list.push(reading);
    else days.set(key, [reading]);
  }

  return Array.from(days.entries())
    .slice(0, maxDays)
    .map(([date, list]) => {
      const fromLunch = (r: Reading) => Math.abs(localHour(r.time, timezoneOffset) - 13);
      const lunchtime = list.reduce((best, r) => (fromLunch(r) < fromLunch(best) ? r : best));
      const temps = list.map((r) => r.temp);
      return {
        date,
        time: lunchtime.time,
        min: Math.min(...temps),
        max: Math.max(...temps),
        // Daily rows always use the daytime drawing, even if the closest reading is after dark.
        mood: moodFromCondition(lunchtime.conditionId, true),
        rainChance: Math.max(...list.map((r) => r.rainChance)),
      };
    });
}

/* ---------- Display helpers ---------- */

/** Rounds to a whole number in the chosen units. The data itself is always °C. */
export const toTemp = (celsius: number, units: Units) => Math.round(units === "imperial" ? (celsius * 9) / 5 + 32 : celsius);

/** Wind arrives in metres per second: shown as mph (imperial) or km/h (metric). */
export const formatWind = (metresPerSecond: number, units: Units) =>
  units === "imperial" ? `${Math.round(metresPerSecond * 2.237)} mph` : `${Math.round(metresPerSecond * 3.6)} km/h`;

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Turns compass degrees into a compass point: 0 → "N", 90 → "E", 225 → "SW". */
export const compassPoint = (degrees: number) => COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];

/** Rain or snow in millimetres per hour: one decimal for small amounts, whole numbers for big ones. */
export const formatRate = (mmPerHour: number) => `${mmPerHour < 10 ? mmPerHour.toFixed(1) : Math.round(mmPerHour)} mm/h`;

/** "US" → "United States". Falls back to the code if the name isn't known. */
export function countryName(code: string): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(LOCALE, { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The line under a place name, e.g. "New York, United States". */
export function regionLabel(place: Place): string {
  const state = place.state && place.state !== place.name ? place.state : "";
  return [state, countryName(place.country)].filter(Boolean).join(", ");
}

/**
 * Rounds a coordinate to 2 decimal places (roughly 1 km). That is plenty for
 * weather, it keeps your exact position private, and it means nearby requests
 * can share one cached answer.
 */
export const roundCoord = (value: number) => Math.round(value * 100) / 100;
