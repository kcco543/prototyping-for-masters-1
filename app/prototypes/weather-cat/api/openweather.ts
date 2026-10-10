/**
 * Weather Cat — the one place that talks to OpenWeatherMap.
 *
 * This file only ever runs on the server (it is imported by the two
 * `route.ts` files next to it). That matters because of the API key:
 *
 *   - The key is read from `process.env.OPENWEATHERMAP_API_KEY`, which Next.js
 *     fills in from the `.env.local` file in the project root.
 *   - Because the variable name does NOT start with `NEXT_PUBLIC_`, Next.js
 *     never copies it into the JavaScript that is sent to the browser.
 *
 * So visitors can use the prototype without ever being able to see the key.
 */

import { NextResponse } from "next/server";
import { moodFromCondition, type ApiErrorBody, type ApiErrorCode, type CurrentWeather } from "../weather";

const OPENWEATHER = "https://api.openweathermap.org";

/** The message and HTTP status that go with each kind of failure. */
const FAILURES: Record<ApiErrorCode, { status: number; message: string }> = {
  missing_key: { status: 500, message: "No OpenWeatherMap API key is set. Add OPENWEATHERMAP_API_KEY to .env.local in the project's top folder." },
  invalid_key: { status: 502, message: "OpenWeatherMap rejected the API key. It may be mistyped, or too new to be active yet." },
  rate_limited: { status: 429, message: "Too many requests to OpenWeatherMap. Try again in a minute." },
  bad_request: { status: 400, message: "The request was missing something or had a value that is out of range." },
  upstream: { status: 502, message: "OpenWeatherMap could not be reached or returned an unexpected answer." },
};

/** A failure we understand, so the route can report it with the right code. */
export class WeatherError extends Error {
  constructor(public code: ApiErrorCode) {
    super(FAILURES[code].message);
  }
}

/** Builds the JSON error answer that the page knows how to read. */
export function errorResponse(code: ApiErrorCode) {
  const { status, message } = FAILURES[code];
  return NextResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

/** Turns anything that was thrown into an error answer. */
export function errorResponseFor(thrown: unknown) {
  return errorResponse(thrown instanceof WeatherError ? thrown.code : "upstream");
}

/** Reads the key, or throws `missing_key` if `.env.local` has not been filled in. */
export function getApiKey(): string {
  const key = process.env.OPENWEATHERMAP_API_KEY?.trim();
  if (!key) throw new WeatherError("missing_key");
  return key;
}

/**
 * Calls one OpenWeatherMap endpoint and returns its JSON.
 *
 * `cacheSeconds` tells Next.js to remember the answer for a while. Weather
 * only updates about every 10 minutes, so asking again sooner would just use
 * up the free allowance (60 calls a minute) for the same numbers.
 */
export async function askOpenWeather<T>(path: string, query: Record<string, string>, cacheSeconds: number): Promise<T> {
  const url = new URL(path, OPENWEATHER);
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  // The key is added here, on the server. Never log `url`: it contains the key.
  url.searchParams.set("appid", getApiKey());

  let response: Response;
  try {
    response = await fetch(url, { next: { revalidate: cacheSeconds }, signal: AbortSignal.timeout(8000) });
  } catch {
    // No connection, or OpenWeatherMap took longer than 8 seconds
    throw new WeatherError("upstream");
  }

  if (response.status === 401) throw new WeatherError("invalid_key");
  if (response.status === 429) throw new WeatherError("rate_limited");
  if (!response.ok) throw new WeatherError("upstream");

  try {
    return (await response.json()) as T;
  } catch {
    throw new WeatherError("upstream");
  }
}

/* ---------- "The weather right now" ---------- */
// Two routes need this: `weather/route.ts` (one place, with its forecast) and
// `cities/route.ts` (every city on the world map). It lives here so that both
// ask for it, and tidy it up, in exactly the same way.

export type RawCondition = { id: number; description: string; icon: string };

/** The parts of OpenWeatherMap's "current weather" answer that we use. */
export type RawCurrent = {
  dt: number;
  name?: string;
  timezone: number;
  weather?: RawCondition[];
  main: { temp: number; feels_like: number; humidity: number };
  wind?: { speed?: number; deg?: number };
  clouds?: { all?: number };
  // Only present when it is raining or snowing. "1h" = amount in the last hour, in mm.
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
  sys?: { country?: string; sunrise?: number; sunset?: number };
};

export const TEN_MINUTES = 60 * 10;

/** OpenWeatherMap icon names end in "d" for day and "n" for night, e.g. "10d". */
export const isDaytime = (condition?: RawCondition) => !condition?.icon?.endsWith("n");

/**
 * Asks for the weather right now at one spot.
 *
 * Because both routes go through this one function, they build exactly the
 * same web address for the same spot. Next.js spots the repeat and answers
 * from its 10-minute memory. So when you click a city on the map, its weather
 * is not asked for a second time: the map already asked.
 */
export const askCurrent = (lat: number, lon: number) =>
  askOpenWeather<RawCurrent>("/data/2.5/weather", { lat: String(lat), lon: String(lon), units: "metric" }, TEN_MINUTES);

/** Boils OpenWeatherMap's answer down to our small `CurrentWeather` shape. */
export function tidyCurrent(raw: RawCurrent): CurrentWeather {
  const now = raw.weather?.[0];
  const isDay = isDaytime(now);
  return {
    time: raw.dt,
    temp: raw.main.temp,
    feelsLike: raw.main.feels_like,
    humidity: raw.main.humidity,
    windSpeed: raw.wind?.speed ?? 0,
    windDirection: raw.wind?.deg ?? 0,
    cloudCover: raw.clouds?.all ?? 0,
    rainRate: raw.rain?.["1h"] ?? 0,
    snowRate: raw.snow?.["1h"] ?? 0,
    description: now?.description ?? "",
    mood: moodFromCondition(now?.id ?? 800, isDay),
    isDay,
    sunrise: raw.sys?.sunrise ?? 0,
    sunset: raw.sys?.sunset ?? 0,
  };
}
