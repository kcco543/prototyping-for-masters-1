# Sound-Sensitive Cat

The black cat in the homepage's cat lounge can hear. Click the little
microphone above it, allow microphone access, and then:

| What you do | What the cat does |
| --- | --- |
| Whisper or talk quietly | Gets curious: ears perk up, head tilts, it tiptoes towards the microphone. When it's quiet again, it slowly settles back. |
| Make a loud noise (shout, bang) | Gets startled: jumps, fur stands on end, the tail goes bushy, ears flatten for a moment, a red "!" pops up. After about 1.3 seconds it relaxes. |
| Clap twice, quickly | Magic: the cat waves its tail like a wand (with a star on the tip), fireworks of paw prints, stars and sparkles burst around it, and it meows once. |
| Nothing | The cat behaves as it always does. |

Click the microphone again to switch it off. It is **off every time the page
loads**, and nothing happens until you click it.

The cat's usual behaviour keeps working: clicking it still plays its "look
around" animation, and it still chases the laser dot. When a sound and
something else happen at once, these rules decide:

1. Two claps (fireworks) beat everything. Other sounds are ignored until
   the fireworks are over.
2. A loud sound beats a quiet one.
3. A quiet sound makes it curious.
4. While it reacts to a sound, it ignores the laser dot and clicks. While it
   is busy with a click animation, a new sound reaction waits for it to end.

## Privacy

The sound never leaves the browser tab. It goes from the microphone into the
Web Audio API's `AnalyserNode`, which only measures it. Nothing is recorded,
saved, sent to a server, transcribed or played back. Switching the
microphone off (or leaving the page) stops the microphone completely, and
the browser's "microphone in use" light goes out.

## How it works

The work is split into small files, each with one job:

| File | What it does |
| --- | --- |
| `detector.ts` | The cat's "ears": turns sound samples into a reaction. Pure arithmetic, no browser APIs. **All the tuning numbers are at the top.** |
| `listener.ts` | Connects the microphone: `getUserMedia` → `AudioContext` → `AnalyserNode`, then reads the newest samples on every animation frame (`getFloatTimeDomainData` + `requestAnimationFrame`). |
| `SoundCat.tsx` | The microphone button, the message bubble, and passing reactions on to the cat. |
| `fireworks.ts` | The fireworks: about 80 particles on a canvas, with gravity and fading. |
| `meow.ts` | One meow, made from scratch with Web Audio (no sound file). |
| `SoundCat.module.css` | The button, bubble and fireworks layer. |
| `check-detector.mjs` | Tests the hearing with made-up sounds (see "Tuning" below). |

The cat's poses are in `../playful-cats/`: the black cat's drawing in
`PlayfulCats.tsx` (with extra layers for separate ears, fur that stands on
end, and the wand star), and its movements in `PlayfulCats.module.css`
under "Sound reactions".

### How loudness is measured

The microphone gives a stream of numbers between -1 and 1 that describe the
sound wave. The **root mean square** (RMS) of a batch of them is a good
measure of loudness. It's written in decibels (dB): 0 dB is as loud as it
gets, a quiet room is about -60 dB, talking about -35 dB.

Every room and microphone is different, so for the first 1.5 seconds after
switching on, the cat just listens ("Shh… learning what your room sounds
like"). That background level is what every rule is measured from. It keeps
updating slowly afterwards, so a fan or music that keeps going stops being
interesting after a few seconds. The cat gets used to it.

On top of that:

- **Smoothing** stops the level from jumping around with every syllable.
- **Hysteresis** means a sound has to drop clearly below the "noticed" level
  before it counts as gone, so the cat doesn't flicker between moods.
- **Hold times** mean a sound must last a moment before the cat reacts.
- **Cooldowns** stop it from being startled again and again by one long
  noise, or setting off fireworks twice in a row.

### How a double clap is recognised

Volume alone can't tell a clap from a shout, so claps are found by their
**shape** instead:

1. **Sharp**: much louder (18 dB) than the sound a moment before. It's
   measured in slices of about 5 ms, because a clap is that short.
2. **Short**: it fades again within 170 ms. Talking and bangs last longer.
3. **A pair**: a second clap between 0.18 and 1.2 seconds later. Anything
   closer is one clap and its echo.
4. **Then a pause**: nothing sharp for 0.3 seconds after the second clap.
   This is what stops typing on a keyboard (a stream of clicks) from setting
   off fireworks.

It won't be perfect. Some rooms echo, some microphones are very sensitive,
and a few other sharp sounds can look like claps. That's why every number is
adjustable.

## Tuning

Every setting is in `DEFAULT_SOUND_SETTINGS` at the top of `detector.ts`,
each with a comment.

| If… | Try… |
| --- | --- |
| The cat ignores quiet talking | Lower `quietAboveFloorDb` (e.g. 10 → 7) |
| The cat gets curious at every little noise | Raise `quietAboveFloorDb`, or `quietHoldMs` |
| Normal talking startles it | Raise `loudAboveFloorDb` and/or `loudMinDb` (e.g. -30 → -24) |
| Shouting doesn't startle it | Lower `loudAboveFloorDb` and/or `loudMinDb` |
| Claps aren't recognised | Lower `clapRiseDb` (18 → 14) or `clapAboveFloorDb` |
| Other sounds set off fireworks | Raise `clapRiseDb` or `clapAboveFloorDb` |
| Your claps are slow | Raise `clapMaxGapMs` (1200 → 1500) |
| The cat calms down too slowly | Lower `quietReleaseMs` or `startledMs` |

To see the live numbers while you tune, open the homepage with
**`?sound-debug`** at the end of the address (for example
<http://localhost:3000/?sound-debug>). A small dark strip above the cat shows
the current level, the room's background level, the cat's reaction and the
last thing it noticed.

After changing a number, run the made-up-sound check from the project's top
folder. It plays 15 situations (silence, talking, claps, a fan, typing…) and
says whether the cat still reacts the right way:

```bash
node app/components/sound-cat/check-detector.mjs
```

Other switches:

- **The meow:** `MEOW_WITH_FIREWORKS` in `SoundCat.tsx` (`false` for silent fireworks).
- **How far the cat walks towards the microphone:** `.soundCurious .soundMove` in
  `PlayfulCats.module.css` (`translateX(16px)`).
- **The fireworks:** `COUNT`, `GRAVITY` and `PALETTE` in `fireworks.ts`.

## Reduced motion

If the visitor's device is set to reduce motion, the cat doesn't move.
Instead it says what it heard in a speech bubble ("mrrp?", "hsss!!",
"✦ meow ✦"), and the fireworks become a few sparkles that fade in and out
where they are.

## Troubleshooting

| What you see | What it means |
| --- | --- |
| "The microphone is blocked for this page" | Microphone access was refused. Allow it in the browser's site settings (the icon at the left of the address bar), then click the microphone again. |
| "Microphones only work on secure (https) pages" | Browsers only share the microphone with `https://` pages and `localhost`. Opening the dev server from another device by its network address (`http://192.168…`) won't work. |
| "Another app is using the microphone" | Close the other app (a video call, for example) and try again. |
| Nothing happens in Claude's built-in browser | That browser doesn't allow microphone access. Use a normal browser window. |
| Typing near a laptop makes the cat curious | Expected: key clicks are real sounds. If they ever set off fireworks, raise `clapRiseDb`. |
