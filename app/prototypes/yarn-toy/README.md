# Yarn Toy

A ball of yarn dangles from the top of the screen on a long, floppy string.
Move your mouse and the ball follows it on a springy pull, swinging and
overshooting like a real toy. Bring it near the orange cat paw at the bottom
and the paw winds up and **swats** it away. Each hit is counted.

Built with **PixiJS v8**: the string is a `MeshRope`.

## How to run

From the project root:

```bash
npm install
npm run dev
```

Open http://localhost:3000/prototypes/yarn-toy

## Controls

- **Mouse / touch:** the yarn follows your pointer. Move it off the page
  and the yarn just hangs and swings.
- **Keyboard:** press **Tab** to focus the play area. The **arrow keys**
  move the yarn (hold **Shift** for bigger moves), **Space** or **Enter**
  flicks it, and **Escape** lets go.
- **Screen readers:** the play area has a description, and swats are
  announced (at most once every 3 seconds, so it doesn't get chatty).

## How it works

1. **The string is a chain of 31 points (Verlet physics).** Each point
   remembers where it was last step; the difference is its speed. Every step:
   gravity pulls the points down, then we nudge each pair of neighbours back
   to a fixed distance apart, 24 times. Many small corrections make the
   string floppy but never stretchy. The top point is pinned to the top of
   the screen. Physics runs at a fixed 120 steps per second, so it behaves
   the same on fast and slow screens.
2. **The ball is heavier and on a spring.** The last point is the ball. It
   has a lower "inverse mass", so the string bends around it more than it
   moves. While the pointer is on the page, a spring pulls the ball toward
   it. Springs overshoot, which gives the bouncy follow.
3. **`MeshRope` draws the string.** The yarn texture (twisted diagonal
   strands with shaded edges) is painted once on a `<canvas>`. `MeshRope`
   bends that texture along the simulated points every frame, and
   `textureScale` repeats it along the length instead of stretching it.
4. **The paw is a small state machine:** *idle* (slides along the bottom to
   stalk the ball, swaying), then *wind-up* (crouches back), *strike*
   (rotates and reaches toward where the ball is about to be), *hold*,
   *retract*, and a short random rest. If the paw touches the ball during
   a strike, the ball gets a push up and in the direction of the swipe.
   Like a real cat, it only pounces on yarn that is moving or being dangled,
   so a still, hanging ball is left alone.

## Things to tweak

The numbers at the top of `page.tsx` are safe to play with:

- `SEGMENTS`, `GRAVITY`, `DAMPING`: how floppy and swingy the string is.
- `SPRING`, `SPRING_DAMP`: how eagerly the ball follows the pointer.
- `REACH`, `SWAT_SPEED`: how close the paw needs the yarn, and how hard it
  hits.

## Files

- `page.tsx`: the page, physics, rope, ball and paw.
- `styles.module.css`: the full-screen layout and floating header and footer.
