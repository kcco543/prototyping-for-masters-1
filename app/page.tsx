/**
 * The homepage: "Jiaqi's Little Universe", a gallery of prototypes.
 *
 * Sections, top to bottom:
 *   header → hero (with the cat tree) → Featured Projects → All Prototypes
 *   (with category filters) → About → the cat lounge → footer
 *
 * The prototypes themselves are NOT listed in this file. They live in
 * app/data/projects.ts. Add a prototype there and it shows up here.
 */

import Link from "next/link";
import styles from "./styles/home.module.css";
import { caveat, instrumentSans, instrumentSerif } from "./fonts";
import { catTreeRooms, categories, getCategory, isLive, projects } from "./data/projects";
import CatTree, { type RoomId, type TreePrototype } from "./components/cat-tree/CatTree";
import { CatDefs, CatLounge } from "./components/playful-cats/PlayfulCats";
import { HeroSky, Sparkle } from "./components/celestial/Celestial";
import FeaturedProjects from "./components/gallery/FeaturedProjects";
import ProjectGallery from "./components/gallery/ProjectGallery";
import SectionHeading from "./components/gallery/SectionHeading";

export default function Home() {
  const liveCount = projects.filter(isLive).length;
  const comingSoonCount = projects.length - liveCount;

  // Fill the rooms of the cat tree from the projects data.
  // A room whose project is missing or not "live" stays empty (just decoration).
  const treeRooms: TreePrototype[] = (Object.keys(catTreeRooms) as RoomId[]).flatMap((room) => {
    const project = projects.find((p) => p.id === catTreeRooms[room]);
    if (!project || !isLive(project)) return [];
    return [
      {
        title: project.title,
        description: project.description,
        path: project.href,
        room,
        accent: getCategory(project.category).accent,
      },
    ];
  });

  // Every technology tag used by the projects, each listed once
  const tools = [...new Set(projects.flatMap((project) => project.tags))];

  return (
    <div id="top" className={`${styles.page} ${instrumentSans.className} ${caveat.variable} ${instrumentSerif.variable}`}>
      {/* Lets keyboard users jump straight past the header and the cat tree */}
      <a href="#prototypes" className={styles.skipLink}>
        Skip to the prototypes
      </a>

      {/* Shared texture used by every cat drawing */}
      <CatDefs />

      <header className={`${styles.container} ${styles.header}`}>
        <Link href="/" className={styles.wordmark}>
          {/* the same little cat head as the "back home" button on every prototype */}
          <svg className={styles.wordmarkCat} viewBox="0 0 24 22" aria-hidden="true">
            <path d="M3 21 C1 15 2 9 3.5 3 L8 7.5 C10.6 6.8 13.4 6.8 16 7.5 L20.5 3 C22 9 23 15 21 21Z" />
            <circle className={styles.wordmarkEye} cx="8.8" cy="14" r="1.35" />
            <circle className={styles.wordmarkEye} cx="15.2" cy="14" r="1.35" />
          </svg>
          Jiaqi Yuan&rsquo;s prototypes
        </Link>
        <nav className={styles.nav} aria-label="Sections of this page">
          <a href="#prototypes" className={styles.navLink}>
            Explore
          </a>
          <a href="#about" className={styles.navLink}>
            About
          </a>
        </nav>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className={`${styles.container} ${styles.hero}`} aria-labelledby="hero-title">
          <div className={styles.heroText}>
            <p className={styles.eyebrow}>
              <Sparkle className={styles.eyebrowStar} />
              Prototype gallery · {liveCount} playable experiments
            </p>
            <h1 id="hero-title" className={styles.heroTitle}>
              <span className={styles.heroLine}>Jiaqi&rsquo;s</span>{" "}
              <span className={styles.heroLine}>
                <em className={styles.heroItalic}>Little</em> Universe
              </span>
            </h1>
            <p className={styles.heroLead}>
              A collection of curious cats, magical interactions, and creative coding experiments.
            </p>
            <div className={styles.heroActions}>
              <a href="#prototypes" className={styles.button}>
                Explore the prototypes
                <span className={styles.buttonArrow} aria-hidden="true">
                  ↓
                </span>
              </a>
              <a href="#about" className={styles.textLink}>
                About this place
              </a>
            </div>
          </div>

          {/* The cat tree: a playful shortcut to five prototypes. Every
              prototype is also a card further down, so it's never the only way in. */}
          <div className={styles.heroArt}>
            <div className={styles.heroSky}>
              <HeroSky />
            </div>
            <CatTree prototypes={treeRooms} />
          </div>
        </section>

        <div className={`${styles.container} ${styles.rule}`} aria-hidden="true">
          <Sparkle />
        </div>

        {/* ---------- Featured Projects ---------- */}
        <div className={styles.container}>
          <FeaturedProjects projects={projects} />
        </div>

        {/* ---------- All Prototypes ---------- */}
        <section id="prototypes" className={`${styles.container} ${styles.section}`} aria-labelledby="prototypes-title">
          <SectionHeading
            id="prototypes-title"
            eyebrow="The full deck"
            title="All Prototypes"
            note="Everything in one place. Filter by collection, then pick a card to open it."
          />
          <ProjectGallery projects={projects} />
        </section>

        {/* ---------- About ---------- */}
        <section id="about" className={`${styles.container} ${styles.section} ${styles.about}`} aria-labelledby="about-title">
          <SectionHeading id="about-title" eyebrow="About" title="A small universe, mostly cats" />
          <div className={styles.aboutBody}>
            <p className={styles.aboutLead}>
              Hi, I&rsquo;m Jiaqi. This is where I keep my prototypes: small, playable sketches that start from a cat, a
              tarot card, or a question like &ldquo;what if letters could purr?&rdquo;
            </p>
            <p className={styles.aboutText}>
              Each one is an experiment in illustration, type, sound or motion, built quickly to try out an idea. Some
              are games, some are toys, and a few are just nice to look at. Open one, poke at it, and see what it does.
            </p>
            <dl className={styles.facts}>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Prototypes</dt>
                <dd className={styles.factValue}>
                  {liveCount} to play with
                  {comingSoonCount > 0 && `, ${comingSoonCount} in the works`}
                </dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Collections</dt>
                <dd className={styles.factValue}>{categories.map((category) => category.label).join(", ")}</dd>
              </div>
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Made with</dt>
                <dd className={styles.factValue}>{tools.join(", ")}</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* ---------- The cat lounge ---------- */}
        {/* The cats have their own strip of the page. Inside it the cursor
            becomes a laser dot they chase; they can't leave it, so they never
            cover a card, a button or any text. */}
        <div className={styles.lounge}>
          <p className={styles.loungeNote}>psst… the cats like to be clicked</p>
          <CatLounge />
        </div>
      </main>

      <footer className={`${styles.container} ${styles.footer}`}>
        <p>© {new Date().getFullYear()} Jiaqi Yuan · Made with curiosity, code and cats</p>
        <a href="#top" className={styles.footerLink}>
          Back to top <span aria-hidden="true">↑</span>
        </a>
      </footer>
    </div>
  );
}
