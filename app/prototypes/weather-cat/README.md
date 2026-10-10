# Weather Cat

The weather where you are, as told by a cat. It shows the current
conditions, the next 24 hours and a 5-day forecast, using live data from the
[OpenWeatherMap API](https://openweathermap.org/api). The orange tabby
dresses for the weather: sunglasses in the sun, an umbrella in the rain, a
woolly hat in the snow, a sleep mask on a clear night.

There is also a 3D world map, drawn with [Three.js](https://threejs.org/).
Each pin is a city, coloured by how warm it is there right now. Click a pin
and that city's weather is on screen straight away.

The picture is also a small chart. Everything in it comes from a real number:

| In the picture | Comes from |
| --- | --- |
| Which way the rain, snow, clouds, tail and whiskers blow | Wind direction |
| How far the rain slants, how fast the clouds cross, how hard the tail flutters | Wind speed |
| How many clouds there are (0 to 8) | Cloud cover, in percent |
| How dense the rain or snow is | Rain or snow, in mm per hour |
| The colour of the sky, and where the sun or moon sits | The time, between that day's sunrise and sunset |

## Setup (one time)

This prototype needs an OpenWeatherMap API key. An API key is like a
password that tells OpenWeatherMap who is asking, so it has to stay private.

1. Get a key (free): sign up at <https://openweathermap.org/>, then copy the
   key from <https://home.openweathermap.org/api_keys>.
2. Open the file `.env.local` in the project's top folder (next to
   `package.json`). If it doesn't exist, create it.
3. Paste the key straight after the equals sign, with no spaces or quotes:

   ```
   OPENWEATHERMAP_API_KEY=your_key_here
   ```

4. Save the file. The dev server (`npm run dev`) notices the change by
   itself, so just press **Try again** on the page. If the page still asks
   for a key, stop the dev server and start it again.

Good to know:

- `.env.local` is listed in `.gitignore`, so your key is never committed or
  pushed to GitHub. Don't paste the key anywhere else in the code.
- A brand-new key can take up to a couple of hours to start working. Until
  then the page says "OpenWeatherMap didn't accept the key".
- If you publish this site (for example on Vercel), add the same
  `OPENWEATHERMAP_API_KEY` in that service's "Environment Variables" settings.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Then open http://localhost:3000/prototypes/weather-cat (or click
**Weather Cat** on the homepage).

## How to use

- The first time, your browser asks whether the page may use your location.
  Say yes to see the weather where you are.
- Or type a city into the search box and pick a result. A city you pick is
  remembered for your next visit.
- Or pick a city on the **world map**. Hover over a pin to see the city's
  name and temperature, and click it to see its weather. The pin with the
  orange ring is the place on screen now (your own location and cities you
  search for get a pin too).
- On a phone the map shows part of the world: drag it sideways to see the
  rest.
- With a keyboard, press Tab until the map has a dashed outline, move from
  city to city with the arrow keys, and press Enter to choose one.
- **Use my location** switches back to wherever you are now.
- **°C / °F** switches units. Your choice is remembered too.

If you block location access, nothing breaks: the cat asks you to search for
a city instead.

## How it works

The page never talks to OpenWeatherMap directly. It asks a small piece of
code on *our own* server, and that code adds the key and asks OpenWeatherMap:

```
Browser page  →  our server route  →  OpenWeatherMap
(no key)         (adds the key)       (sends the weather back)
```

Why the extra step? Anything in browser code can be read by anyone who opens
the browser's developer tools. Keeping the key on the server keeps it secret.

- **Server routes** (`api/weather/route.ts`, `api/places/route.ts`,
  `api/cities/route.ts`) are Next.js "Route Handlers": files that answer
  with data instead of a page.
- **Three questions at once.** The weather route asks OpenWeatherMap for the
  current weather, the forecast, and the place's name at the same time
  (`Promise.all`), then returns one small, tidy object.
- **Caching.** Answers are remembered for 10 minutes, because the weather
  data only updates about that often. The free plan allows 60 requests a
  minute, and this keeps us far below it.
- **Privacy.** Your coordinates are rounded to 2 decimal places (about 1 km)
  before they leave the browser. That is plenty for weather.
- **Local time.** Sunrise, sunset and the hourly times are shown in the
  *place's* time zone, not yours, so Tokyo's sunrise reads as a morning time.
- **Forecast.** The free forecast is one reading every 3 hours. The "Next 5
  days" list groups those readings by day and shows each day's lowest and
  highest temperature and highest chance of rain.
- **The cat.** `moodFromCondition` in `weather.ts` turns OpenWeatherMap's
  weather code into one of seven moods, and `art.tsx` draws a scene for each.

### How the world map works

Three.js draws 3D pictures in the browser. Every Three.js picture has the
same three parts: a **scene** (the objects and lights), a **camera** (where
you look from) and a **renderer** (which turns the two into pixels on a
`<canvas>`). `world-map-three.ts` builds them, and `world-map.tsx` connects
them to the page.

- **The land** comes from `land.json`: the outline of every land mass as a
  list of longitude and latitude points. Three.js "extrudes" each outline,
  which pushes the flat shape up into a slab, like cutting it out of thick
  card. The sea is just the box's CSS background.
- **Flattening the globe.** `project` turns a latitude and longitude into a
  spot on the flat map (the "Miller" projection, the look of a classroom wall
  map). The land and the pins both go through it, so they always line up.
- **The camera** looks down at the map from the south, leaning back 34
  degrees. That lean is what shows the sides of the land and makes the pins
  stand up. A light in the north-west casts the shadows.
- **The pins** are a stick and a ball. They are sized in screen pixels, so
  they stay easy to hit however small the map is drawn. The colour comes from
  the temperature (`TEMP_STOPS`), and the legend in the corner is drawn from
  the same list.
- **Finding the pin you clicked.** The map works out where each pin appears
  on screen and takes the nearest one to the pointer, within 16 pixels (26
  for a finger). That is more forgiving than needing an exact hit on a small
  ball.
- **The label and the keyboard** are ordinary HTML laid over the canvas. A
  canvas is only a picture to a keyboard or a screen reader, so each city is
  also a real button, hidden from view.
- **Why a click is instant.** When the page opens it asks
  `api/cities/route.ts` for the weather right now in every city on the map.
  A click puts that answer on screen at once, and only the forecast is
  fetched. You will see "Fetching the forecast…" for a moment.
- **Staying inside the free plan.** That is one request per city (37), all
  remembered for 10 minutes, and refreshed every 10 minutes while the page
  is open. The free plan allows 60 requests a minute. If you add cities,
  keep the list well under 60.
- **No WebGL?** Three.js needs WebGL, which almost every browser has. Where
  it is missing, the cities are shown as plain buttons instead.

`land.json` was made from [Natural Earth](https://www.naturalearthdata.com/)'s
public-domain 1:110m land outline (via the `world-atlas` npm package), with
coordinates rounded to 0.1 of a degree and Antarctica left out.

### How the picture reads the weather

`scene.ts` turns the weather numbers into picture settings, and `art.tsx`
draws them. Keeping the two apart means each rule lives in one place.

- **The picture is laid out like a map.** West is on the left and east is on
  the right. A wind *from* the west therefore blows things towards the right,
  and the sun rises on the right and sets on the left. The small arrow in the
  Wind box points the same way things blow in the picture.
- **Wind.** Strength goes from 0 (still) to 1 (14 m/s, about 50 km/h, or
  more). It sets how far the rain and snow lean, how quickly the clouds cross
  the sky, and how the tail and whiskers bend and flutter. A side view can
  only show left and right, so a wind from due north or south is drawn
  leaning to whichever side it is slightly closer to.
- **Clouds.** The count is the cloud cover out of 100, scaled to 8 clouds.
  When it is raining or snowing there are always at least 3, so the drops
  have something to fall from. Thick cloud also dims the sun and greys the sky.
- **Rain and snow.** The amount in mm per hour sets how many drops there
  are, how long they are and how fast they fall. If OpenWeatherMap reports
  rain without an amount, the picture shows a light shower and the Rain box
  says "Light".
- **The sky and the clock.** The day is a row of colour "stops": night, first
  light, sunrise, morning, day, golden hour, sunset, dusk, night. They are
  placed using the real sunrise and sunset for that place, and the sky is
  blended between the two nearest stops. The page checks the time twice a
  minute, so the sky keeps changing while the page is open. The small label
  above the temperature names the current stop and the local time.
- **Why the cat is redrawn here.** The homepage's shared tabby has a fixed
  tail and whiskers. This prototype has its own copy of the same drawing so
  the wind can move them.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | The page: finding your location, the search box, the units switch, and every on-screen state |
| `weather.ts` | Shared types and small helpers (moods, grouping the forecast into days, formatting) |
| `scene.ts` | The rules that turn weather numbers into picture settings (wind, cloud count, rain density, sky colour) |
| `art.tsx` | The drawings: the cat, the weather scene around it and the small forecast icons |
| `world-map.tsx` | The world map card: hover, click and drag, the name label, the legend, keyboard access |
| `world-map-three.ts` | The Three.js part of the map: land, pins, lights, camera and the drawing loop |
| `cities.ts` | The list of cities that get a pin |
| `land.json` | The outlines of the land (data, not code) |
| `styles.module.css` | Layout, cards and the scene's animations |
| `api/openweather.ts` | Server only: reads the key and calls OpenWeatherMap |
| `api/weather/route.ts` | Server route: current weather + forecast for a latitude and longitude |
| `api/places/route.ts` | Server route: city search |
| `api/cities/route.ts` | Server route: the weather right now in every city on the map |

## Things to tweak

- **What the cat says:** `catAdvice` in `weather.ts`.
- **Sky colours through the day:** the colour stops (`NIGHT`, `SUNRISE`,
  `GOLDEN`…) near the top of `scene.ts`, and when each one happens in
  `skyByClock`.
- **Ground and cloud colours:** `GROUND` and `CLOUD` in `scene.ts`.
- **How strongly the picture reacts:** `FULL_WIND`, `MAX_CLOUDS`,
  `HEAVY_RAIN` and `HEAVY_SNOW` in `scene.ts`. For example, lower
  `FULL_WIND` to make a gentle breeze look dramatic.
- **The tail's shapes:** `TAIL_CALM`, `TAIL_BREEZE_RIGHT`, `TAIL_BLOWN_RIGHT`
  and `TAIL_BLOWN_LEFT` in `art.tsx`.
- **Which weather gets which scene:** `moodFromCondition` in `weather.ts`.
  For example, "few clouds" (code 801) currently counts as cloudy.
- **How long answers are cached:** `TEN_MINUTES` in `api/openweather.ts`.
- **Which cities are on the map:** the list in `cities.ts`. The notes at the
  top of that file explain how to add one.
- **Pin colours:** `TEMP_STOPS` in `world-map-three.ts`. Each line is a
  temperature in °C and the colour for it.
- **How 3D the map looks:** `TILT` (0 is a flat map seen from straight
  above) and `LAND_HEIGHT` in `world-map-three.ts`.
- **Land and pin sizes and colours:** `LAND_TOP`, `LAND_SIDE`, `PIN_HEAD`
  and `PIN_STEM` in `world-map-three.ts`. The sea is the background of
  `.mapBox` in `styles.module.css`.
- **Search delay:** the `350` (milliseconds) in the search effect in `page.tsx`.

## Seeing different skies and weather

The picture shows the weather and the time *at the place you search for*, so
other cities are the easy way to see other scenes. Try a city where it is
early morning or evening for dawn and golden hour, a city on the other side
of the world for night, and somewhere rainy or windy for the rest.

## Troubleshooting

| What you see | What it means |
| --- | --- |
| "The cat needs an API key" | `.env.local` has no key, the file wasn't saved, or it isn't in the project's top folder. Restarting the dev server also helps |
| "OpenWeatherMap didn't accept the key" | The key is mistyped, has spaces or quotes around it, or is too new to be active |
| "I can't see where you are" | Location access is blocked for this page. Search for a city, or allow location in the browser's site settings |
| "Too many questions at once" | More than 60 requests in a minute. Wait a minute |
| The map's pins are all grey | The cities' weather didn't arrive (no key yet, or the limit above). The pins still work: clicking one loads its weather the ordinary way |
| A list of city buttons where the map should be | This browser can't run WebGL, which Three.js needs. The buttons do the same job |
