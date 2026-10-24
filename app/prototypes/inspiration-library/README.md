# Inspiration Library

A personal **Are.na / Pinterest**. Make an account, create boards, and save
images and links into them, each with a title and a note. Boards are private
until you make one public; then anyone with the link can look at it (but not
change it).

- **Accounts:** [Better Auth](https://better-auth.com) (email and password,
  plus optional **Continue with Google**)
- **Database:** your Supabase Postgres database, through the `pg` library
  (no Supabase Auth, no `@supabase/supabase-js`)
- **Address:** <http://localhost:3000/prototypes/inspiration-library>

> **Status:** ready to use. `.env.local` is filled in, and the database is
> set up: all eight tables were created in Supabase from the migration files
> in [`db/migrations/`](../../../db/migrations) (23 October 2026). Run
> `npm run dev` and open the address above. The **Setup** steps below are
> what was done, kept for reference, for the live site, or for a new
> Supabase project.

## What you can do

| Page | Address | Who sees it |
| --- | --- | --- |
| Home | `/prototypes/inspiration-library` | Signed out: a short landing page with **Sign in** and **Sign up**. Signed in: a grid of your boards, **+ New board**, and a link to your public profile (or a box to choose a username, if you don't have one yet, for example after signing up with Google). |
| Sign up / Sign in | `…/sign-up`, `…/sign-in` | Anyone. Signed-in visitors are sent straight on. Sign up asks for a **username**; sign in takes your email **or** your username. |
| The bookmarklet | `…/bookmarklet` | Anyone: a button to drag to your bookmarks bar, with instructions. |
| Save to a board | `…/save?url=…&title=…` | The small window the bookmarklet opens. Signed in: choose a board, check the title and link, add a note, **Save**. Signed out: a **Sign in** link that comes back here. |
| A profile | `…/u/<username>` | Anyone, signed in or not: that person's **public** boards, and nothing else (no private boards, name or email). Unknown usernames show "No one here". |
| New board | `…/boards/new` | Signed in only (others are sent to sign in first). |
| A board | `…/boards/<id>` | **Its owner:** the items in a masonry grid, a form to add an item (a picture uploaded from your computer or an image address, a link, a title, a note), and **Edit** / **Delete** for the board and each item. An item can be on **several boards**: tick them under **Boards** when editing it. **Remove from this board** takes it off one board; on its last board, the button is **Delete item**. **By colour** (`?view=color`) arranges the board as a gradient by each picture's dominant colour; anyone who can see the board can use it. **Anyone else:** a *public* board without any editing buttons, even when signed out. A *private* board shows **"There's no board here"**, the same page as a board that doesn't exist. |

**Sign out** is in the top right of every page while you're signed in.

## Setup (one time)

### 1. The three settings in `.env.local`

These are already in `.env.local` (in the project's top folder, next to
`package.json`), which git never uploads:

```
BETTER_AUTH_SECRET=…   # already made for you, with `openssl rand -base64 32`
BETTER_AUTH_URL=http://localhost:3000
DATABASE_URL=…         # your Supabase connection string (step 2)
```

- **`BETTER_AUTH_SECRET`** is a long random password Better Auth uses to
  sign the sign-in cookie, so nobody can make a fake one. Don't share it or
  change it (changing it signs everyone out). To make a new one, run
  `openssl rand -base64 32` in Terminal.
- **`BETTER_AUTH_URL`** is the address the app runs at.

### 2. Connect your Supabase database

1. In [Supabase](https://supabase.com/dashboard), open your project (or
   create one; remember the **database password** you choose).
2. Click **Connect** at the top of the project.
3. Under **Connection String**, pick the **Session pooler** one. It looks like
   `postgresql://postgres.abcd1234:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`.
   (Avoid the "Direct connection": it only works on networks with IPv6.)
4. Paste it into `.env.local` straight after `DATABASE_URL=`, with no spaces
   or quotes, and replace `[YOUR-PASSWORD]` (square brackets included) with
   your database password. Save the file.

**Symbols in the password?** Characters like `@ # / ? % : &` mean something
special inside an address, so they have to be "percent-encoded": `@` becomes
`%40`, `#` → `%23`, `/` → `%2F`, `?` → `%3F`, `%` → `%25`, `:` → `%3A`,
`&` → `%26`. The easiest way round it: reset the database password
(**Project Settings → Database → Reset database password**) to one made of
letters and numbers only, and make it long.

Never paste the connection string into a chat, an issue or a commit: it
contains your password.

### 3. Create the tables (done)

Your Supabase project already has every table. They were created from nine
**migration files**: small SQL files, applied once each, in order, that
together record every change made to the database. They live in
[`db/migrations/`](../../../db/migrations), in the project's top folder:

| File | What it does |
| --- | --- |
| `0001_better_auth.sql` | Better Auth's tables (`user`, `session`, `account`, `verification`, `rateLimit`). Generated by Better Auth's own CLI (`npx auth@1.7.12 generate`), so they match exactly what it expects. |
| `0002_boards_and_items.sql` | Your tables, `boards` and `items`, with their indexes. |
| `0003_row_level_security.sql` | Switches on Row Level Security for all seven tables. |
| `0004_deny_data_api.sql` | Explicit "no access" policies for Supabase's Data API, which cleared the security advisor's only finding. |
| `0005_uploaded_images.sql` | The private `item-images` Storage bucket (5 MB, images only) and the `image_path` column on `items` (Setup, step 6). |
| `0006_board_items.sql` | The `board_items` join table, so an item can be on several boards. Copies each item's board into it, then removes `items.board_id`. |
| `0007_board_items_indexes.sql` | Indexes for `board_items`' two "same owner" foreign keys, from Supabase's performance advisor. |
| `0008_dominant_color.sql` | The `dominant_color` column on `items`: each picture's most common colour, for the **By colour** view. |
| `0009_usernames.sql` | `username` (unique, lower case) and `displayUsername` on Better Auth's `user` table, generated by its CLI for the username plugin, plus a format check. |

They were applied with the Supabase MCP, and Supabase lists them under
**Database → Migrations**. Don't run them again on this project: the tables
already exist.

**Setting up a new Supabase project** (for example, a copy for a classmate):
apply the nine files in order, either by asking your AI agent to apply them
with the Supabase MCP, or by pasting each into Supabase's **SQL Editor** →
**New query** → **Run**. Or run [`schema.sql`](./schema.sql) (in this folder),
which is the same SQL in one file. Then check **Advisors → Security
Advisor** in Supabase: it should find nothing.

### 4. Try it

Stop the dev server if it's running (Ctrl+C), run `npm run dev` again (it
only reads `.env.local` when it starts), and open
<http://localhost:3000/prototypes/inspiration-library>. Click **Sign up**,
make a board, and paste an image address. (On most websites: right-click a
picture → **Copy Image Address**.)

To check that Better Auth is running, open
<http://localhost:3000/api/auth/ok>: it should say `{"ok":true}`.

### 5. Sign in with Google (optional)

The sign in and sign up pages show **Continue with Google** as soon as two
settings are filled in: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. They're
already in `.env.local`, empty. Until you fill them in, the button stays
hidden and email and password work as before.

You get both from **Google Cloud Console**. Before you start, find your live
site's address: in Vercel, open the project → **Settings → Domains**. It looks
like `https://your-project.vercel.app`. Below it's written as
`https://YOUR-SITE.vercel.app`: replace that with yours.

**a. Make a Google Cloud project**

1. Go to <https://console.cloud.google.com> and sign in with your Google
   account.
2. Click the project picker at the top left → **New project**. Name it
   `Inspiration library` → **Create**. Make sure it's selected in the project
   picker afterwards.

**b. The OAuth consent screen** (what people see when Google asks "Sign in to
Inspiration library?")

1. Open the menu (☰) → **APIs & Services** → **OAuth consent screen**. (Google
   now calls this area **Google Auth Platform**.) Click **Get started**.
2. **App information:** App name `Inspiration library`, and your email as the
   **User support email** → **Next**.
3. **Audience:** choose **External** (anyone with a Google account, not only
   your school's) → **Next**.
4. **Contact information:** your email → **Next**.
5. Tick that you agree to Google's API Services User Data Policy →
   **Continue** → **Create**.
6. **Branding** (left menu) → **Authorized domains** → **Add domain**: your
   live site's domain *without* `https://`, for example
   `YOUR-SITE.vercel.app` → **Save**. (Not needed for `localhost`.)
7. **Audience** (left menu): your app starts in **Testing**, where only
   **test users** can sign in. Under **Test users** → **Add users**, add your
   own Google email and anyone else who should try it (up to 100) → **Save**.
   When anyone should be able to sign in, click **Publish app** there. The
   app only asks for name, email and profile picture, which Google calls
   "non-sensitive", so publishing doesn't need Google's review.

You don't need to add any scopes under **Data Access**: Better Auth asks for
`openid`, `email` and `profile` itself, and those are always allowed.

**c. The OAuth client** (the ID and secret)

1. **Clients** (left menu) → **Create client**.
2. **Application type:** **Web application**. **Name:**
   `Inspiration library web`.
3. **Authorized JavaScript origins** → **Add URI**, once for each:
   ```
   http://localhost:3000
   https://YOUR-SITE.vercel.app
   ```
4. **Authorized redirect URIs** → **Add URI**, once for each:
   ```
   http://localhost:3000/api/auth/callback/google
   https://YOUR-SITE.vercel.app/api/auth/callback/google
   ```
   This is where Google sends people back after they've chosen their
   account. It must match **exactly**: `http` (not `https`) for localhost,
   port `3000`, no slash at the end. Better Auth builds it from
   `BETTER_AUTH_URL` + `/api/auth/callback/google`, so each address here must
   match a `BETTER_AUTH_URL` you use.
5. **Create**. A box shows the **Client ID** and **Client secret**. Copy the
   secret now (or click **Download JSON**): Google may not show it again. If
   you lose it, open the client and **Add secret** to make a new one.

**d. Paste them in**

1. Open `.env.local` and paste the Client ID straight after
   `GOOGLE_CLIENT_ID=`, and the secret after `GOOGLE_CLIENT_SECRET=`. No
   spaces, no quotes. Save.
2. Restart the dev server (Ctrl+C, then `npm run dev`).
3. Open the sign in page: **Continue with Google** is there.

Keep the secret private: never paste it into a chat, an issue or a commit.
The Client ID isn't secret on its own, but keep them together anyway.

Changes in Google Cloud Console can take a few minutes (sometimes longer) to
start working. If Google says **"redirect_uri_mismatch"**, the address in
step c.4 doesn't match exactly: the error page shows the address Better
Auth sent, so copy that one in.

**Already have a password account with the same email?** Signing in with
Google then says to use your password instead. Better Auth only joins a
Google sign-in to an existing account when that account's email has been
verified, and this app doesn't send verification emails. Otherwise, someone
could sign up with *your* email first, and later share your account when you
use Google.

### 6. Upload images from your computer (optional)

The item form shows an **Upload from your computer** tab as soon as two
settings are filled in. They're already in `.env.local`:

```
SUPABASE_URL=https://gufgkpvzhvulxtbpsgll.supabase.co   # filled in: your project's address
SUPABASE_SECRET_KEY=                                   # empty: you paste this in
```

The bucket, `item-images`, already exists (migration 0005). To get the key:

1. In [Supabase](https://supabase.com/dashboard), open your project →
   **Project Settings** (the cog, bottom left) → **API Keys**.
2. Under **Secret keys**, click the copy button next to the `default` key
   (it starts with `sb_secret_`). If there isn't one, click **Add new secret
   key**, name it `inspiration-library`, and copy that. (Older projects show
   a `service_role` key under **Legacy API Keys**: that works too.)
3. Paste it into `.env.local` straight after `SUPABASE_SECRET_KEY=`, with no
   spaces or quotes. Save.
4. Restart the dev server (Ctrl+C, then `npm run dev`).

**This key opens all of your Supabase project**, skipping every access
rule. That's why it only ever lives on the server: its name doesn't start
with `NEXT_PUBLIC_`, so Next.js never sends it to the browser. Never paste it
into a chat, an issue or a commit. If it leaks, delete it on the same page
and make a new one.

**How uploading works**

1. You choose a picture. The browser checks it's a JPEG, PNG, WebP, GIF or
   AVIF of 5 MB or less.
2. It asks the server for a **one-time upload link**
   (`startImageUploadAction` in `actions.ts`). The server checks you're
   signed in and the board is yours, picks the file's path,
   `<your user id>/<board id>/<random id>.jpg`, and asks Supabase for a link
   that can upload exactly that one file.
3. The browser sends the picture **straight to Supabase** with that link, so
   big files never pass through the app (Next.js only accepts 1 MB in a
   form, and Vercel 4.5 MB).
4. When you press **Save**, only the path is sent. The server checks again
   that it's in *your* folder for *this* board, and that the file is really
   there, before saving it in `items.image_path`.

**Showing pictures:** the bucket is private, so there are no public
addresses. Each time a board is shown, the server makes a **signed link** for
each picture: an address with a code in it that works for one hour. It only
does this after checking the visitor may see the board, so pictures on a
private board are only ever linked for you. Anyone can look at a public
board's pictures, just like its other items.

**Deleting:** deleting an item deletes its picture, and replacing or removing
a picture deletes the old file. Deleting a board deletes the pictures of the
items that were only on that board, plus any file in its folder that no item
uses (pictures uploaded but never saved). A picture's folder is the board it
was uploaded to; an item that's also on other boards keeps its picture.

**Why not Supabase's own Storage rules?** Storage's access rules
("policies") can only recognise people signed in with **Supabase Auth**, and
this app uses Better Auth. So the bucket has no rules at all, which means
Supabase's public API can't read, upload or delete anything in it. The only
way in is the app's server, with the secret key, after it has checked who
you are. The owner-only rule lives in `lib/storage.ts` (`isOwnImagePath`) and
`actions.ts`.

## How it works

```
Browser                               Server (Next.js)                       Supabase Postgres
───────                               ────────────────                       ─────────────────
Sign in / Sign up form ──fetch──▶ /api/auth/[...all] ─▶ Better Auth ─┐
(AuthForm.tsx, auth-client.ts)    (app/api/auth/…/route.ts)          │
        ◀── session cookie ───────────────────────────────────────── │
                                                                     ├─ pg Pool ─▶ user, session, account…
Pages (page.tsx …) ─────────────▶ getSession() ─▶ Better Auth ───────┤  (lib/db.ts)
Forms (BoardForm, ItemForm) ────▶ server actions (actions.ts) ───────┘            boards, items
                                    └─ lib/boards.ts: SQL with "user_id = <you>"
```

### Accounts (Better Auth)

- **`lib/auth.ts`** sets up Better Auth: email and password (at least 12
  characters), sessions in the database, rate limits, and the `pg` Pool
  from `lib/db.ts`.
- **`app/api/auth/[...all]/route.ts`** gives Better Auth its web address. The
  `[...all]` folder means "anything under `/api/auth/`", such as
  `/api/auth/sign-in/email`. It's the only file outside this folder,
  because Better Auth lives at `/api/auth`.
- **`lib/auth-client.ts`** is the browser side. The forms call
  `authClient.signUp.email(…)`, `authClient.signIn.email(…)` and
  `authClient.signOut()`.
- When you sign in, Better Auth checks the password against the **hash**
  stored in the `account` table (passwords are hashed with *scrypt*, never
  stored as they are), creates a row in `session`, and puts that session's
  token in a cookie. The cookie is **signed** (with `BETTER_AUTH_SECRET`) and
  **httpOnly**, so JavaScript in the page can't read or change it.

### Usernames and profiles

Usernames come from Better Auth's
[username plugin](https://better-auth.com/docs/plugins/username) (in
`lib/auth.ts`, and `usernameClient()` in `lib/auth-client.ts`). It adds two
columns to the `user` table (migration 0009):

- `username`: always stored in **lower case**, and **unique**, so `Mia` and
  `mia` are the same person and nobody can take yours.
- `displayUsername`: how you typed it, like `Mia_Studio`, for showing.

The plugin checks every new or changed username on the server: 3–30
characters, only letters, numbers, `_` and `.` (so it's always safe in a web
address), and not taken. The database checks the format again. It also adds
**sign in with username** (`/api/auth/sign-in/username`, rate-limited like
email sign-in).

Accounts made before usernames existed, and Google sign-ups, start without
one. The home page then shows a **Choose a username** box
(`UsernameForm.tsx`, which calls `authClient.updateUser({ username })`).
Changing your username changes your profile's address, so old links to it
stop working.

Your profile, at `/prototypes/inspiration-library/u/<username>`, lists
only your **public** boards. It lives inside this prototype's folder, like
every other page, so it can't clash with the rest of the workshop site.

### The bookmarklet

A **bookmarklet** is a bookmark whose address is a tiny program
(`javascript:…`) instead of a web page. Clicking it runs the program on
whatever website you're looking at. Ours (`BookmarkletLink.tsx`) reads the
page's address and title and opens our **Save to a board** window
(`save/page.tsx`) with them:

```
any website ──click bookmark──▶ small window: …/save?url=<page address>&title=<page title>
                                  │  choose a board, edit, add a note, Save
                                  ▼
                                saveLinkAction (actions.ts) ─▶ a new item on your board
```

- **Get it** at `/prototypes/inspiration-library/bookmarklet` (linked from
  your library's home page): drag the orange button to your bookmarks bar.
  Each copy of the app makes a bookmarklet for itself
  (`window.location.origin`), so the one from `localhost` saves to your
  computer's copy, and the one from your Vercel site saves to the live one.
- **React and `javascript:` links.** React refuses to put a `javascript:`
  address in a link, because that's a common way to sneak code into a page.
  Our bookmarklet's code is fixed text, so `BookmarkletLink.tsx` sets it on
  the link itself, once the page has loaded.
- **The address and title only fill in the form.** They come from another
  website, so nothing is saved until you choose a board and press **Save**,
  and the server checks them like any other item (an `http(s)` link, the
  length limits, and a board that's yours). React shows the title as plain
  text, so a page title with HTML in it can't do anything.
- **Signed out?** The window offers **Sign in** and comes back to the same
  window afterwards (`safeNext` in `lib/paths.ts` only allows our own pages).
- It remembers the board you saved to last, in your browser
  (`localStorage`).
- **No framing.** `next.config.ts` tells browsers that this prototype's
  pages may never be shown inside another website (`frame-ancestors 'none'`
  and `X-Frame-Options: DENY`). Otherwise a site could load the Save window
  invisibly over its own page and trick you into clicking it
  ("clickjacking"). Only this prototype's pages get these headers.
- It saves links only, not pictures. Pop-up blockers can stop the window:
  allow pop-ups for the website you're on. Phones have no bookmarks bar,
  so it's for computers.

### Checking who you are, on the server, every time

Every page and every server action starts by asking Better Auth for the
session (`getSession()` / `requireUser()` in `lib/session.ts`), which reads
the cookie and looks the session up in the database.

**The user id always comes from the session, never from the browser.**
Anyone can edit what their browser sends (a hidden field, the address, a
request made by hand), so a form saying "I'm user 42" proves nothing. The
signed session cookie does.

### The rules, and where they're enforced

| Rule | How |
| --- | --- |
| Only the owner can create, edit or delete boards and items | Every change in `lib/boards.ts` includes `where … and user_id = $2`, with `$2` = the id from the session. For someone else's board, the query matches nothing, so nothing changes. Adding an item copies the owner from the board row itself (`insert … select … from boards where id = $1 and user_id = $2`). |
| Your items can only be on your boards | `board_items` stores the owner (`user_id`) next to the board and the item, and its two foreign keys, `(board_id, user_id)` → `boards` and `(item_id, user_id)` → `items`, make Postgres itself refuse a row where they don't all match. The **Boards** checklist only lists your boards, and visitors to a public board never see which other boards an item is on. |
| Private boards are only visible to their owner | `findViewableBoard()` asks for `where id = $1 and (is_public or user_id = $2)`. Anyone else's private board comes back as *nothing*, exactly like a board that doesn't exist, and the page calls `notFound()` → `not-found.tsx` (status 404). Even the browser tab title stays generic. |
| Only the owner can upload or delete pictures | Upload links are only made for your own boards (`ownsBoard`), and always for a path in your folder, `<your id>/<board id>/…`. A path sent with a form is only saved if it's in your folder for that board (`isOwnImagePath`) and the file exists. Files are only deleted after the item or board was deleted with `user_id = <you>`. Supabase's public API can't reach the private bucket at all. |
| Profiles only show public boards | `listPublicBoards()` in `lib/boards.ts` asks for `where user_id = $1 and is_public`, so private boards never reach the page, not even as a count. `findProfile()` only returns the id and username, never the name or email. "by @username" only appears on public boards. |
| Public boards: anyone can look, without edit buttons | The editing tools are only drawn when `session.user.id === board.userId`. And even if someone rebuilt the forms by hand, the server actions would refuse (see the first rule). |

### The database

- **`lib/db.ts`** makes one `pg` **Pool**: a few open connections, lent out
  one query at a time, shared by Better Auth and our own queries. It reads
  `DATABASE_URL` and encrypts the connection (TLS).
- **The tables** (created from `db/migrations/`, and gathered in one file in
  `schema.sql`):
  - `boards`: `id` (uuid), `user_id`, `title`, `description`, `is_public`
    (default `false`), `created_at`
  - `items`: `id` (uuid), `user_id`, `image_url`, `image_path`, `link_url`,
    `title`, `note`, `dominant_color`, `created_at`
  - `board_items`, the **join table**: `board_id`, `item_id`, `user_id`,
    `added_at`. One row per (board, item) pair, so an item can be on many
    boards and a board has many items ("many to many"):

    ```
    boards                  board_items                    items
    ┌──────────────┐        ┌────────────────────┐         ┌──────────────┐
    │ id           │◀───────│ board_id           │         │ id           │
    │ title        │        │ item_id            │────────▶│ image_url /  │
    │ is_public …  │        │ user_id (owner)    │         │ image_path   │
    └──────────────┘        │ added_at           │         │ title, note… │
                            └────────────────────┘         └──────────────┘
         one board ──< many rows                many rows >── one item
    ```

    Its key is `(board_id, item_id)`, so an item can only be on a board once.
  - **Foreign keys**: `board_items` points to `boards` and `items` with
    `on delete cascade`, so deleting a board removes its rows (the app then
    deletes the items that were on no other board), and deleting an item
    removes it from every board. `user_id` points to Better Auth's `user`
    table. (It's `text`, not `uuid`, because Better Auth's ids are random
    text.)
  - **Indexes** on `boards.user_id`, `items.user_id` and `board_items`, so
    "my boards", "this board's items, newest first" and "the boards this
    item is on" are quick however much you save.
  - **Transactions**: changes that need several queries (like "take it off
    this board, and delete it if that was its last") run as one transaction
    in `lib/boards.ts`, so they happen completely or not at all.
  - `check` rules: a title is required, lengths are limited, and every item
    needs a picture or a link.
  - **Row Level Security** switched on for every table, plus a
    "No Data API access" policy that refuses every row to the `anon` and
    `authenticated` roles, whose table permissions are also revoked. That
    locks Supabase's automatic Data API out of them (otherwise anyone with
    your project's public "anon" key could read the `user` table through
    it). This app connects directly as the tables' owner, so it's not
    affected.
- **SQL injection:** values always go in as `$1, $2…` placeholders, never
  pasted into the SQL text.

### Safe to build before it's set up

Better Auth and the database pool are only created the first time a page
needs them (`getAuth()`, `getPool()`), never when a file is loaded. Each page
first calls `checkSettings()` (`lib/settings.ts`) and, if something is
missing, shows how to fix it. So `npm run build`, and every Vercel site that
doesn't have these settings, still builds and runs. If the database refuses
(no tables yet, wrong password, paused project…), `lib/problems.ts` works
out why, and the page explains it.

### Dominant colour and the "By colour" view

When you save an item with a picture, the server works out the picture's
**dominant colour** (`lib/dominant-color.ts`) and stores it in
`items.dominant_color` as a hex code like `#d4532f`:

1. It gets the picture: from your private bucket if you uploaded it, or
   by downloading the image address.
2. It shrinks it to at most 64 × 64 pixels with
   [sharp](https://sharp.pixelplumbing.com), which is plenty to judge
   colours.
3. It sorts every pixel into one of 4,096 "buckets" of similar colours,
   skipping see-through pixels.
4. The fullest bucket wins, and its colour is the average of its pixels.

"Dominant" means "covers the most of the picture", so a product shot on a
big white background comes out white. Editing an item only looks again if
the picture changed. If a picture can't be read (some websites refuse
downloads from servers, Wikimedia for example), the item is still saved,
just without a colour.

**By colour** (the switch above a board's items, or `?view=color`) sorts the
items with `sortByColor()` in `lib/color.ts`. It turns each hex code into
**hue** (where it is on the colour wheel), **saturation** (how colourful)
and **lightness**, then lays them out as square tiles in rows:

```
red → orange → yellow → green → blue → purple → pink │ white → grey → black │ no colour
└──────────── colourful: by hue ─────────────────────┘└─ neutrals: by lightness ─┘
```

Greys and near-whites or near-blacks go after the rainbow, because a faint
tint would otherwise drop a white photo among the blues. A strip above the
tiles blends every colour into one gradient. Pointing at a tile shows its
hex code.

**Downloading image addresses safely.** The server downloads an address
*you* typed, so it guards against
[SSRF](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery):
someone typing an address that points inside the server's own network, like
`http://169.254.169.254/`, where cloud servers keep secrets. Every download
uses only `http`/`https` on the normal ports, checks the address the
website's name leads to *at the moment of connecting* (refusing private and
internal ones), follows at most 3 redirects (each checked again), and gives
up after 8 seconds or 10 MB. It also only accepts images, never SVG.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | Home: the landing page, or your boards |
| `sign-in/page.tsx`, `sign-up/page.tsx` | The sign in and sign up pages |
| `boards/new/page.tsx` | Create a board |
| `boards/[boardId]/page.tsx` | A board: the masonry grid, and the owner's tools |
| `actions.ts` | Server actions: create, edit and delete boards and items |
| `not-found.tsx` | "There's no board here" (missing *or* private) |
| `error.tsx` | Shown if something unexpected breaks |
| `AuthForm.tsx` | The sign in / sign up form (browser) |
| `SignOutButton.tsx` | Sign out (browser) |
| `BoardForm.tsx`, `ItemForm.tsx` | The board and item forms (browser), with error messages |
| `ConfirmButton.tsx` | "Are you sure?" before deleting |
| `CopyLinkButton.tsx` | Copy a public board's link |
| `ItemImage.tsx` | An item's picture, with a note if it can't load |
| `SignInLink.tsx` | "Sign in", coming back to the same page |
| `Frame.tsx` | The top bar and footer around every page |
| `SetupNotice.tsx` | "Finish setting up" and database problem cards |
| `lib/auth.ts` | Better Auth's settings (server) |
| `lib/auth-client.ts` | Better Auth in the browser |
| `lib/session.ts` | `getSession()` and `requireUser()` (server) |
| `lib/db.ts` | The `pg` connection pool (server) |
| `lib/boards.ts` | Every query for boards and items (server) |
| `lib/validate.ts` | Checking form fields, including web addresses |
| `lib/settings.ts` | Which settings are missing or mistyped |
| `lib/problems.ts` | Turning database errors into explanations |
| `lib/paths.ts` | The prototype's addresses, and the safe "come back to" check |
| `schema.sql` | Every table in one file, for reading (already set up from `db/migrations/`) |
| `lib/storage.ts` | Uploaded pictures in Supabase Storage: upload links, signed links, deleting (server) |
| `lib/dominant-color.ts` | Finding a picture's dominant colour when it's saved, and downloading image addresses safely (server) |
| `lib/color.ts` | Hex → hue, saturation, lightness, and sorting items into a gradient |
| `bookmarklet/page.tsx` | Get the bookmarklet: the button to drag, and instructions |
| `BookmarkletLink.tsx` | The bookmarklet itself (its `javascript:` code) |
| `save/page.tsx` | The small "Save to a board" window the bookmarklet opens |
| `SaveForm.tsx` | That window's form, and "Saved" with **Close window** |
| `../../../next.config.ts` | Stops this prototype's pages being shown inside other websites |
| `u/[username]/page.tsx` | A public profile: that person's public boards only |
| `u/[username]/not-found.tsx` | "No one here", for unknown usernames |
| `BoardCard.tsx` | A board as a card with preview pictures (home page and profiles) |
| `UsernameForm.tsx` | Choosing or changing your username (home page) |
| `../../../db/migrations/` | The nine migration files that created the database |
| `styles.module.css` | The palette (top of the file), frame, buttons, forms, landing page, boards grid |
| `boards.module.css` | The board page and its masonry grid |
| `../../api/auth/[...all]/route.ts` | Better Auth's web address |

## Security, in short

- **Passwords:** hashed with scrypt by Better Auth, at least 12 characters.
- **Image addresses** are downloaded by the server only to find their
  colour, with SSRF protection: never from private or internal addresses,
  re-checked on every redirect, with time and size limits.
- **Uploaded pictures:** in a private bucket that only the server can reach
  (with `SUPABASE_SECRET_KEY`, which never leaves the server). Uploads only
  go to your own folder, through one-time links. Pictures are shown through
  signed links that expire after an hour. Supabase refuses files over 5 MB
  and anything but JPEG, PNG, WebP, GIF and AVIF (no SVG, which can contain
  code).
- **No framing:** this prototype's pages can't be shown inside another
  website, so nobody can trick you into clicking Save (clickjacking).
- **Profiles** show only public boards and the username: never private
  boards (not even how many), names or emails.
- **Google sign-in:** the client secret stays on the server (no
  `NEXT_PUBLIC_`). A Google sign-in is never joined to an existing password
  account with an unverified email. Error codes in the address are turned
  into our own sentences, never shown as they are.
- **Sessions:** a signed, httpOnly cookie; checked on the server for every
  page and action that touches your data.
- **Other websites can't sign you in or out (CSRF):** Better Auth only
  accepts requests from `BETTER_AUTH_URL`'s address.
- **Rate limits** (on the live site): 5 sign-in attempts and 3 sign-ups per
  minute per IP address, counted in the database, because on Vercel every
  request can land on a different server.
- **Links and pictures** must be `http://` or `https://` addresses, so a
  `javascript:` "link" can't run code for people looking at a public board.
  Pictures load with `referrerPolicy="no-referrer"`, so other websites don't
  see which board they're shown on. Links open with `rel="noopener noreferrer"`.
- **"Come back to" addresses** after signing in (`?next=…`) only go to pages
  of this prototype, never to another website.
- **Supabase's Data API** can't see the tables (Row Level Security).

## Publishing (Vercel)

`.env.local` stays on your computer, so the live site needs the three
settings too. In Vercel, for **each** project that should run the library:

1. **Settings → Environment Variables → Add Environment Variable**. Add
   three; in **Key** the name, in **Value** the value:
   - `BETTER_AUTH_SECRET`: the same kind of long random value (you can
     make a separate one per site with `openssl rand -base64 32`)
   - `BETTER_AUTH_URL`: **that site's own address**, for example
     `https://my-prototypes.vercel.app` (not `localhost`). Sign-in only
     works from this exact address: on preview links Better Auth says
     "Invalid origin".
   - `DATABASE_URL`: the connection string. For Vercel, Supabase recommends
     its **Transaction pooler** string (port `6543`), made for many
     short-lived servers. The Session pooler one works too.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (only for **Continue
     with Google**): the same values as in `.env.local`. Check that the
     site's `https://…/api/auth/callback/google` address is in the Google
     client's **Authorized redirect URIs** (Setup, step 5c).
   - `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (only for uploading pictures):
     the same values as in `.env.local`.
2. **Deployments** → the newest one → **Redeploy** (settings only take
   effect in a new build).

Google sign-in doesn't work on Vercel's **preview** links (the long
addresses for each commit), because they aren't in the Google client's list.
Use the main address.

A site without these settings still builds and shows the "Finish setting
up" card, so the other prototypes are never affected.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| "Finish setting up your library" | A setting is empty or mistyped: the card says which. Fix it in `.env.local`, then restart `npm run dev`. |
| "The database is empty" | Check that `DATABASE_URL` points to the Supabase project with the tables (Supabase → **Table Editor** should list `boards` and `items`). For a new project, apply `db/migrations/` (Setup, step 3), then refresh. Better Auth checks its tables when it starts and remembers the answer; the app starts a fresh copy after this message, but if it still shows after a second refresh, restart `npm run dev` (or redeploy on Vercel). |
| "Supabase didn't accept the password" | Copy the connection string again and replace `[YOUR-PASSWORD]`, brackets included. Percent-encode symbols, or reset the password to letters and numbers. |
| "Couldn't reach the database" | Use the **Session pooler** string, not "Direct connection". Free projects pause after a week unused: click **Restore** in Supabase. |
| "The secure connection didn't work" | Remove `?sslmode=…` from the end of `DATABASE_URL`. |
| Sign up says the server couldn't create your account | Usually `DATABASE_URL` points to a project without the tables: see "The database is empty" above. The terminal shows the exact error. |
| "…doesn't match BETTER_AUTH_URL" | `BETTER_AUTH_URL` must be the address in your browser's address bar (on your computer, `http://localhost:3000`, including the port). |
| No **Upload from your computer** tab | `SUPABASE_URL` or `SUPABASE_SECRET_KEY` is empty in `.env.local` (or in Vercel). Fill it in (Setup, step 6), then restart `npm run dev`. |
| "Supabase didn't accept the picture" | The file is over 5 MB or isn't a JPEG, PNG, WebP, GIF or AVIF. (Photos straight from an iPhone are often HEIC: export them as JPEG first.) |
| "The picture couldn't be uploaded just now" | The server couldn't get an upload link: check `SUPABASE_SECRET_KEY` is the whole key, with no spaces. The terminal shows the exact error. |
| Uploaded pictures show "couldn't be loaded" | The server couldn't make signed links. Check `SUPABASE_SECRET_KEY`, or that the file still exists in Supabase → **Storage** → `item-images`. |
| "Too many attempts" | The rate limit: wait a minute. |
| A picture shows "couldn't be loaded" | The other website moved it, or doesn't allow showing it elsewhere. Edit the item and paste another address. |
| A board you shared shows "There's no board here" | It's private. Open it, **Edit board**, tick **Public board**, and save. |

The details of database problems are printed in the terminal running
`npm run dev` (or in Vercel's **Logs**), on lines starting with
`[inspiration-library]` or `[Better Auth]`.

## Going further

- **Close sign-ups** once you've made your account, so nobody else can create
  one: add `disableSignUp: true` to `emailAndPassword` in `lib/auth.ts`.
- **Password reset and email verification** need a way to send emails (for
  example [Resend](https://resend.com)): see Better Auth's
  [Email & Password](https://better-auth.com/docs/authentication/email-password)
  page (`sendResetPassword`, `emailVerification.sendVerificationEmail`).
- **Check Supabase's certificate**, not just encrypt the connection: download
  the certificate in Supabase (**Project Settings → Database → SSL
  Configuration**) and pass it to the pool in `lib/db.ts` as
  `ssl: { ca: "<the certificate's text>" }`.
- **Tidy up abandoned uploads.** A picture you upload but never save stays
  in Storage until its board is deleted (nobody can see it). A scheduled job
  could delete files that no item points to.

## Documentation used

- Better Auth 1.7: [Installation](https://better-auth.com/docs/installation),
  [Next.js integration](https://better-auth.com/docs/integrations/next),
  [PostgreSQL](https://better-auth.com/docs/adapters/postgresql),
  [Email & Password](https://better-auth.com/docs/authentication/email-password),
  [Session management](https://better-auth.com/docs/concepts/session-management),
  [Database](https://better-auth.com/docs/concepts/database),
  [Rate limit](https://better-auth.com/docs/concepts/rate-limit),
  [Security](https://better-auth.com/docs/reference/security)
- [node-postgres (`pg`): Pooling](https://node-postgres.com/features/pooling)
  and [SSL](https://node-postgres.com/features/ssl)
- Next.js 15: [Server actions](https://nextjs.org/docs/app/getting-started/updating-data),
  [`not-found`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
- Supabase: [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
  and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
