"use client";

/**
 * Weather Cat — the weather where you are, as told by a cat.
 *
 * How it fits together:
 *
 *   1. FIND A PLACE. On first visit the page asks the browser for your
 *      location (`navigator.geolocation`). You can also search for any city,
 *      or click one on the 3D world map (`world-map.tsx`). If you pick a
 *      city, it is remembered for next time.
 *   2. ASK FOR THE WEATHER. The page calls our own server route
 *      (`api/weather/route.ts`), never OpenWeatherMap directly. The server
 *      adds the secret API key, so the key never reaches the browser.
 *   3. DRAW IT. The answer is a small `WeatherData` object (see `weather.ts`).
 *      The cat scene, the big temperature, the hourly strip and the 5-day
 *      list are all drawn from that one object.
 *   4. KEEP THE PICTURE HONEST. `scene.ts` turns the numbers into picture
 *      settings: the wind blows the rain, clouds, tail and whiskers the right
 *      way; the cloud cover sets how many clouds there are; and the sky's
 *      colour follows the real time between sunrise and sunset.
 *
 * The page is always in exactly one "phase" (see `Phase` below). Thinking in
 * phases keeps every situation covered: still looking, loading, showing
 * weather, or explaining what went wrong.
 *
 * WHY A MAP CLICK IS INSTANT. When the page opens it asks for the weather
 * right now in every city on the map, all in one go (`api/cities/route.ts`).
 * So when you click a pin, that city's weather is already here and goes
 * straight on screen. Only its forecast still has to be fetched, and the two
 * forecast cards fill in a moment later (the "preview" phase).
 */

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import BackHome from "../../components/back-home/BackHome";
import { caveat, instrumentSans } from "../../fonts";
import { WeatherIcon, WeatherScene } from "./art";
import { CITIES } from "./cities";
import { describeScene } from "./scene";
import {
  catAdvice,
  compassPoint,
  countryName,
  formatClock,
  formatHour,
  formatRate,
  formatWeekday,
  formatWind,
  regionLabel,
  roundCoord,
  toTemp,
  type ApiErrorCode,
  type Place,
  type Units,
  type WeatherData,
  type WeatherNow,
} from "./weather";
import { WorldMap } from "./world-map";
import styles from "./styles.module.css";

/* ---------- Types ---------- */

type Phase =
  | "starting" // the very first moment, before we know anything
  | "locating" // waiting for the browser to tell us where we are
  | "loading" // waiting for the weather
  | "preview" // a map city's weather right now is on screen, and its forecast is on the way
  | "ready" // weather is on screen
  | "needsPlace" // couldn't get a location: the visitor should search instead
  | "error"; // the weather request failed

/** Everything that can go wrong: our API's error codes, plus problems in the browser. */
type Problem = ApiErrorCode | "network" | "denied" | "unavailable" | "timeout" | "unsupported";

/** What we last tried to do, so the "Try again" button can repeat it. */
type LastRequest = { kind: "locate" } | { kind: "place"; lat: number; lon: number; place?: Place };

/* ---------- Words for each problem ---------- */

const PROBLEMS: Record<Problem, { title: string; body: string; retry: boolean }> = {
  denied: {
    title: "I can't see where you are",
    body: "Location access is switched off for this page. Search for a city or pick one on the map, or allow location in your browser's site settings and try again.",
    retry: true,
  },
  unavailable: {
    title: "I couldn't find your location",
    body: "Your device didn't share a location this time. Search for a city or pick one on the map instead.",
    retry: true,
  },
  timeout: {
    title: "Finding you is taking too long",
    body: "Your device took more than 10 seconds to share a location. Search for a city, pick one on the map, or try again.",
    retry: true,
  },
  unsupported: {
    title: "This browser can't share a location",
    body: "No problem: search for a city, or pick one on the map.",
    retry: false,
  },
  missing_key: {
    title: "The cat needs an API key",
    body: "", // this one gets step-by-step instructions instead (see <ProblemCard>)
    retry: true,
  },
  invalid_key: {
    title: "OpenWeatherMap didn't accept the key",
    body: "Check that the key in .env.local was copied exactly, with no spaces or quotes. A brand-new key can take up to a couple of hours to start working.",
    retry: true,
  },
  rate_limited: {
    title: "Too many questions at once",
    body: "The free weather plan allows 60 requests a minute and we've hit the limit. Wait a minute, then try again.",
    retry: true,
  },
  bad_request: {
    title: "That place confused the cat",
    body: "The coordinates for this place don't look right. Try searching for it again.",
    retry: false,
  },
  upstream: {
    title: "The weather service isn't answering",
    body: "OpenWeatherMap didn't reply properly. This is usually temporary.",
    retry: true,
  },
  network: {
    title: "I can't reach the weather",
    body: "Check your internet connection, and that the dev server is still running.",
    retry: true,
  },
};

const WAITING_TEXT: Partial<Record<Phase, string>> = {
  starting: "Waking the cat…",
  locating: "Finding where you are…",
  loading: "Sniffing the air…",
};

/* ---------- Remembering choices between visits ---------- */

const STORAGE_KEY = "weather-cat";
type Saved = { units?: Units; place?: Place };

/**
 * localStorage is a small notebook the browser keeps for each website.
 * Reading it can fail (private windows, blocked storage), so every access is
 * wrapped in try/catch and the page works fine without it.
 */
function readSaved(): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Saved;
    const place = saved.place;
    const placeLooksRight = !!place && typeof place.name === "string" && typeof place.lat === "number" && typeof place.lon === "number";
    return {
      units: saved.units === "metric" || saved.units === "imperial" ? saved.units : undefined,
      place: placeLooksRight ? place : undefined,
    };
  } catch {
    return {};
  }
}

function writeSaved(change: Saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readSaved(), ...change }));
  } catch {
    // Nothing to do: the choice just won't be remembered next time.
  }
}

/** Fahrenheit for the few countries that use it, Celsius for everyone else. */
function guessUnits(): Units {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region ?? "";
    return ["US", "BS", "BZ", "KY", "LR", "PW"].includes(region) ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}

/* ---------- Talking to our own server routes ---------- */

/**
 * Asks one of our routes for its JSON answer.
 *
 * Sometimes a request fails for a moment through no fault of the page: the
 * connection blips, or the dev server is busy rebuilding and answers with an
 * error page instead of JSON. So if a request fails outright, this waits a
 * little and tries ONE more time before giving up.
 *
 * (An answer like "missing_key" is not a failure of this kind. It arrives
 * as proper JSON, so it is returned straight away with `ok: false`.)
 */
async function fetchJson(url: string, signal?: AbortSignal): Promise<{ ok: boolean; body: unknown }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, { signal });
      return { ok: response.ok, body: await response.json() };
    } catch (error) {
      // Cancelled on purpose, or already tried twice: pass the error on.
      if (signal?.aborted || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
  }
}

/** Reads the error code out of one of our routes' error answers. */
const errorCode = (body: unknown) => (body as { error?: { code?: ApiErrorCode } } | null)?.error?.code ?? "upstream";

/* ---------- Small pieces of the page ---------- */

function PinIcon() {
  return (
    <svg className={styles.pinIcon} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 18 C10 18 4 12.2 4 8 A6 6 0 0 1 16 8 C16 12.2 10 18 10 18Z" />
      <circle className={styles.pinDot} cx={10} cy={8} r={2.2} />
    </svg>
  );
}

function DropIcon() {
  return (
    <svg className={styles.dropIcon} viewBox="0 0 12 14" aria-hidden="true">
      <path d="M6 1 C6 1 1.5 6.2 1.5 9 A4.5 4.5 0 0 0 10.5 9 C10.5 6.2 6 1 6 1Z" />
    </svg>
  );
}

/**
 * An arrow that points the way the wind is blowing, like on a weather map
 * (up = north). The API says where the wind comes FROM, so the arrow is
 * turned half a circle more: a wind from the west points east, to the right.
 */
function WindArrow({ from }: { from: number }) {
  return (
    <svg className={styles.windArrow} viewBox="0 0 16 16" style={{ transform: `rotate(${(from + 180) % 360}deg)` }} aria-hidden="true">
      <path d="M8 1.5 L13 9 H10 V14.5 H6 V9 H3Z" />
    </svg>
  );
}

/** Shows the chance of rain. Faded when rain is unlikely, so the wet days stand out. */
function RainChance({ chance, className }: { chance: number; className?: string }) {
  const percent = Math.round(chance * 100);
  return (
    <span className={`${styles.rainChance} ${percent < 10 ? styles.rainUnlikely : ""} ${className ?? ""}`}>
      <DropIcon />
      <span className={styles.srOnly}>Chance of rain </span>
      {percent}%
    </span>
  );
}

function ProblemCard({ problem, onRetry }: { problem: Problem; onRetry: () => void }) {
  const { title, body, retry } = PROBLEMS[problem];
  return (
    <section className={styles.problem} role="alert">
      <h2 className={styles.problemTitle}>{title}</h2>

      {problem === "missing_key" ? (
        <ol className={styles.steps}>
          <li className={styles.step}>
            Open the file <code className={styles.code}>.env.local</code> in the project&apos;s top folder (next to <code className={styles.code}>package.json</code>).
          </li>
          <li className={styles.step}>
            Paste your OpenWeatherMap key straight after the equals sign: <code className={styles.code}>OPENWEATHERMAP_API_KEY=your_key_here</code>
          </li>
          <li className={styles.step}>Save the file, then press Try again. If this message comes back, stop and restart the dev server.</li>
        </ol>
      ) : (
        <p className={styles.problemBody}>{body}</p>
      )}

      {retry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Try again
        </button>
      )}
    </section>
  );
}

/* ---------- The page ---------- */

export default function WeatherCat() {
  /*
    The server routes live in this prototype's own folder, so their address is
    this page's address plus "/api". Reading the address (instead of typing it
    out) means the prototype keeps working if its folder is ever renamed.
  */
  const api = `${usePathname()}/api`;

  const [phase, setPhase] = useState<Phase>("starting");
  // What is on screen. Usually the full `WeatherData`. Just after a click on
  // the map it is a `WeatherNow` for a moment: the same thing minus the forecast.
  const [data, setData] = useState<WeatherData | WeatherNow | null>(null);
  // The weather right now in each of the map's cities, by city name.
  const [cityWeather, setCityWeather] = useState<Record<string, WeatherNow>>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [units, setUnits] = useState<Units>("metric");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searchState, setSearchState] = useState<"idle" | "searching" | "failed">("idle");
  // A search can fail for the same reasons as a weather request (for example a
  // missing API key). Remembering why lets the page explain it properly.
  const [searchProblem, setSearchProblem] = useState<Problem | null>(null);
  // Adding 1 to this number re-runs the search (used by the "Try again" button).
  const [searchAttempt, setSearchAttempt] = useState(0);

  const searchInput = useRef<HTMLInputElement>(null);
  const lastRequest = useRef<LastRequest | null>(null);
  /*
    Each request gets a number. If the visitor picks another city before the
    first answer arrives, the old answer has an out-of-date number and is
    ignored, so a slow reply can never overwrite a newer one.
  */
  const requestNumber = useRef(0);

  const hoursTitle = useId();
  const daysTitle = useId();

  /*
    The current time, in seconds (the same units the weather data uses).
    Refreshing it twice a minute lets the sky in the picture follow the clock:
    leave the page open through the evening and you can watch it turn golden,
    then pink, then dark.
  */
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(timer); // stop the timer when leaving the page
  }, []);

  /* ----- Ask our server for the weather at one spot ----- */
  const loadWeather = useCallback(
    async (lat: number, lon: number, place?: Place, preview?: WeatherNow) => {
      const mine = ++requestNumber.current;
      lastRequest.current = { kind: "place", lat, lon, place };
      setProblem(null);
      if (preview) {
        // A city from the map: we already know its weather right now, so show
        // that immediately. The request below then brings the forecast.
        setData(place ? { ...preview, place } : preview);
        setPhase("preview");
      } else {
        setPhase("loading");
      }

      try {
        const { ok, body } = await fetchJson(`${api}/weather?lat=${roundCoord(lat)}&lon=${roundCoord(lon)}`);
        if (mine !== requestNumber.current) return; // a newer request has taken over

        if (!ok) {
          setData(null);
          setProblem(errorCode(body));
          setPhase("error");
          return;
        }

        const weather = body as WeatherData;
        // If the visitor chose a city by name, keep the name they chose.
        setData(place ? { ...weather, place } : weather);
        setPhase("ready");
      } catch {
        if (mine !== requestNumber.current) return;
        setData(null);
        setProblem("network");
        setPhase("error");
      }
    },
    [api],
  );

  /* ----- Ask the browser where we are ----- */
  const locate = useCallback(() => {
    const mine = ++requestNumber.current;
    lastRequest.current = { kind: "locate" };
    setProblem(null);

    if (!("geolocation" in navigator)) {
      setProblem("unsupported");
      setPhase("needsPlace");
      return;
    }

    setPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (mine !== requestNumber.current) return;
        // "My location" is the default, so forget any city saved earlier.
        writeSaved({ place: undefined });
        loadWeather(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        if (mine !== requestNumber.current) return;
        setProblem(error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable");
        setPhase("needsPlace");
      },
      // Give up after 10 seconds, and accept a location found in the last 10 minutes.
      { timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    );
  }, [loadWeather]);

  /* ----- When the page first opens ----- */
  useEffect(() => {
    // This runs in the browser only, which is why localStorage is read here
    // and not while the component is first drawn (that also happens on the server).
    const saved = readSaved();
    setUnits(saved.units ?? guessUnits());
    if (saved.place) loadWeather(saved.place.lat, saved.place.lon, saved.place);
    else locate();
  }, [loadWeather, locate]);

  /* ----- The world map: the weather in all of its cities, refreshed every 10 minutes ----- */
  useEffect(() => {
    let leaving = false;

    const loadCities = async () => {
      try {
        const { ok, body } = await fetchJson(`${api}/cities`);
        if (leaving || !ok) return;
        const byName: Record<string, WeatherNow> = {};
        for (const city of (body as { cities: WeatherNow[] }).cities) byName[city.place.name] = city;
        setCityWeather(byName);
      } catch {
        // The map is a bonus. If this fails its pins stay grey and a click
        // loads the weather the ordinary way, which reports any real problem.
      }
    };

    loadCities();
    const timer = setInterval(loadCities, 10 * 60 * 1000);
    return () => {
      leaving = true;
      clearInterval(timer);
    };
  }, [api]);

  /* ----- City search: wait until typing pauses, then ask ----- */
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults(null);
      setSearchState("idle");
      setSearchProblem(null);
      return;
    }

    // "Debouncing": start a short timer on every keystroke and cancel the
    // previous one. Only the last keystroke's timer survives, so we search
    // once when the typing stops instead of once per letter.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchState("searching");
      try {
        const { ok, body } = await fetchJson(`${api}/places?q=${encodeURIComponent(text)}`, controller.signal);
        if (!ok) {
          setResults(null);
          setSearchState("failed");
          setSearchProblem(errorCode(body));
          return;
        }
        setResults((body as { places: Place[] }).places);
        setSearchState("idle");
        setSearchProblem(null);
      } catch {
        if (controller.signal.aborted) return; // cancelled on purpose: not a real failure
        setResults(null);
        setSearchState("failed");
        setSearchProblem("network");
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, api, searchAttempt]);

  // If we need the visitor to search, put the cursor in the search box for them.
  useEffect(() => {
    if (phase === "needsPlace") searchInput.current?.focus();
  }, [phase]);

  /* ----- Things the visitor can do ----- */

  /** `preview` is the weather we already hold for this place, if it is a city from the map. */
  const choosePlace = (place: Place, preview?: WeatherNow) => {
    writeSaved({ place });
    setQuery(""); // also closes the results list
    loadWeather(place.lat, place.lon, place, preview);
  };

  const chooseUnits = (next: Units) => {
    setUnits(next);
    writeSaved({ units: next });
  };

  const retry = () => {
    if (searchProblem) {
      setSearchAttempt((attempt) => attempt + 1);
      return;
    }
    const last = lastRequest.current;
    if (last?.kind === "place") loadWeather(last.lat, last.lon, last.place);
    else locate();
  };

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault(); // stop the browser from reloading the page
    if (results?.length) choosePlace(results[0]);
  };

  /* ----- Values worked out from the data, ready to draw ----- */

  const waiting = WAITING_TEXT[phase];
  const shownProblem = searchProblem ?? problem;
  const degree = units === "imperial" ? "°F" : "°C";
  // A failed search is explained by the problem card instead, so the list stays closed.
  const showResults = query.trim().length >= 2 && searchState !== "failed";

  // Everything the picture needs: sky colours, wind, cloud count, rain density (see scene.ts).
  const scene = data ? describeScene(data.current, now) : null;

  // Rain or snow right now, for the details row.
  const snowing = !!data && (data.current.mood === "snow" || data.current.snowRate > 0);
  const fallingRate = data ? (snowing ? data.current.snowRate : data.current.rainRate) : 0;
  const isFalling = !!data && ["rain", "storm", "snow"].includes(data.current.mood);
  // The API sometimes reports rain without an amount. "Light" is the honest thing to say then.
  const fallingText = fallingRate > 0 ? formatRate(fallingRate) : isFalling ? "Light" : "None";

  // The forecast part of `data`. It is missing for a moment after a click on the map.
  const forecast = data && "hourly" in data ? data : null;

  // The coldest and warmest temperatures of the whole forecast. Each day's bar
  // is drawn as a slice of this range, so warm and cold days are easy to compare.
  const lows = forecast?.daily.map((day) => day.min) ?? [];
  const highs = forecast?.daily.map((day) => day.max) ?? [];
  const coldest = Math.min(...lows);
  const range = Math.max(Math.max(...highs) - coldest, 1);

  // Read out by screen readers whenever the situation changes
  const announcement = data
    ? `Showing weather for ${data.place.name}: ${toTemp(data.current.temp, units)}${degree}, ${data.current.description}.`
    : (waiting ?? (shownProblem ? PROBLEMS[shownProblem].title : ""));

  return (
    <div className={`${styles.container} ${instrumentSans.className} ${caveat.variable}`}>
      <div className={styles.column}>
        <header className={styles.topBar}>
          <BackHome accent="#f0893d" />
          <h1 className={styles.title}>Weather Cat</h1>
          <div className={styles.units} role="group" aria-label="Temperature units">
            <button type="button" className={styles.unitChip} aria-pressed={units === "metric"} onClick={() => chooseUnits("metric")}>
              °C
            </button>
            <button type="button" className={styles.unitChip} aria-pressed={units === "imperial"} onClick={() => chooseUnits("imperial")}>
              °F
            </button>
          </div>
        </header>

        {/* ----- Search ----- */}
        <form className={styles.search} role="search" onSubmit={onSearchSubmit}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>Search for a city</span>
            <input
              ref={searchInput}
              className={styles.searchInput}
              type="search"
              value={query}
              placeholder="Search for a city"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery("");
              }}
              autoComplete="off"
              spellCheck={false}
              maxLength={80}
            />
          </label>

          <button type="button" className={styles.locateButton} onClick={locate}>
            <PinIcon />
            <span className={styles.locateLabel}>Use my location</span>
          </button>

          {showResults && (
            <div className={styles.results} aria-live="polite">
              {results === null && <p className={styles.resultsNote}>Searching…</p>}
              {results?.length === 0 && <p className={styles.resultsNote}>No places found. Check the spelling, or try a bigger town nearby.</p>}
              {!!results?.length && (
                <ul className={styles.resultList}>
                  {results.map((place) => (
                    <li key={`${place.lat},${place.lon}`} className={styles.resultItem}>
                      <button type="button" className={styles.resultButton} onClick={() => choosePlace(place)}>
                        <span className={styles.resultName}>{place.name}</span>
                        <span className={styles.resultRegion}>{[place.state, countryName(place.country)].filter(Boolean).join(", ")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </form>

        {/* ----- World map: another way to choose a place ----- */}
        <WorldMap cities={CITIES} weather={cityWeather} current={data} units={units} onChoose={(city) => choosePlace(city, cityWeather[city.name])} />

        {/* Not visible: tells screen-reader users what just happened */}
        <p className={styles.srOnly} role="status">
          {announcement}
        </p>

        <main className={styles.main}>
          {shownProblem && <ProblemCard problem={shownProblem} onRetry={retry} />}

          {waiting && !data && (
            <div className={styles.waiting}>
              <span className={styles.waitingPaw} aria-hidden="true" />
              <p className={styles.waitingText}>{waiting}</p>
            </div>
          )}

          {data && scene && (
            // While a new place is loading, the old weather stays on screen, faded.
            <div className={`${styles.weather} ${waiting ? styles.weatherBusy : ""}`} aria-busy={!!waiting}>
              {/* ----- Right now ----- */}
              <section className={styles.hero} aria-label="Weather right now">
                <WeatherScene mood={data.current.mood} scene={scene} />

                <div className={styles.heroText}>
                  <h2 className={styles.place}>{data.place.name}</h2>
                  <p className={styles.region}>{regionLabel(data.place)}</p>
                  {/* What the sky in the picture is showing, and the time there right now */}
                  <p className={styles.clock}>
                    {scene.phase} · {formatClock(now, data.timezoneOffset)}
                  </p>

                  <p className={styles.temp}>
                    {toTemp(data.current.temp, units)}
                    <span className={styles.degree}>{degree}</span>
                  </p>
                  <p className={styles.description}>{data.current.description}</p>
                  <p className={styles.feelsLike}>Feels like {toTemp(data.current.feelsLike, units)}°</p>

                  <p className={styles.advice}>“{catAdvice(data.current.mood, data.current.temp)}”</p>
                </div>
              </section>

              {/* ----- A few more numbers ----- */}
              <dl className={styles.details}>
                <div className={styles.detail}>
                  <dt className={styles.detailLabel}>Humidity</dt>
                  <dd className={styles.detailValue}>{Math.round(data.current.humidity)}%</dd>
                </div>
                <div className={styles.detail}>
                  <dt className={styles.detailLabel}>Wind</dt>
                  <dd className={styles.detailValue}>
                    <WindArrow from={data.current.windDirection} />
                    {formatWind(data.current.windSpeed, units)}{" "}
                    <span className={styles.detailNote}>from {compassPoint(data.current.windDirection)}</span>
                  </dd>
                </div>
                <div className={styles.detail}>
                  <dt className={styles.detailLabel}>Cloud cover</dt>
                  <dd className={styles.detailValue}>{Math.round(data.current.cloudCover)}%</dd>
                </div>
                <div className={styles.detail}>
                  <dt className={styles.detailLabel}>{snowing ? "Snow" : "Rain"}</dt>
                  <dd className={styles.detailValue}>{fallingText}</dd>
                </div>
                <div className={styles.detail}>
                  <dt className={styles.detailLabel}>Sunrise</dt>
                  <dd className={styles.detailValue}>{formatClock(data.current.sunrise, data.timezoneOffset)}</dd>
                </div>
                <div className={styles.detail}>
                  <dt className={styles.detailLabel}>Sunset</dt>
                  <dd className={styles.detailValue}>{formatClock(data.current.sunset, data.timezoneOffset)}</dd>
                </div>
              </dl>

              {!forecast && (
                <p className={styles.forecastWait}>
                  <span className={styles.waitingPaw} aria-hidden="true" />
                  Fetching the forecast…
                </p>
              )}

              {/* ----- Next 24 hours ----- */}
              {forecast && (
                <section className={styles.card} aria-labelledby={hoursTitle}>
                  <h2 id={hoursTitle} className={styles.cardTitle}>
                    Next 24 hours
                  </h2>
                  {/* tabIndex lets keyboard users scroll this strip sideways with the arrow keys */}
                  <ol className={styles.hours} tabIndex={0} aria-labelledby={hoursTitle}>
                    {forecast.hourly.map((hour) => (
                      <li key={hour.time} className={styles.hour}>
                        <span className={styles.hourTime}>{formatHour(hour.time, data.timezoneOffset)}</span>
                        <WeatherIcon mood={hour.mood} className={styles.icon} />
                        <span className={styles.hourTemp}>{toTemp(hour.temp, units)}°</span>
                        <RainChance chance={hour.rainChance} />
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* ----- Next 5 days ----- */}
              {forecast && (
                <section className={styles.card} aria-labelledby={daysTitle}>
                  <h2 id={daysTitle} className={styles.cardTitle}>
                    Next 5 days
                  </h2>
                  <ol className={styles.days}>
                    {forecast.daily.map((day, index) => {
                      // Where this day's bar starts and how wide it is, as a share of the whole range
                      const bar = {
                        "--bar-start": `${((day.min - coldest) / range) * 100}%`,
                        "--bar-width": `${Math.max(((day.max - day.min) / range) * 100, 6)}%`,
                      } as CSSProperties;
                      return (
                        <li key={day.date} className={styles.day}>
                          <span className={styles.dayName}>{index === 0 ? "Today" : formatWeekday(day.time, data.timezoneOffset)}</span>
                          <WeatherIcon mood={day.mood} className={styles.icon} />
                          <RainChance chance={day.rainChance} className={styles.dayRain} />
                          <span className={styles.dayLow}>
                            <span className={styles.srOnly}>Low </span>
                            {toTemp(day.min, units)}°
                          </span>
                          <span className={styles.bar} aria-hidden="true">
                            <span className={styles.barFill} style={bar} />
                          </span>
                          <span className={styles.dayHigh}>
                            <span className={styles.srOnly}>High </span>
                            {toTemp(day.max, units)}°
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              <p className={styles.updated}>
                Updated {formatClock(data.current.time, data.timezoneOffset)} local time · Weather data from{" "}
                <a className={styles.link} href="https://openweathermap.org/" target="_blank" rel="noreferrer">
                  OpenWeatherMap
                </a>
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
