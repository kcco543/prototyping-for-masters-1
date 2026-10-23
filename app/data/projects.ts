/**
 * Every prototype on the homepage is listed in this one file.
 *
 * TO ADD A PROTOTYPE TO THE HOMEPAGE: add one entry to the `projects` array
 * below. That's it. The homepage builds its cards, the "Featured" section,
 * the category filters and all the counts from this data.
 */

import type { RoomId } from "../components/cat-tree/CatTree";

/* ---------- Categories ---------- */

/**
 * The filter buttons are generated from this list, in this order.
 * - `id`     : what you write in a project's `category`
 * - `label`  : the name people see
 * - `accent` : the colour of the little star next to the category name
 *
 * To add a category, add a line here. A filter button for it appears
 * automatically.
 */
export const categories = [
  { id: "tarot", label: "Tarot & Divination", accent: "#8f82c4" },
  { id: "cat-play", label: "Cat Games & Play", accent: "#d98a8c" },
  { id: "experiments", label: "Creative Experiments", accent: "#c19a45" },
] as const;

/** "tarot" | "cat-play" | "experiments" (worked out from the list above) */
export type CategoryId = (typeof categories)[number]["id"];

/* ---------- Projects ---------- */

export type Project = {
  /** A unique short name, usually the same as the prototype's folder name */
  id: string;
  title: string;
  /** One short sentence */
  description: string;
  /** One of the category ids above */
  category: CategoryId;
  /** Optional technology tags, e.g. ["p5.js"]. Use [] for none. */
  tags: string[];
  /**
   * The preview picture: the path of an image inside the `public` folder.
   * Any 4:3 image works (SVG, JPG, PNG, WebP). Leave it as "" and the card
   * shows a simple placeholder instead.
   */
  thumbnail: string;
  /** The prototype's address, e.g. "/prototypes/my-prototype" */
  href: string;
  /** true = also shown big in "Featured Projects" (only the first two are used) */
  featured: boolean;
  /**
   * "live"        = the page exists and works, so the card links to it
   * "coming-soon" = not built yet, so the card is shown WITHOUT a link
   */
  status: "live" | "coming-soon";
};

export const projects: Project[] = [
  {
    id: "the-magician",
    title: "The Magician",
    description: "Scroll through typefaces for the word “cat”, then reveal the cat your font summons.",
    category: "tarot",
    tags: ["CSS", "Web Audio"],
    thumbnail: "/thumbnails/the-magician.svg",
    href: "/prototypes/the-magician",
    featured: true,
    status: "live",
  },
  {
    id: "wheel-of-fortune",
    title: "Wheel of Fortune",
    description: "Think of a question, tap the cat, and let its unravelling yarn spell out your answer.",
    category: "tarot",
    tags: ["SVG"],
    thumbnail: "/thumbnails/wheel-of-fortune.svg",
    href: "/prototypes/wheel-of-fortune",
    featured: false,
    status: "live",
  },
  {
    id: "the-tower",
    title: "The Tower",
    description: "A curious cat knocks cups off the shelves, and you catch every one before it hits the floor.",
    category: "tarot",
    tags: ["SVG", "Web Audio"],
    thumbnail: "/thumbnails/the-tower.svg",
    href: "/prototypes/the-tower",
    featured: false,
    status: "live",
  },
  {
    id: "cat-spellbook",
    title: "Cat Spellbook",
    description: "Doodle in an enchanted storybook with five magical brushes while the cats watch.",
    category: "cat-play",
    tags: ["p5.js", "Tone.js"],
    thumbnail: "/thumbnails/cat-spellbook.svg",
    href: "/prototypes/cat-spellbook",
    featured: true,
    status: "live",
  },
  {
    id: "yarn-toy",
    title: "Yarn Toy",
    description: "Dangle a ball of yarn on a floppy string and tease the cat paw until it swats.",
    category: "cat-play",
    tags: ["PixiJS"],
    thumbnail: "/thumbnails/yarn-toy.svg",
    href: "/prototypes/yarn-toy",
    featured: false,
    status: "live",
  },
  {
    id: "catnip-fireworks",
    title: "Catnip Fireworks",
    description: "Click anywhere to burst hundreds of paw prints and stars across the night.",
    category: "cat-play",
    tags: ["PixiJS"],
    thumbnail: "/thumbnails/catnip-fireworks.svg",
    href: "/prototypes/catnip-fireworks",
    featured: false,
    status: "live",
  },
  {
    id: "dream-cat",
    title: "Dream Cat",
    description: "Blur, wobble, recolour and light up the tabby with sliders, then ripple it like water.",
    category: "cat-play",
    tags: ["PixiJS", "Shaders"],
    thumbnail: "/thumbnails/dream-cat.svg",
    href: "/prototypes/dream-cat",
    featured: false,
    status: "live",
  },
  {
    id: "weather-cat",
    title: "Weather Cat",
    description: "The weather where you are, or in any city you click on a 3D world map, as told by a cat who dresses for it.",
    category: "cat-play",
    tags: ["SVG", "Three.js", "OpenWeatherMap API"],
    thumbnail: "/thumbnails/weather-cat.svg",
    href: "/prototypes/weather-cat",
    featured: false,
    status: "live",
  },
  {
    id: "purr-type",
    title: "Purr Type",
    description: "Type a word, watch its letters purr, and scatter them with your mouse.",
    category: "experiments",
    tags: ["PixiJS"],
    thumbnail: "/thumbnails/purr-type.svg",
    href: "/prototypes/purr-type",
    featured: false,
    status: "live",
  },
  {
    id: "typography-experiments",
    title: "Typography Experiments",
    description: "Type a sentence and push its letters around a ring, a wave and a 3D plane.",
    category: "experiments",
    tags: ["Variable fonts", "CSS 3D"],
    thumbnail: "/thumbnails/typography-experiments.svg",
    href: "/prototypes/typography-experiments",
    featured: false,
    status: "live",
  },
  {
    id: "confetti-button",
    title: "Confetti Button",
    description: "An interactive button that sets off a colourful confetti explosion.",
    category: "experiments",
    tags: ["canvas-confetti"],
    thumbnail: "/thumbnails/confetti-button.svg",
    href: "/prototypes/confetti-button",
    featured: false,
    status: "live",
  },
  {
    id: "getting-started",
    title: "Getting Started",
    description: "A short guide to creating a prototype of your own.",
    category: "experiments",
    tags: [],
    thumbnail: "/thumbnails/getting-started.svg",
    href: "/prototypes/example",
    featured: false,
    status: "live",
  },
  {
    id: "my-bookshelf",
    title: "A Constellation of Stories",
    description: "My bookstore as a celestial atlas: every book in my Notion database is a star, every genre a constellation.",
    category: "experiments",
    tags: ["Notion API", "SVG"],
    thumbnail: "/thumbnails/my-bookshelf.svg",
    href: "/prototypes/my-bookshelf",
    featured: false,
    status: "live",
  },

  // Add your new prototype here, like this:
  // {
  //   id: "my-new-prototype",
  //   title: "My New Prototype",
  //   description: "One short sentence about what it does.",
  //   category: "experiments",            // "tarot" | "cat-play" | "experiments"
  //   tags: ["p5.js"],                    // or [] for none
  //   thumbnail: "/thumbnails/my-new-prototype.jpg", // or "" for a placeholder
  //   href: "/prototypes/my-new-prototype",
  //   featured: false,
  //   status: "live",
  // },
];

/* ---------- The cat tree ---------- */

/**
 * Which prototype lives in which room of the 3D cat tree in the hero.
 * The tree is a playful shortcut to five prototypes; every prototype is
 * also listed as a card further down the page.
 *
 * Use a project `id` from the list above. A room whose project is missing
 * (or not "live") is simply left empty.
 */
export const catTreeRooms: Record<RoomId, string> = {
  perch: "getting-started", // the bed at the very top
  bubble: "the-magician", // the glass bubble (crystal ball)
  barrel: "wheel-of-fortune", // the barrel tunnel
  house: "the-tower", // the cube house with the round door
  hammock: "confetti-button", // the U-shaped hammock
};

/* ---------- Small helpers used by the homepage components ---------- */

/** Only "live" projects get a link. */
export function isLive(project: Project) {
  return project.status === "live";
}

/** Look up a category's label and accent colour from its id. */
export function getCategory(id: CategoryId) {
  return categories.find((category) => category.id === id) ?? categories[0];
}

/**
 * A project's number in Roman numerals (I, II, III…), like the number at
 * the top of a tarot card. It comes from the project's place in the array.
 */
export function getNumeral(project: Project) {
  let n = projects.findIndex((p) => p.id === project.id) + 1;
  if (n < 1) return "";
  const steps: [number, string][] = [
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [value, letters] of steps) {
    while (n >= value) {
      out += letters;
      n -= value;
    }
  }
  return out;
}
