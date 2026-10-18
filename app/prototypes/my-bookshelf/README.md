# A Constellation of Stories

*"Every book is a world. Together, they form a universe."*

**My Bookstore**, reimagined as a celestial atlas. Every book in a Notion
database becomes a star on an antique-looking star chart: a small floating
cover with a glowing star. Each genre becomes a constellation, with gold
lines joining its books, a dotted region around it, and a poetic Latin name.
You keep adding books in Notion; the sky fills up.

The folder is still called `my-bookshelf` (and the address is still
`/prototypes/my-bookshelf`), so old links keep working.

## What you'll see

**The title** (top left): *My Bookstore · A Constellation of Stories*, the
motto, a few catalogue facts (how many books, how many constellations, the
mean rating, when the data was read from Notion) and a one-line key.

**Constellation · Explore** (the main view): the star map.

- **Drag** to move around (or use the arrow keys). **Scroll** (or pinch on a
  trackpad or phone) to zoom, around the mouse. The **+ − Reset view**
  buttons sit bottom right. Zoom stays within sensible limits, and the map
  can't be dragged away entirely.
- **Hover over a book**: it comes closer and lights up, its constellation's
  lines brighten, the other constellations dim a little, and a card shows its
  title, author, genre and rating.
- **Click a book** to "enter its world": the map glides it to the middle of
  the screen, a little closer, then its cover flies onto the book's own page.
- **The index** (right): every constellation with its number of books, plus
  *All Constellations*. Choosing one glides the map there, dims the others,
  shows the count at the bottom left, and lists its stars, brightest first.
  You can also click a constellation's name on the map.
- **Search** (top of the index): type part of a title or an author, then
  press Enter (or click a suggestion). The map flies to the book and rings it.
- **Ambient life**: the stars twinkle, the sky drifts very slowly (and moves a
  little behind the map when you drag it, for depth), the covers float, and
  now and then a faint spark travels along a constellation line.

**Bookshelf · Browse**: the practical view. Every cover in a clean grid with
its title, author, genre, rating and star name. Filter by genre (a pill slides
to the chosen one), search, and sort by *Recently added*, *Highest rated* or
*Title A–Z*. The two views share the chosen genre, so switching keeps your
place. The address ends in `#bookshelf`, so a refresh stays on the shelf.

**A book's page** (from either view): an opened antique book. On the left, a
dark plate with the cover lit by its star; on the right, an ivory page with
the genre, title, author, rating, your review (with a large initial letter),
the date it was added and a link to it in Notion. **Previous / Next** (or the
← → keys) step through the books of the same constellation (on the map) or of
the shelf as filtered. Close it with **Back to constellation**, ×, Esc, or a
click outside it. From the shelf, **Find in the constellation** takes you to
the book on the map.

**On a phone** the map is laid out to suit the tall screen, a strip of covers
runs along the bottom (tap one to open it), and the index and search open as
a sheet from the **Index & search** button.

## How your Notion fields shape the sky

| Field | On the map |
| --- | --- |
| Title | The star's label (and its name in the search) |
| Genre | Its constellation. A new genre in Notion becomes a new constellation. Its colour in Notion picks the constellation's accent colour (purple → lavender, orange → amber…) |
| Author | Books by the same author get a dotted lavender arc between them, across constellations if needed (one after another, never all to all) |
| Rating | How big and bright its glow is, and its Greek letter: in each constellation the highest-rated book is **α** (alpha), the next **β**, then γ, δ… just as astronomers name stars by brightness. "α Telescopii" is the brightest star of Telescopium |
| Cover Image | The floating cover. Without one, a cloth-bound cover with a gold star is drawn |
| Review | The text on the book's page |

Books without a rating still glow (a middling light), books without a review
say so gently, and books without a genre gather in a constellation called
*Nebula Incognita*.

Each genre gets a real (or historical) constellation whose meaning suits it:
science fiction is *Telescopium*, the far-seeing glass; fantasy, *Draco* the
dragon; memoirs, *Cygnus* the swan; fiction, *Pegasus* the winged horse;
mysteries, *Lynx* (named because you need a lynx's eyes to see it)… The list
is `LORE` in `sky.ts`; a genre that matches none of it gets a spare name.

**Stable positions.** Nothing is random: every "random" choice comes from the
book's Notion id, so each star lands in the same place on every refresh and
every computer. Books are placed oldest first, so a new book becomes a new
star at the end of its constellation. (The whole figure may turn a little to
fit its new shape.) Genres are numbered I, II, III… in the order they first
appeared, so a new genre doesn't renumber the others.

## Your Notion database

The database needs these properties. Names are matched without caring about
upper or lower case.

| Property | Notion type | Notes |
| --- | --- | --- |
| Title | Title | Every database has one. It's found automatically, whatever it's called. |
| Author | Text | A Select or Person works too. |
| Genre | Select | The option's colour is used on the page. |
| Cover Image | Files & media | Upload a picture or paste a link. If it's empty, the page's own cover ("Add cover" in Notion) is used. |
| Rating | Number | Out of 5. Halves work: 4.5 shows four and a half stars. |
| Review | Text | Line breaks are kept. |

If your properties have different names, change `PROPERTY_NAMES` near the top
of `notion.ts`. The page also warns you if it can't find one, and lists the
names your database actually has.

## Setup (one time)

The page needs two things from Notion: a **token** (a password that lets this
prototype read from Notion) and the **database's link**. Both go in
`.env.local`, which is never uploaded to GitHub.

### 1. Create a connection and copy its token

1. Open Notion's Developer portal: <https://app.notion.com/developers/connections>.
   (You need to be the owner of the workspace.)
2. In the **Build** section, choose **Internal connections**, then
   **Create a new connection**. Name it "My bookshelf" and pick your workspace.
3. On the **Configuration** tab, make sure **Read content** is allowed. This
   prototype only reads, so it doesn't need anything else.
4. Copy the **API token** from the same tab.

### 2. Let the connection see your database

A new connection can't see any pages until you share them with it.

1. Open your reading-list database in Notion (the database itself, not a
   page that shows a linked copy of it).
2. Click **•••** (top right) → **Connections** → **+ Add connection**.
3. Choose "My bookshelf".

### 3. Copy the database's link

In the database, click **•••** → **Copy link**. The page works out the
database ID from it. (A bare ID, or a data source ID from
"Copy data source ID", works too.)

### 4. Add both to `.env.local`

Open `.env.local` in the project's top folder (next to `package.json`;
create it if it doesn't exist) and add two lines. Paste straight after each
equals sign, with no spaces or quotes:

```
NOTION_TOKEN=paste_the_token_here
NOTION_DATABASE_ID=paste_the_link_here
```

(`NOTION_API_KEY` works instead of `NOTION_TOKEN` too: that's the name
Notion's own examples use.) `NOTION_DATABASE_ID` must be the database's link
or its 32-character ID, not its name.

Save, then open <http://localhost:3000/prototypes/my-bookshelf>. If the page
still shows the setup steps, stop the dev server (Ctrl+C) and run
`npm run dev` again.

### Alternative: a personal access token

Instead of a connection, you can create a **personal access token** at
<https://www.notion.so/developers/tokens> (**New token**, with the
**Notion API** capability) and use it as `NOTION_TOKEN`. You then don't need
step 2, because it can see everything *you* can see. That's handy for trying
things out. A connection is the safer choice if you publish the site,
because it can only see the one database you shared with it. Personal access
tokens also expire (after a year at most).

## How it works

```
Notion ──▶ notion.ts (server, uses the token) ──▶ page.tsx ──▶ Library.tsx (browser)
                                                                 ├─ SkyMap.tsx     the star map
                                                                 ├─ Bookshelf.tsx  the grid
                                                                 └─ BookFolio.tsx  a book's page
```

- **The token stays on the server.** `page.tsx` is a *server component*: it
  runs on the server, never in the visitor's browser. It calls `getShelf()`
  from `notion.ts`, which reads `NOTION_TOKEN` from `.env.local`. Only the
  finished list of books is sent to the browser. (Since v5.27, the Notion SDK
  even refuses to use a token inside a browser.)
- **Databases and data sources.** Since 2025, a Notion database is a
  container holding one or more *data sources* (the tables with the rows).
  So `notion.ts` asks for the database first, to find its data source, then
  queries that data source for its rows. It uses the **Notion API version
  2026-03-11** through Notion's official JavaScript SDK, `@notionhq/client`.
- **All the books.** Notion sends at most 100 rows per request.
  `collectPaginatedAPI` keeps asking for the next batch until it has them all.
- **Fresh within a minute.** `revalidate = 60` in `page.tsx` means the page
  fetches from Notion at most once a minute, and serves the saved copy in
  between. (In `npm run dev`, every refresh fetches fresh books.) While it
  waits, `loading.tsx` shows a small constellation drawing itself; if
  something unexpected breaks, `error.tsx` offers to try again.
- **From books to a sky** (`sky.ts`, plain arithmetic, no React):
  `catalogue()` groups the books into constellations and gives each book its
  letter and brightness; `chart()` draws each constellation like joining the
  dots (each new book steps out from an earlier star, turning a little, never
  crossing a line or crowding a star), turns it to suit the screen, then
  places the constellations along a spiral so they spread evenly.
- **The map is SVG + HTML** (`SkyMap.tsx`). The lines, regions, names and the
  faint coordinate grid are one `<svg>`; each book is a real `<button>`, so
  Tab, Enter and screen readers work. Everything sits inside one "world"
  element that the camera (`camera.ts`) moves with a single CSS transform,
  `translate(x, y) scale(k)`, so dragging and zooming stay smooth without
  React redrawing anything.
- **Gliding.** `flyTo()` in `camera.ts` follows the van Wijk & Nuij
  "smooth zoom and pan" path: on a long journey it zooms out a little, moves,
  and zooms back in, so the sky never blurs past.
- **Dragging vs clicking.** A press only becomes a drag after the pointer has
  moved 6 pixels, so clicking a book never nudges the map, and a drag that
  starts on a book moves the map without opening the book.
- **The cover's flight** (`BookFolio.tsx`) is a *FLIP* animation: measure the
  small cover, open the page, measure the big cover, then animate the big one
  from the small one's place to its own.
- **The night sky** (`Starfield.tsx`) is one `<canvas>` with a few hundred
  stars in three layers of depth, drawn at most 30 times a second.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | The page (runs on the server): reads the books, and shows the library or explains what's wrong |
| `notion.ts` | Everything that talks to Notion: finding the database, reading the rows, turning them into books |
| `books.ts` | The `Book` type shared by the other files |
| `sky.ts` | Constellations, names, colours, letters, and where every star goes |
| `camera.ts` | Panning, zooming and gliding the map |
| `Library.tsx` | The two views, the view switch, and the state they share |
| `Masthead.tsx` | The title, motto, catalogue facts and key |
| `SkyMap.tsx` | The star map: drawing, stars, tooltip, dragging, zoom buttons, the phone strip |
| `AtlasIndex.tsx` | The index of constellations, the search, and the key to the chart |
| `Bookshelf.tsx` | The bookshelf: genre filter, search, sort, covers with the tilt |
| `BookFolio.tsx` | A book's page, with the cover's flight |
| `Starfield.tsx` | The twinkling, drifting sky behind everything |
| `parts.tsx` | Covers (and drawn covers), rating stars, the reduced-motion helper |
| `fonts.ts` | Cormorant Garamond, the literary serif |
| `loading.tsx`, `error.tsx` | Shown while Notion is being read, and if something breaks |
| `sample-books.ts` | Made-up books for "Preview with sample books", shown only before Notion is connected |
| `styles.module.css` | The palette (top of the file), the title, covers, stars, setup and loading screens |
| `sky.module.css` | The star map and its panels |
| `shelf.module.css` | The bookshelf |
| `folio.module.css` | A book's page |

## Things to tweak

- **Property names:** `PROPERTY_NAMES` in `notion.ts`.
- **Rating scale:** `RATING_OUT_OF` in `books.ts` (for example 10).
- **Constellation names:** `LORE` (and `SPARE_LORE`) in `sky.ts`. Add a line
  with a pattern for your genre, a Latin name, its genitive (the form used in
  star names, like *Lyrae* for *Lyra*) and an epithet.
- **Constellation colours:** `ACCENTS` in `sky.ts`, one per Notion colour.
- **Spacing of the sky:** `STEP` (distance between joined stars), `MIN_GAP`,
  `REGION` and `GAP` near the top of the chart section in `sky.ts`.
- **Glow by rating:** `--glow` and `--shine` in `StarButton` in `SkyMap.tsx`.
- **Palette:** the variables at the top of `styles.module.css`
  (`--navy`, `--gold`, `--ivory`, `--lavender`…).
- **How fresh the data is:** `revalidate` in `page.tsx`, in seconds. Keep it
  well under an hour, because of the expiring cover links.
- **How many stars twinkle, how fast the sky drifts:** `build()` and `draw()`
  in `Starfield.tsx`.
- **How often sparks travel along the lines:** `cycle` in `SkyDrawing` in
  `SkyMap.tsx`.

## Accessibility

- Every book is a real button: **Tab** moves from star to star (the map
  glides to keep the focused book on screen and shows its card), **Enter**
  opens it. With the map focused, the **arrow keys** move it, **+ / −** zoom,
  **0** shows everything, **Esc** puts down a found book.
- Screen readers hear each book's title, author, genre, rating and star name,
  and the number of books when a constellation is chosen.
- **Less motion:** if your device is set to reduce motion, the twinkling,
  drifting, floating, sparks and glides all stop. Everything still works; it
  just changes instantly.
- On phones, every book is also reachable from the strip of covers and the
  index, without needing to drag or pinch.

## Publishing (for example on Vercel)

`.env.local` stays on your computer, so a published copy doesn't have your
token. Add `NOTION_TOKEN` and `NOTION_DATABASE_ID` in your hosting service's
settings (on Vercel: **Settings → Environment Variables**), then redeploy.

## Troubleshooting

| What the page says | What to do |
| --- | --- |
| "Connect your Notion database" | `.env.local` is missing `NOTION_TOKEN` or `NOTION_DATABASE_ID` (the page says which). Follow the setup steps. |
| "Notion didn't accept the token" | The token is mistyped, has spaces or quotes around it, was refreshed in Notion, or (for a personal access token) has expired. |
| "Notion can't find the database" | The database isn't shared with your connection yet (setup step 2), or the link is to a linked copy rather than the database itself. |
| "The connection isn't allowed to read" | Allow **Read content** on the connection's Configuration tab. |
| "That doesn't look like a database link" | Paste the full link from **•••** → **Copy link**. |
| "Heads up: a property wasn't found" | A property name doesn't match. Open the note to see your database's property names, then rename it in Notion, or change `PROPERTY_NAMES` in `notion.ts`. |
| "The sky is still dark" | The database is connected but has no books yet. Add one in Notion and refresh. |
| "The sky has clouded over" | Something unexpected broke the page. Press **Try again**; the browser's console shows the error. |
| A new book or genre doesn't appear | Wait a minute and refresh (the page reads Notion at most once a minute). |
| Some covers are drawn instead of showing the picture | Their Cover Image is empty, or the picture's link stopped working. Refresh the page to get fresh links. |

The exact error from Notion is also printed in the terminal running
`npm run dev`, starting with `[my-bookshelf]`.

## Documentation used

- [Notion API changelog](https://developers.notion.com/page/changelog) and [versioning](https://developers.notion.com/reference/versioning)
- [Query a data source](https://developers.notion.com/reference/query-a-data-source) and [Retrieve a database](https://developers.notion.com/reference/retrieve-a-database)
- [Page property values](https://developers.notion.com/reference/page-property-values) and [File objects](https://developers.notion.com/reference/file-object) (the one-hour links)
- [Internal connections](https://developers.notion.com/guides/get-started/internal-connections) and [Personal access tokens](https://developers.notion.com/guides/get-started/personal-access-tokens)
- [Notion SDK for JavaScript](https://github.com/makenotion/notion-sdk-js)
- J. van Wijk & W. Nuij, "Smooth and efficient zooming and panning" (IEEE InfoVis 2003), the path used by `flyTo()`
- [FLIP animations](https://aerotwist.com/blog/flip-your-animations/) by Paul Lewis
