/**
 * Weather Cat — the 3D world map, drawn with Three.js.
 *
 * Three.js draws 3D pictures in the browser. A picture needs three things:
 *
 *   a SCENE     the objects (here: the land, a pin for each city, and lights)
 *   a CAMERA    where we are looking from
 *   a RENDERER  the part that turns scene + camera into pixels on a <canvas>
 *
 * This file builds those three and keeps redrawing them. There is no React
 * here: `world-map.tsx` owns the page side (clicks, the name label, the
 * keyboard) and talks to this file through the functions returned at the
 * bottom of `createMapScene`.
 *
 * COORDINATES: the map lies flat like paper on a table.
 *   x = east/west   one unit is one degree of longitude, from -180 to 180
 *   y = north/south (see `project` for how latitude is stretched)
 *   z = up, off the table. The land is a slab a few units thick, and the pins
 *       stand on top of it.
 */

import * as THREE from "three";
import land from "./land.json";
import { mix } from "./scene";
import type { Place } from "./weather";

/* ---------- Tuning: change these to change how the map looks ---------- */

/** How far the camera leans back from looking straight down, in degrees. 0 = a flat map, more = more 3D. */
const TILT = 34;
/** How thick the land is, in map units (degrees). */
const LAND_HEIGHT = 3.2;
/** The map shows the world between these two latitudes. (Antarctica is left out of `land.json`.) */
const SOUTH = -57;
const NORTH = 81;

const LAND_TOP = "#fff8e8";
const LAND_SIDE = "#dcc8a0";
const SEA_SHADOW = "#1c4257";
const INK = "#2b2725";
const RING = "#f0893d";
/** A pin whose weather hasn't arrived yet. */
const PIN_WAITING = "#cfc8bd";

/** Pin sizes, in screen pixels: pins stay the same size however big the map is drawn. */
const PIN_HEAD = 5.5; // the ball's radius
const PIN_STEM = 10; // the stick's length

/** How much bigger a pin gets when the pointer is on it, and when it is the place on screen. */
const GROW_HOVER = 1.3;
const GROW_CURRENT = 1.5;

/**
 * Pin colours by temperature, in °C. A temperature between two stops gets a
 * blend of their colours. The legend under the map is drawn from this same
 * list, so the two can never disagree.
 */
export const TEMP_STOPS: [celsius: number, colour: string][] = [
  [-20, "#3f5fcf"],
  [-5, "#5aa0ea"],
  [8, "#62c9b9"],
  [18, "#f3c04a"],
  [28, "#f0893d"],
  [38, "#d9433b"],
];

export function tempColour(celsius: number): string {
  const last = TEMP_STOPS.length - 1;
  if (celsius <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1];
  for (let i = 0; i < last; i++) {
    const [coolTemp, coolColour] = TEMP_STOPS[i];
    const [warmTemp, warmColour] = TEMP_STOPS[i + 1];
    if (celsius <= warmTemp) return mix(coolColour, warmColour, (celsius - coolTemp) / (warmTemp - coolTemp));
  }
  return TEMP_STOPS[last][1];
}

/* ---------- From the round Earth to a flat map ---------- */

/**
 * Turns a latitude and longitude into a spot on the flat map.
 *
 * Every flat map has to stretch the round Earth somehow. This is the "Miller"
 * projection, the look of a classroom wall map: longitude is used as it is,
 * and latitude is stretched a little more the further you go from the equator.
 */
export function project(lat: number, lon: number): { x: number; y: number } {
  const latRadians = (lat * Math.PI) / 180;
  const y = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * latRadians));
  return { x: lon, y: (y * 180) / Math.PI };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/* ---------- What the camera can see ---------- */

const tilt = (TILT * Math.PI) / 180;
const SOUTH_Y = project(SOUTH, 0).y;
const NORTH_Y = project(NORTH, 0).y;
/** The whole world's width, plus a little sea on each side. */
const MAP_WIDTH = 360 + 8;
/**
 * How many map units fit between the top and bottom of the picture. Leaning
 * the camera back squashes the map's height (that is the cos), and a few
 * units are added so the pins along the top edge have headroom.
 */
const VIEW_HEIGHT = (NORTH_Y - SOUTH_Y) * Math.cos(tilt) + 6;
/** The spot (north/south) the camera looks at: the middle of the map, nudged up to make that headroom. */
const CENTRE_Y = (NORTH_Y + SOUTH_Y) / 2 + 3;

/* ---------- Building the land ---------- */

/**
 * `land.json` holds the outline of every land mass as a list of points
 * ([longitude, latitude, longitude, latitude, ...]). A `Shape` is that
 * outline in Three.js, and "extruding" it pushes the flat shape up into a
 * slab, like cutting it out of thick card.
 */
function buildLand(): THREE.ExtrudeGeometry {
  const toPoints = (ring: number[]) => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i < ring.length; i += 2) {
      const { x, y } = project(ring[i + 1], ring[i]);
      points.push(new THREE.Vector2(x, y));
    }
    return points;
  };

  // Each land mass is an outline, sometimes followed by holes (the Caspian Sea is one).
  const shapes = (land as number[][][]).map(([outline, ...holes]) => {
    const shape = new THREE.Shape(toPoints(outline));
    for (const hole of holes) shape.holes.push(new THREE.Path(toPoints(hole)));
    return shape;
  });

  return new THREE.ExtrudeGeometry(shapes, { depth: LAND_HEIGHT, bevelEnabled: false });
}

/* ---------- The scene ---------- */

export type MapScene = ReturnType<typeof createMapScene>;

type Options = {
  /** True if the visitor has asked their device for less animation. */
  reducedMotion: boolean;
  /** Called on every frame with the spot (in pixels) just above the labelled pin. */
  onLabelMove: (x: number, y: number) => void;
};

/** Which pin the name label is attached to: a city (by its number in the list), the current place, or none. */
export type LabelAnchor = number | "current" | null;

export function createMapScene(canvas: HTMLCanvasElement, cities: Place[], { reducedMotion, onLabelMove }: Options) {
  /* ----- Renderer: draws onto the <canvas> ----- */
  // `alpha: true` keeps the canvas see-through, so the sea is simply the CSS
  // background behind it. This throws an error if the browser has no WebGL.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  // Sharp on high-resolution screens, but never more than 2x (beyond that it only costs battery).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();

  /* ----- Camera ----- */
  // An "orthographic" camera has no perspective: far things are not drawn
  // smaller. That keeps the map's shape true, like a board game seen from above.
  const camera = new THREE.OrthographicCamera();
  camera.near = 1;
  camera.far = 1000;
  camera.up.set(0, 0, 1); // "up" on screen is z, the direction the pins point

  /* ----- Lights ----- */
  // Soft light from everywhere, so nothing is ever black...
  scene.add(new THREE.AmbientLight("#ffffff", 2.2));
  // ...plus a sun in the north-west, which lights the tops and casts the shadows.
  const sun = new THREE.DirectionalLight("#ffffff", 1.3);
  sun.position.set(-150, CENTRE_Y + 180, 240);
  sun.target.position.set(0, CENTRE_Y, 0);
  sun.castShadow = true;
  // A shadow is worked out by drawing the scene from the light's point of
  // view. These numbers are the area that view covers: the whole map.
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -210;
  sun.shadow.camera.right = 210;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0012; // stops surfaces from speckling themselves with shadow
  sun.shadow.radius = 2.5; // soft edges
  scene.add(sun, sun.target);

  /* ----- Sea: invisible, except where a shadow falls on it ----- */
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(MAP_WIDTH + 40, 320), new THREE.ShadowMaterial({ color: SEA_SHADOW, opacity: 0.26 }));
  sea.position.y = CENTRE_Y;
  sea.receiveShadow = true;
  scene.add(sea);

  /* ----- Land ----- */
  // An extruded shape takes two materials: one for the flat faces, one for the walls.
  const landMesh = new THREE.Mesh(buildLand(), [new THREE.MeshLambertMaterial({ color: LAND_TOP }), new THREE.MeshLambertMaterial({ color: LAND_SIDE })]);
  landMesh.castShadow = true;
  landMesh.receiveShadow = true;
  scene.add(landMesh);

  /* ----- Pins ----- */
  // Every pin shares the same two shapes. Both are built standing up (along
  // z) with the foot of the stick at 0, so a pin can be placed by its foot.
  const stemShape = new THREE.CylinderGeometry(0.9, 0.9, PIN_STEM, 8).rotateX(Math.PI / 2).translate(0, 0, PIN_STEM / 2);
  const headShape = new THREE.SphereGeometry(PIN_HEAD, 24, 16).translate(0, 0, PIN_STEM + PIN_HEAD * 0.7);
  const stemMaterial = new THREE.MeshLambertMaterial({ color: INK });
  /** How high above a pin's foot the middle and the top of its ball are, in pixels. */
  const HEAD_MIDDLE = PIN_STEM + PIN_HEAD * 0.7;
  const HEAD_TOP = HEAD_MIDDLE + PIN_HEAD;

  type Pin = { group: THREE.Group; paint: THREE.MeshLambertMaterial; x: number; y: number; grow: number };

  const makePin = (lat: number, lon: number): Pin => {
    const paint = new THREE.MeshLambertMaterial({ color: PIN_WAITING });
    const stem = new THREE.Mesh(stemShape, stemMaterial);
    const head = new THREE.Mesh(headShape, paint);
    stem.castShadow = head.castShadow = true;

    // A Group moves, turns and scales its children as one object.
    const group = new THREE.Group();
    group.add(stem, head);
    const { x, y } = project(lat, lon);
    group.position.set(x, y, LAND_HEIGHT);
    scene.add(group);
    return { group, paint, x, y, grow: 1 };
  };

  const pins = cities.map((city) => makePin(city.lat, city.lon));
  /** One spare pin, for when the place on screen is not one of the map's cities (a search, or "my location"). */
  const herePin = makePin(0, 0);
  herePin.group.visible = false;

  /* ----- The ring around the place on screen ----- */
  // Two flat rings lying on the land: one steady, one that keeps spreading out and fading.
  const ringShape = new THREE.RingGeometry(PIN_HEAD * 1.35, PIN_HEAD * 1.8, 48);
  const steadyRing = new THREE.Mesh(ringShape, new THREE.MeshBasicMaterial({ color: RING, transparent: true, depthWrite: false }));
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: RING, transparent: true, depthWrite: false });
  const pulseRing = new THREE.Mesh(ringShape, pulseMaterial);
  const rings = new THREE.Group();
  rings.add(steadyRing, pulseRing);
  rings.visible = false;
  scene.add(rings);

  /* ----- Things that change while the map is open ----- */
  let width = 1;
  let height = 1;
  /** How many map units one screen pixel covers. Pins are scaled by this to stay a fixed size on screen. */
  let unitsPerPixel = 1;
  /** Where the camera is looking, east/west, and where it is gliding to. */
  let pan = 0;
  let panTarget = 0;
  /** How far the camera may slide either way. 0 when the whole world fits (wide screens). */
  let panLimit = 0;
  let highlighted: number | null = null;
  /** The pin for the place on screen: one of `pins`, or `herePin`, or none. */
  let currentPin: Pin | null = null;
  let labelAnchor: LabelAnchor = null;
  let onScreen = true;

  const placeCamera = () => {
    // The camera sits south of the spot it looks at and above it, so it looks down and north.
    camera.position.set(pan, CENTRE_Y - Math.sin(tilt) * 400, Math.cos(tilt) * 400);
    camera.lookAt(pan, CENTRE_Y, 0);
    camera.updateMatrixWorld();
  };

  /** Where a point in the scene lands on the canvas, in pixels from its top-left corner. */
  const point = new THREE.Vector3();
  const toScreen = (x: number, y: number, z: number) => {
    // project() gives -1 to 1 across the picture, with +1 at the top. Pixels count from the top-left.
    point.set(x, y, z).project(camera);
    return { x: ((point.x + 1) / 2) * width, y: ((1 - point.y) / 2) * height };
  };

  /** Where one part of a pin is on the canvas. `above` is the height over the pin's foot, in pixels. */
  const pinOnScreen = (pin: Pin, above: number) => toScreen(pin.x, pin.y, LAND_HEIGHT + above * pin.grow * unitsPerPixel);

  /* ----- The loop: redraw about 60 times a second ----- */
  let frame = 0;
  let lastTime = performance.now();

  const draw = (time: number) => {
    frame = requestAnimationFrame(draw);
    const seconds = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    if (!onScreen) return; // scrolled out of view: don't spend battery drawing

    // "Easing": each frame, close part of the gap to the target. Movement
    // starts quickly and settles gently. With reduced motion, jump straight there.
    const ease = (speed: number) => (reducedMotion ? 1 : 1 - Math.exp(-seconds * speed));

    pan += (panTarget - pan) * ease(7);
    placeCamera();

    pins.forEach((pin, index) => {
      const target = pin === currentPin ? GROW_CURRENT : index === highlighted ? GROW_HOVER : 1;
      pin.grow += (target - pin.grow) * ease(14);
      pin.group.scale.setScalar(pin.grow * unitsPerPixel);
    });
    herePin.grow = GROW_CURRENT;
    herePin.group.scale.setScalar(herePin.grow * unitsPerPixel);

    if (currentPin) {
      rings.scale.setScalar(unitsPerPixel * GROW_CURRENT);
      // One pulse every 2 seconds: the ring grows from 1x to 2.6x while fading away.
      const pulse = reducedMotion ? 0 : (time / 2000) % 1;
      pulseRing.scale.setScalar(1 + pulse * 1.6);
      pulseMaterial.opacity = reducedMotion ? 0 : 0.7 * (1 - pulse);
    }

    renderer.render(scene, camera);

    const labelled = labelAnchor === "current" ? currentPin : labelAnchor !== null ? pins[labelAnchor] : null;
    if (labelled) {
      const top = pinOnScreen(labelled, HEAD_TOP);
      onLabelMove(top.x, top.y);
    }
  };

  placeCamera();
  frame = requestAnimationFrame(draw);

  // Tells us when the map scrolls in and out of view.
  const watcher = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
  });
  watcher.observe(canvas);

  /* ----- What `world-map.tsx` can ask this scene to do ----- */
  return {
    /** True when the map is wider than its box, so it can be dragged sideways. */
    get pannable() {
      return panLimit > 0;
    },

    /** Call when the map's box changes size (in CSS pixels). */
    resize(newWidth: number, newHeight: number) {
      if (newWidth < 1 || newHeight < 1) return;
      width = newWidth;
      height = newHeight;
      renderer.setSize(width, height, false); // false: leave the CSS size alone

      // The map's height always fills the box. How much of its width fits
      // depends on the box's shape: on a phone, only part of the world does.
      const viewWidth = VIEW_HEIGHT * (width / height);
      camera.left = -viewWidth / 2;
      camera.right = viewWidth / 2;
      camera.top = VIEW_HEIGHT / 2;
      camera.bottom = -VIEW_HEIGHT / 2;
      camera.updateProjectionMatrix();

      unitsPerPixel = VIEW_HEIGHT / height;
      panLimit = Math.max(0, (MAP_WIDTH - viewWidth) / 2);
      panTarget = clamp(panTarget, -panLimit, panLimit);
      pan = clamp(pan, -panLimit, panLimit);
    },

    /** Colours each city's pin by its temperature in °C. `null` = not known yet. */
    setTemps(temps: (number | null)[]) {
      pins.forEach((pin, index) => {
        const temp = temps[index];
        pin.paint.color.set(temp == null ? PIN_WAITING : tempColour(temp));
      });
    },

    /** Marks the place whose weather is on screen, and slides the map so it is in view. */
    setCurrent(place: { lat: number; lon: number; temp: number } | null) {
      herePin.group.visible = false;
      rings.visible = !!place;
      if (!place) {
        currentPin = null;
        return;
      }

      const { x, y } = project(place.lat, place.lon);
      // If the place is (nearly) on top of one of the map's cities, use that
      // city's pin. Two pins on the same spot would only hide each other.
      const nearby = pins.find((pin) => Math.hypot(pin.x - x, pin.y - y) < 3);
      if (nearby) {
        currentPin = nearby;
      } else {
        currentPin = herePin;
        herePin.x = x;
        herePin.y = y;
        herePin.group.position.set(x, y, LAND_HEIGHT);
        herePin.paint.color.set(tempColour(place.temp));
        herePin.group.visible = true;
      }

      rings.position.set(currentPin.x, currentPin.y, LAND_HEIGHT + 0.25);
      panTarget = clamp(currentPin.x, -panLimit, panLimit);
    },

    /** Makes one city's pin stand out (pointer or keyboard focus on it). `null` = none. */
    setHighlight(index: number | null) {
      highlighted = index;
    },

    setLabelAnchor(anchor: LabelAnchor) {
      labelAnchor = anchor;
    },

    /** Slides the map so that a city is in view (used when moving between cities with the keyboard). */
    reveal(index: number) {
      panTarget = clamp(pins[index].x, -panLimit, panLimit);
    },

    /** Slides the map sideways by a number of screen pixels (dragging). */
    panBy(pixels: number) {
      pan = panTarget = clamp(pan - pixels * unitsPerPixel, -panLimit, panLimit);
    },

    /**
     * Which city is at this spot on the canvas? Returns its number in the
     * list, or null. Instead of needing an exact hit on a small ball, this
     * finds the closest pin within `radius` pixels, which is far easier to
     * use with a finger.
     */
    pick(x: number, y: number, radius: number): number | null {
      let best: number | null = null;
      let bestDistance = radius;
      for (let index = 0; index < pins.length; index++) {
        const head = pinOnScreen(pins[index], HEAD_MIDDLE);
        const distance = Math.hypot(head.x - x, head.y - y);
        if (distance <= bestDistance) {
          best = index;
          bestDistance = distance;
        }
      }
      return best;
    },

    /** Stops the loop and hands the graphics memory back. Call when leaving the page. */
    dispose() {
      cancelAnimationFrame(frame);
      watcher.disconnect();
      // Three.js objects hold memory on the graphics card, which the browser
      // can't tidy up by itself. Each shape and material has to be let go.
      for (const shape of [landMesh.geometry, sea.geometry, stemShape, headShape, ringShape]) shape.dispose();
      const materials = [landMesh.material, sea.material, stemMaterial, steadyRing.material, pulseMaterial, herePin.paint, ...pins.map((pin) => pin.paint)].flat();
      for (const material of materials) material.dispose();
      sun.shadow.map?.dispose();
      renderer.dispose();
    },
  };
}
