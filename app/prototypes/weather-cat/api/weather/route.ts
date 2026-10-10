/**
 * Weather Cat — server route for the weather itself.
 *
 *   GET /prototypes/weather-cat/api/weather?lat=40.71&lon=-74.01
 *
 * A file named `route.ts` is a "Route Handler": instead of drawing a page,
 * it answers requests with data. The page calls this address, and this code
 * (running on the server, where the API key is safe) asks OpenWeatherMap.
 *
 * It asks three questions at the same time:
 *   1. what is the weather right now?
 *   2. what is the forecast? (one reading every 3 hours, for 5 days)
 *   3. what is this place called?
 * and then boils the answers down to the small `WeatherData` shape.
 */

import { NextResponse, type NextRequest } from "next/server";
import { CITIES } from "../../cities";
import { groupIntoDays, moodFromCondition, roundCoord, type Reading, type WeatherData } from "../../weather";
import { askCurrent, askOpenWeather, errorResponse, errorResponseFor, isDaytime, tidyCurrent, TEN_MINUTES, type RawCondition } from "../openweather";

/* ---------- The parts of OpenWeatherMap's answers that we use ---------- */
// (The shape of the "current weather" answer is in `../openweather.ts`.)

type RawForecast = {
  list: { dt: number; pop?: number; weather?: RawCondition[]; main: { temp: number } }[];
};

type RawPlaceName = { name: string; state?: string; country: string };

const ONE_DAY = 60 * 60 * 24;

/** Reads a number from the address, e.g. `?lat=40.71`. Returns null if it is missing or out of range. */
function readNumber(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latitude = readNumber(params.get("lat"), -90, 90);
  const longitude = readNumber(params.get("lon"), -180, 180);
  if (latitude === null || longitude === null) return errorResponse("bad_request");

  const lat = roundCoord(latitude);
  const lon = roundCoord(longitude);
  const where = { lat: String(lat), lon: String(lon) };

  // A city from the world map already has a name, so there is nothing to look up.
  const mapCity = CITIES.find((city) => city.lat === lat && city.lon === lon);

  try {
    // Promise.all sends all three requests at once and waits for them together,
    // which is faster than asking one after another.
    const [current, forecast, names] = await Promise.all([
      askCurrent(lat, lon),
      askOpenWeather<RawForecast>("/data/2.5/forecast", { ...where, units: "metric" }, TEN_MINUTES),
      // The name is a nice-to-have: if this one fails we fall back to the name in `current`.
      mapCity ? [mapCity] : askOpenWeather<RawPlaceName[]>("/geo/1.0/reverse", { ...where, limit: "1" }, ONE_DAY).catch(() => []),
    ]);

    const now = current.weather?.[0];
    const named: RawPlaceName | undefined = names[0];

    // "Now" plus every forecast reading, in time order, ready to be grouped into days.
    const readings: Reading[] = [
      { time: current.dt, temp: current.main.temp, conditionId: now?.id ?? 800, rainChance: 0 },
      ...forecast.list.map((entry) => ({
        time: entry.dt,
        temp: entry.main.temp,
        conditionId: entry.weather?.[0]?.id ?? 800,
        rainChance: entry.pop ?? 0,
      })),
    ];

    const data: WeatherData = {
      place: {
        name: named?.name ?? current.name ?? "Your location",
        state: named?.state,
        country: named?.country ?? current.sys?.country ?? "",
        lat,
        lon,
      },
      timezoneOffset: current.timezone,
      current: tidyCurrent(current),
      // The next 8 readings are 3 hours apart, so together they cover 24 hours.
      hourly: forecast.list.slice(0, 8).map((entry) => ({
        time: entry.dt,
        temp: entry.main.temp,
        mood: moodFromCondition(entry.weather?.[0]?.id ?? 800, isDaytime(entry.weather?.[0])),
        rainChance: entry.pop ?? 0,
      })),
      daily: groupIntoDays(readings, current.timezone),
    };

    return NextResponse.json(data);
  } catch (thrown) {
    return errorResponseFor(thrown);
  }
}
