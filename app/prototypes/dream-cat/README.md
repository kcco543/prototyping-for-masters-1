# Dream Cat

The orange tabby from the homepage, drawn with **PixiJS v8**, with a panel of
effect sliders:

- **Blur** softens the whole picture.
- **Dream waves** adds a slow, wavy wobble (a custom shader).
- **Colour shift** turns the colour wheel (hue).
- **Glow** adds a warm light around the cat.

Move your mouse (or finger) across the cat and ripples spread through the
picture like water. Click or tap for a bigger splash.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/dream-cat

## Keyboard and screen readers

- The sliders are normal HTML range inputs: **Tab** to one, then use the
  arrow keys, **Page Up/Down**, **Home** or **End**. Each one has a visible
  label, and screen readers announce the value with its unit (for example
  "6 px" or "+40°").
- **Tab** to the picture to show a ripple marker. Move it with the **arrow
  keys** (hold **Shift** for bigger steps) and press **Enter** or **Space** to
  make a ripple. Screen readers hear where it landed, such as "Ripple across
  its back".
- **Reset effects** puts every slider back to its starting value.
- If "reduce motion" is on in your system settings, the dream waves stay
  still. Ripples only happen when you ask for one.

## How it works

1. **The cat becomes a texture.** The homepage draws its cats as React SVG
   components. `TabbyArt` (exported from
   `app/components/playful-cats/PlayfulCats.tsx`) is turned into an SVG
   string with `renderToStaticMarkup`, loaded as an image at 3× size so it
   stays sharp, and handed to PixiJS with `Texture.from`. A `Sprite` shows it.
2. **Filters change the pixels.** The cat sits in a `Container` with three
   filters, applied in order:
   - `BlurFilter`: blur.
   - A custom shader made with `Filter.from`: the dream waves and the
     ripples. Every pixel reads its colour from a slightly shifted spot. Sine
     waves make the wobble, and rings moving outward from each touch point
     make the ripples. The shader remembers up to 8 ripples at once.
   - `ColorMatrixFilter.hue()`: colour shift.
3. **Glow is a second cat.** A blurred, golden-tinted copy of the cat sits
   behind it with the `add` blend mode, so it adds light to the dark
   background. The slider sets how see-through that copy is.
4. **React talks to PixiJS through a ref.** The sliders update React state
   for the labels and call `setEffect`, which writes the value straight into
   the filter. PixiJS is loaded with a dynamic `import()` inside `useEffect`,
   so it only runs in the browser.

## Files

- `page.tsx`: the page, the PixiJS setup and the shader.
- `styles.module.css`: layout, sliders and the dusk background.
