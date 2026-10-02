# Catnip Fireworks

Click anywhere to launch a burst of hundreds of tiny paw prints and stars in
the homepage cat palette. They fly out, spin, fall with gravity and fade
away. Hold and drag to paint a continuous stream, or press **Space** (or
**Enter**) for a burst at a random spot.

Built with **PixiJS v8**, using a `ParticleContainer`, so thousands of
particles stay smooth. The bottom-right corner shows the live particle count
and frame rate.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/catnip-fireworks

## How it works

1. **One shared texture.** A `ParticleContainer` draws all its particles in
   a single GPU draw call, but every particle must use the same base
   texture. So a white paw print and a white star are drawn with PixiJS
   `Graphics`, baked into one texture with `renderer.generateTexture`, and
   each particle uses one frame (rectangle) of it. White means each
   particle can be **tinted** any palette colour.
2. **Bursts.** Each click adds about 260 particles with a random direction,
   speed, spin, size and colour. Each burst favours three palette colours so
   no two look the same.
3. **Every frame** (`app.ticker`), each particle falls with gravity, slows
   with air drag, spins, and fades out over the last 60% of its life.
   Finished particles are removed in one pass, followed by a single
   `container.update()` call.
4. **Only what changes is sent to the GPU each frame.** `dynamicProperties`
   marks position, rotation and colour (the fade changes alpha) as dynamic.
   Size stays static, which is faster.

PixiJS is imported inside `useEffect` with `await import("pixi.js")`, so it
only runs in the browser. On leaving the page, the app is destroyed with
`releaseGlobalResources: true` to avoid stale textures when you come back.

## Things to tweak

At the top of `page.tsx`:

- `BURST`: particles per click (try 1000!)
- `STREAM`: particles per move while dragging
- `GRAVITY`, `DRAG`: how fast they fall and slow down
- `MAX_PARTICLES`: safety cap (oldest particles are dropped beyond this)
- `PALETTE`: the colours
