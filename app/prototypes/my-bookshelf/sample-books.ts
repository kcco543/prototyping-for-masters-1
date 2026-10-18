/**
 * My bookshelf — a few made-up entries for previewing the design before
 * Notion is connected ("Preview with sample books" on the setup screen).
 *
 * They are never mixed with your real books. The reviews are invented, and
 * there are no cover pictures, so you can see the drawn covers that appear
 * whenever a book has no Cover Image.
 */

import type { Book } from "./books";

const added = (daysAgo: number) => new Date(Date.UTC(2026, 9, 16) - daysAgo * 86_400_000).toISOString();

export const SAMPLE_BOOKS: Book[] = [
  {
    id: "sample-1",
    title: "A Wizard of Earthsea",
    author: "Ursula K. Le Guin",
    genre: { name: "Fantasy", color: "purple" },
    cover: null,
    rating: 5,
    review: "Quiet, strange and wise. Magic here is about knowing the true names of things, and growing up is about learning your own.",
    addedAt: added(2),
    url: null,
  },
  {
    id: "sample-2",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    genre: { name: "Classic", color: "brown" },
    cover: null,
    rating: 4.5,
    review: "Funnier than I remembered. Every conversation is a small fencing match.",
    addedAt: added(9),
    url: null,
  },
  {
    id: "sample-3",
    title: "Frankenstein",
    author: "Mary Shelley",
    genre: { name: "Horror", color: "red" },
    cover: null,
    rating: 4,
    review:
      "Not the monster story I expected. It's mostly about loneliness, and about what we owe the things we make.\n\nThe frame story (letters from an Arctic expedition) felt slow at first, but it pays off: by the end you see two obsessed men mirroring each other across the ice. Reading it again in autumn was the right call.",
    addedAt: added(21),
    url: null,
  },
  {
    id: "sample-4",
    title: "The Left Hand of Darkness",
    author: "Ursula K. Le Guin",
    genre: { name: "Science fiction", color: "blue" },
    cover: null,
    rating: 4.5,
    review: "A cold planet and a warm book. The long journey across the ice is one of my favourite stretches of any novel.",
    addedAt: added(35),
    url: null,
  },
  {
    id: "sample-5",
    title: "Kitchen",
    author: "Banana Yoshimoto",
    genre: { name: "Literary fiction", color: "green" },
    cover: null,
    rating: 4,
    review: "Short, sad and somehow cosy. Read it in one sitting with a pot of tea.",
    addedAt: added(48),
    url: null,
  },
  {
    id: "sample-6",
    title: "Braiding Sweetgrass",
    author: "Robin Wall Kimmerer",
    genre: { name: "Nonfiction", color: "yellow" },
    cover: null,
    rating: 5,
    review: "Changed how I look at the plants on my walk to the studio.",
    addedAt: added(60),
    url: null,
  },
  {
    id: "sample-7",
    title: "The Remains of the Day",
    author: "Kazuo Ishiguro",
    genre: { name: "Literary fiction", color: "green" },
    cover: null,
    rating: 3.5,
    review: "",
    addedAt: added(74),
    url: null,
  },
  {
    id: "sample-8",
    title: "Piranesi",
    author: "Susanna Clarke",
    genre: { name: "Fantasy", color: "purple" },
    cover: null,
    rating: null,
    review: "Still reading the ending. Rating later!",
    addedAt: added(80),
    url: null,
  },
];
