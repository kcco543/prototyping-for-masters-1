import styles from './styles/home.module.css';
import { caveat, instrumentSans } from './fonts';
import { BottomCats, CatDefs, LaserPointer, TopCats } from './components/playful-cats/PlayfulCats';
import CatTree, { type TreePrototype } from './components/cat-tree/CatTree';

// Accent colours taken from the cats' fur. Each room's name tag gets one for its "ears".
const accents = ['#f0893d', '#ec8e85', '#aaa99d', '#b8633a', '#6d6d71'];

export default function Home() {
  // Add your prototypes to this array.
  // Each one lives in a room of the cat tree. The rooms are:
  //   'perch'   – the bed at the very top
  //   'bubble'  – the glass bubble (crystal ball)
  //   'barrel'  – the barrel tunnel
  //   'house'   – the cube house with the round door
  //   'hammock' – the U-shaped hammock
  // A prototype without a room (or in a room that's already taken) is listed
  // under the tree in "More rooms".
  const prototypes: Omit<TreePrototype, 'accent'>[] = [
    {
      title: 'Getting started',
      description: 'How to create a prototype',
      path: '/prototypes/example',
      room: 'perch'
    },
    {
      title: 'Confetti button',
      description: 'An interactive button that creates a colorful confetti explosion',
      path: '/prototypes/confetti-button',
      room: 'hammock'
    },
    {
      title: 'The Tower',
      description: 'A curious cat knocks cups off the shelves. Catch every one before it hits the floor!',
      path: '/prototypes/the-tower',
      room: 'house'
    },
    {
      title: 'The Magician',
      description: 'Scroll through typefaces for the word “cat”, then reveal the cat your font summons.',
      path: '/prototypes/the-magician',
      room: 'bubble'
    },
    {
      title: 'Wheel of Fortune',
      description: 'Think of a question, tap the cat, and let its unravelling yarn spell out your answer.',
      path: '/prototypes/wheel-of-fortune',
      room: 'barrel'
    },
    // Add your new prototypes here like this:
    // {
    //   title: 'Your new prototype',
    //   description: 'A short description of what this prototype does',
    //   path: '/prototypes/my-new-prototype',
    //   room: 'house' // optional
    // },
  ];

  return (
    <div className={`${styles.page} ${instrumentSans.className} ${caveat.variable}`}>
      {/* Shared texture used by every cat drawing */}
      <CatDefs />

      {/* The cursor becomes a laser dot that the cats chase */}
      <LaserPointer />

      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Jiaqi Yuan&apos;s prototypes</h1>
          <p className={styles.hint}>psst… the cats like to be clicked</p>
        </header>

        {/* On small screens these cats show up here, above the cat tree */}
        <TopCats />

        <main>
          {/* The prototypes live in the rooms of this rotatable cat tree */}
          <CatTree prototypes={prototypes.map((p, i) => ({ ...p, accent: accents[i % accents.length] }))} />
        </main>

        {/* …and these ones below it */}
        <BottomCats />
      </div>
    </div>
  );
}
