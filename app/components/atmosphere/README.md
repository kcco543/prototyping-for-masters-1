# Homepage atmosphere

The homepage's living background and its response to the cursor. Its
techniques are adapted from **Prompt Bond** (`components/ui/prompt-bond.tsx`,
MIT, by Cojeev), recoloured and retuned for the homepage.

| File | What it does |
| --- | --- |
| `HomeAtmosphere.tsx` | The background layer (fixed behind the whole page) and the cursor controller |
| `ShaderField.tsx` | The moving colour field: ShaderGradient's "water plane", like Prompt Bond's light scene, in the homepage's cream, lavender and blush |
| `HomeAtmosphere.module.css` | The still field, the moving field's fade-in and lean, and the cursor's soft glow |

## What moves, and where it's styled

| Element | Effect | Where |
| --- | --- | --- |
| The page background | A slowly moving colour field, leaning a few pixels with the cursor; a soft warm glow follows the cursor | this folder |
| The hero's moon, orbits and stars | Three depths leaning by different amounts (parallax); stars drift and twinkle; a halo slowly changes shape | `../celestial/Celestial.module.css` |
| Sparkle ornaments | Breathe and turn slowly | `../../styles/home.module.css`, `../gallery/SectionHeading.module.css` |
| Project cards | Glow as the cursor approaches (`--near`), a highlight follows the cursor on hover, the corners soften | `../gallery/ProjectCard.module.css` |
| Filter chips | Soft halo and lift on hover; smooth change to "selected" | `../gallery/CategoryFilter.module.css` |
| The cat lounge | A faint, slowly breathing warm light behind the cats | `../../styles/home.module.css` |

The cats, the cat tree and every link are unchanged.

## How it stays light

- **Behind everything, never clickable:** `position: fixed; z-index: -1;
  pointer-events: none`. The controller only *listens* (passively), so it
  can't affect clicks, the cat tree's dragging, or the cats' laser chase.
- **Still first:** a plain CSS gradient is always there. The moving field
  loads afterwards (after the first paint and an idle moment), in its own
  chunk, so three.js never slows down the page's first load.
- **No WebGL, or it fails:** the still field simply stays (`hasWebGL()` and an
  error boundary).
- **Reduced motion:** no moving field, no parallax, no drifting, breathing or
  glowing. The still field is the calm version.
- **Hidden tab:** the shader stops drawing (`FramePolicy`, as in Prompt Bond);
  CSS animations pause on their own.
- **Pixel limits:** the shader draws one canvas pixel per CSS pixel
  (`pixelDensity={1}`) and asks for the low-power GPU.
- **Touch screens:** no cursor, so no cursor effects; the field still moves.
- **The cursor loop** runs only while something is still easing, then stops.

## Important

`.page` (in `app/styles/home.module.css`) must stay without a `z-index`,
`transform`, `filter` or `isolation`. Any of those would create a new
stacking context, and the atmosphere (`z-index: -1`) would disappear behind
the page.
