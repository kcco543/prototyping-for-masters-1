# Trick & Treat figurine

A rotatable 3D model of two chibi Halloween friends (a little witch holding a
pumpkin and a little vampire in a cape), made to look like a small collectible
figurine with a **matte, frosted** finish. It has its own full-screen page.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Then open http://localhost:3000/prototypes/trick-or-treat-figurine (or find
**Trick & Treat figurine** under "More rooms" on the homepage).

## How to use

- **Drag** (mouse or finger) to rotate the figurine in any direction.
- **Scroll** or **pinch** to zoom in and out.
- **Spin** turns the turntable on or off (it stops when you grab the model).
- **Front / Left / Back / Right / Top** glide the camera to that angle.
- The three dots switch the backdrop: lilac studio, Halloween dusk, paper white.

## How it's made

It uses [three.js](https://threejs.org), a library for 3D graphics in the
browser. There is no 3D model file: every part (heads, hair, hat, cape,
pumpkin, base) is built in code from simple shapes.

The frosted look comes from the material settings in `figurine.ts`
(`makeMaterialFactory`): high roughness (no shiny reflections), a soft
"sheen" glow on the edges, and a fine noise texture that adds tiny grain.

## Files

| File | What it does |
| --- | --- |
| `page.tsx` | The page: title, buttons and backdrop. Starts the 3D viewer. |
| `figurine.ts` | The 3D scene: the two characters, the base, lights, material and rotation controls |
| `styles.module.css` | Layout and backdrop colours |

## Things to tweak (in `figurine.ts`)

- `C`: all the colours, e.g. change `witchHair` or `cape`.
- `makeMaterialFactory`: `roughness` (higher = more matte) and `sheen`
  (higher = more frosted glow).
- The `locks` lists in `buildWitch` / `buildVampire`: each entry is one lock
  of hair. `from`/`to` are positions on the head, `lift` makes it stick out.
- `VIEWS`: the camera angles used by the view buttons.
