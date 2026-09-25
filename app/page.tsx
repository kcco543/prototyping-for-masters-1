import Link from "next/link";
import type { CSSProperties } from "react";
import styles from './styles/home.module.css';
import { caveat, instrumentSans } from './fonts';
import { BottomCats, CatDefs, TopCats } from './components/playful-cats/PlayfulCats';

// Accent colours taken from the cats' fur. Each card gets one for its "ears".
const accents = ['#f0893d', '#ec8e85', '#f3c04a', '#aaa99d', '#b8633a', '#6d6d71'];

export default function Home() {
  // Add your prototypes to this array
  const prototypes = [
    {
      title: 'Getting started',
      description: 'How to create a prototype',
      path: '/prototypes/example'
    },
    {
      title: 'Confetti button',
      description: 'An interactive button that creates a colorful confetti explosion',
      path: '/prototypes/confetti-button'
    },
    {
      title: 'The Tower',
      description: 'A curious cat knocks cups off the shelves. Catch every one before it hits the floor!',
      path: '/prototypes/the-tower'
    },
    {
      title: 'The Magician',
      description: 'Scroll through typefaces for the word “cat”, then reveal the cat your font summons.',
      path: '/prototypes/the-magician'
    },
    {
      title: 'Wheel of Fortune',
      description: 'Think of a question, tap the cat, and let its unravelling yarn spell out your answer.',
      path: '/prototypes/wheel-of-fortune'
    },
    // Add your new prototypes here like this:
    // {
    //   title: 'Your new prototype',
    //   description: 'A short description of what this prototype does',
    //   path: '/prototypes/my-new-prototype'
    // },
  ];

  return (
    <div className={`${styles.page} ${instrumentSans.className} ${caveat.variable}`}>
      {/* Shared texture used by every cat drawing */}
      <CatDefs />

      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Jiaqi Yuan&apos;s prototypes</h1>
          <p className={styles.hint}>psst… the cats like to be clicked</p>
        </header>

        {/* On small screens these cats show up here, above the cards */}
        <TopCats />

        <main>
          <section className={styles.grid}>
            {/* Goes through the prototypes list (array) to create cards */}
            {prototypes.map((prototype, index) => (
              <Link
                key={index}
                href={prototype.path}
                className={styles.card}
                style={{ '--accent': accents[index % accents.length] } as CSSProperties}
              >
                <h3 className={styles.cardTitle}>{prototype.title}</h3>
                <p className={styles.cardText}>{prototype.description}</p>
              </Link>
            ))}
          </section>
        </main>

        {/* …and these ones below the cards */}
        <BottomCats />
      </div>
    </div>
  );
}
