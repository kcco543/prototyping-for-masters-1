/**
 * Weather Cat — server route for the world map.
 *
 *   GET /prototypes/weather-cat/api/cities
 *
 * Answers with the weather right now in every city on the map (the list is
 * in `cities.ts`). The map uses it twice over:
 *   - to colour each pin by how warm it is there, and
 *   - to show a city's weather the instant its pin is clicked, without
 *     waiting for a new request.
 *
 * OpenWeatherMap's free plan has no "many places at once" question, so this
 * asks once per city, all at the same time. Each answer is remembered for 10
 * minutes, so reloading the page doesn't ask again.
 */

import { NextResponse } from "next/server";
import { CITIES } from "../../cities";
import type { WeatherNow } from "../../weather";
import { askCurrent, errorResponseFor, getApiKey, tidyCurrent } from "../openweather";

// Run this code every time the route is asked, instead of letting Next.js
// bake one answer into the built site. (The 10-minute memory is separate: it
// belongs to the requests made inside `askCurrent`.)
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // With no key, every city would fail in the same way. Say so once instead.
    getApiKey();
  } catch (thrown) {
    return errorResponseFor(thrown);
  }

  // Promise.allSettled waits for every request to finish, whether it worked
  // or not. (Promise.all would give up on all of them as soon as one failed.)
  const answers = await Promise.allSettled(CITIES.map((city) => askCurrent(city.lat, city.lon)));

  const cities: WeatherNow[] = [];
  let firstFailure: unknown;
  answers.forEach((answer, index) => {
    if (answer.status === "fulfilled") {
      cities.push({ place: CITIES[index], timezoneOffset: answer.value.timezone, current: tidyCurrent(answer.value) });
    } else {
      firstFailure ??= answer.reason;
    }
  });

  // One or two cities missing is fine: their pins stay grey. Nothing at all is a real failure.
  if (cities.length === 0) return errorResponseFor(firstFailure);

  return NextResponse.json({ cities });
}
