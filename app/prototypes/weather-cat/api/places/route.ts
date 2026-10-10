/**
 * Weather Cat — server route for the city search.
 *
 *   GET /prototypes/weather-cat/api/places?q=brooklyn
 *
 * Weather is looked up by coordinates (latitude and longitude), but people
 * type names. OpenWeatherMap's "Geocoding API" translates a name into up to
 * five matching places with their coordinates.
 */

import { NextResponse, type NextRequest } from "next/server";
import { roundCoord, type Place } from "../../weather";
import { askOpenWeather, errorResponse, errorResponseFor } from "../openweather";

type RawPlace = { name: string; state?: string; country: string; lat: number; lon: number };

const ONE_DAY = 60 * 60 * 24;

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  // Too short to mean anything, or suspiciously long: don't bother OpenWeatherMap.
  if (query.length < 2 || query.length > 80) return errorResponse("bad_request");

  try {
    // City names don't move, so this answer can be remembered for a whole day.
    const found = await askOpenWeather<RawPlace[]>("/geo/1.0/direct", { q: query, limit: "5" }, ONE_DAY);

    // The same town sometimes comes back twice. Keep the first of each.
    const seen = new Set<string>();
    const places: Place[] = [];
    for (const item of found) {
      const key = `${item.name}|${item.state ?? ""}|${item.country}`;
      if (seen.has(key)) continue;
      seen.add(key);
      places.push({ name: item.name, state: item.state, country: item.country, lat: roundCoord(item.lat), lon: roundCoord(item.lon) });
    }

    return NextResponse.json({ places });
  } catch (thrown) {
    return errorResponseFor(thrown);
  }
}
