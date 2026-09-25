"use client";

import { useState } from 'react';
import Link from 'next/link';
import styles from './styles/home.module.css';
import { instrumentSans, cinzel } from './fonts';

interface Prototype {
  title: string;
  description: string;
  path: string;
  arcana?: string;
  archetype?: string;
  glyph?: string;
}

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Convert index to traditional Roman numerals
  const toRoman = (num: number): string => {
    const romanNumerals = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romanNumerals[num] || String(num);
  };

  // The 3 prototypes array (Button 1, Button 2, and Button 3 to the right)
  const prototypes: Prototype[] = [
    {
      title: 'Getting started',
      description: 'The seed of creation. A foundational guide to forging interactive prototypes.',
      path: '/prototypes/example',
      arcana: 'I',
      archetype: 'The Initiate',
      glyph: '☼',
    },
    {
      title: 'Confetti button',
      description: 'An eruption of radiant celebration. An interactive catalyst unleashing color.',
      path: '/prototypes/confetti-button',
      arcana: 'II',
      archetype: 'The Catalyst',
      glyph: '✨',
    },
    {
      title: 'A Reading for Yourself',
      description: 'Consult the celestial deck. Draw a card to unveil guidance, clarity, and creative intuition.',
      path: '/prototypes/a-reading-for-yourself',
      arcana: 'III',
      archetype: 'The Oracle',
      glyph: '🔮',
    },
  ];

  const slidePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : prototypes.length - 1));
  };

  const slideNext = () => {
    setActiveIndex((prev) => (prev < prototypes.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className={`${styles.wrapper} ${instrumentSans.className}`}>
      {/* Ambient mystical nebula & celestial starfield */}
      <div className={styles.celestialBackdrop} aria-hidden="true" />
      <div className={styles.starfield} aria-hidden="true" />
      <div className={styles.clothTexture} aria-hidden="true" />

      {/* Slowly rotating astrological chart */}
      <div className={styles.astroChartWrap} aria-hidden="true">
        <svg
          className={styles.astroChart}
          viewBox="0 0 600 600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          {/* Outer degree ring */}
          <circle cx="300" cy="300" r="288" stroke="rgba(212,175,55,0.18)" strokeWidth="1" />
          <circle cx="300" cy="300" r="272" stroke="rgba(212,175,55,0.10)" strokeWidth="0.5" />

          {/* 72 degree tick marks (every 5°) */}
          {Array.from({ length: 72 }).map((_, i) => {
            const angle = (i * 5 * Math.PI) / 180;
            const isMajor = i % 6 === 0;
            const r1 = isMajor ? 272 : 278;
            const r2 = 288;
            return (
              <line
                key={i}
                x1={300 + r1 * Math.cos(angle)}
                y1={300 + r1 * Math.sin(angle)}
                x2={300 + r2 * Math.cos(angle)}
                y2={300 + r2 * Math.sin(angle)}
                stroke={isMajor ? 'rgba(212,175,55,0.45)' : 'rgba(212,175,55,0.18)'}
                strokeWidth={isMajor ? 1 : 0.5}
              />
            );
          })}

          {/* 12 house division lines (every 30°) */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={300 + 110 * Math.cos(angle)}
                y1={300 + 110 * Math.sin(angle)}
                x2={300 + 270 * Math.cos(angle)}
                y2={300 + 270 * Math.sin(angle)}
                stroke="rgba(212,175,55,0.22)"
                strokeWidth="0.75"
              />
            );
          })}

          {/* Concentric structural rings */}
          <circle cx="300" cy="300" r="240" stroke="rgba(212,175,55,0.14)" strokeWidth="0.5" strokeDasharray="4 6" />
          <circle cx="300" cy="300" r="200" stroke="rgba(139,92,246,0.20)" strokeWidth="0.75" />
          <circle cx="300" cy="300" r="160" stroke="rgba(212,175,55,0.16)" strokeWidth="0.5" strokeDasharray="2 8" />
          <circle cx="300" cy="300" r="110" stroke="rgba(212,175,55,0.22)" strokeWidth="0.75" />
          <circle cx="300" cy="300" r="60"  stroke="rgba(139,92,246,0.25)" strokeWidth="1" />
          <circle cx="300" cy="300" r="28"  stroke="rgba(212,175,55,0.35)" strokeWidth="1" />

          {/* Zodiac glyphs at midpoints of each 30° house */}
          {['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'].map((glyph, i) => {
            const angle = ((i * 30 + 15) * Math.PI) / 180;
            const r = 256;
            return (
              <text
                key={i}
                x={300 + r * Math.cos(angle)}
                y={300 + r * Math.sin(angle)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="13"
                fill="rgba(212,175,55,0.55)"
                fontFamily="serif"
              >
                {glyph}
              </text>
            );
          })}

          {/* Planetary aspect lines — inner hexagram (trine) */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const a1 = (deg * Math.PI) / 180;
            const a2 = ((deg + 120) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={300 + 195 * Math.cos(a1)}
                y1={300 + 195 * Math.sin(a1)}
                x2={300 + 195 * Math.cos(a2)}
                y2={300 + 195 * Math.sin(a2)}
                stroke="rgba(139,92,246,0.20)"
                strokeWidth="0.75"
              />
            );
          })}

          {/* Inner sacred square (opposition lines) */}
          {[45, 135, 225, 315].map((deg, i) => {
            const a1 = (deg * Math.PI) / 180;
            const a2 = ((deg + 90) * Math.PI) / 180;
            return (
              <line
                key={i}
                x1={300 + 195 * Math.cos(a1)}
                y1={300 + 195 * Math.sin(a1)}
                x2={300 + 195 * Math.cos(a2)}
                y2={300 + 195 * Math.sin(a2)}
                stroke="rgba(212,175,55,0.15)"
                strokeWidth="0.75"
              />
            );
          })}

          {/* Planet markers on the mid-ring */}
          {[22, 58, 97, 143, 189, 241, 305].map((deg, i) => {
            const angle = (deg * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={300 + 200 * Math.cos(angle)}
                cy={300 + 200 * Math.sin(angle)}
                r="3.5"
                fill="rgba(251,238,164,0.55)"
              />
            );
          })}

          {/* Ascendant / Midheaven cross lines */}
          <line x1="12" y1="300" x2="588" y2="300" stroke="rgba(212,175,55,0.18)" strokeWidth="0.5" />
          <line x1="300" y1="12" x2="300" y2="588" stroke="rgba(212,175,55,0.18)" strokeWidth="0.5" />

          {/* Centre glyph */}
          <text
            x="300" y="300"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="22"
            fill="rgba(212,175,55,0.45)"
            fontFamily="serif"
          >
            ✦
          </text>
        </svg>
      </div>

      <div className={styles.container}>
        {/* Occult deck top bar */}
        <div className={styles.deckHeaderBar}>
          <div className={styles.altarTag}>
            <span className={styles.altarStar} aria-hidden="true">✦</span>
            <span>The Proto-Arcana Deck</span>
            <span className={styles.altarStar} aria-hidden="true">✦</span>
          </div>
          <span className={styles.deckStatus}>
            Spread: {prototypes.length} Cards Revealed • Upright
          </span>
        </div>

        {/* Altar header */}
        <header className={styles.header}>
          <div className={styles.celestialGlyphRow} aria-hidden="true">
            <span className={styles.glyphLine} />
            <span>✧ ☽ ☼ ☾ ✧</span>
            <span className={styles.glyphLine} />
          </div>

          <h1 className={`${styles.title} ${cinzel.className}`}>
            Jiaqi Yuan's prototypes
          </h1>

          <p className={styles.subtitle}>
            A divined spread of interactive artifacts, computational experiments, and creative mechanisms.
          </p>
        </header>

        {/* Smooth Sliding Transition Controller */}
        <div className={styles.slidingControlWrapper}>
          <button 
            type="button" 
            className={styles.sliderArrowButton}
            onClick={slidePrev}
            aria-label="Slide to previous card"
          >
            ←
          </button>

          <div className={styles.sliderTrack}>
            {/* The Glider that smoothly slides horizontally between the three buttons */}
            <div 
              className={styles.slidingGlider}
              style={{
                width: `calc(${100 / prototypes.length}% - 4px)`,
                transform: `translateX(calc(${activeIndex * 100}% + ${activeIndex * 4}px))`
              }}
              aria-hidden="true"
            />

            {prototypes.map((prototype, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.sliderSegment} ${activeIndex === index ? styles.sliderSegmentActive : ''} ${cinzel.className}`}
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span>✦ Arcana {prototype.arcana}</span>
              </button>
            ))}
          </div>

          <button 
            type="button" 
            className={styles.sliderArrowButton}
            onClick={slideNext}
            aria-label="Slide to next card"
          >
            →
          </button>
        </div>

        {/* Three Tarot Cards in a row with smooth sliding transition */}
        <main>
          <section className={styles.grid}>
            {prototypes.map((prototype, index) => {
              const romanNumeral = prototype.arcana || toRoman(index + 1);
              const archetype = prototype.archetype || 'The Artifact';
              const glyph = prototype.glyph || '✦';
              const isActive = activeIndex === index;

              return (
                <Link 
                  key={index}
                  href={prototype.path} 
                  className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                >
                  {/* Ornate inner tarot border & gold corner stars */}
                  <div className={styles.cardInnerBorder} aria-hidden="true" />
                  <div className={styles.cardShimmer} aria-hidden="true" />
                  <span className={styles.cornerTopLeft} aria-hidden="true">✦</span>
                  <span className={styles.cornerTopRight} aria-hidden="true">✦</span>
                  <span className={styles.cornerBottomLeft} aria-hidden="true">✦</span>
                  <span className={styles.cornerBottomRight} aria-hidden="true">✦</span>

                  {/* Card upper arcana indices */}
                  <div className={styles.cardTop}>
                    <span className={`${styles.romanNumeral} ${cinzel.className}`}>
                      Arcana {romanNumeral}
                    </span>
                    <span className={styles.arcanaBadge}>Upright</span>
                  </div>

                  {/* Portal arch artwork framing */}
                  <div className={styles.portalFrame}>
                    <span className={styles.portalGlyph} aria-hidden="true">
                      {glyph}
                    </span>
                  </div>

                  {/* Card core message & archetype */}
                  <div className={styles.cardContent}>
                    <p className={`${styles.archetypeLabel} ${cinzel.className}`}>
                      {archetype}
                    </p>
                    <h2 className={`${styles.cardTitle} ${cinzel.className}`}>
                      {prototype.title}
                    </h2>
                    <p className={styles.cardDescription}>
                      {prototype.description}
                    </p>
                  </div>

                  {/* Card bottom invocation */}
                  <div className={styles.cardBottom}>
                    <span className={styles.cardPathText}>{prototype.path}</span>
                    <span className={`${styles.drawCardPrompt} ${cinzel.className}`}>
                      Draw Card <span>→</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        </main>

        {/* Mystical colophon footer */}
        <footer className={styles.footer}>
          <div className={styles.altarDivider} />
          <div className={styles.moonPhases} aria-hidden="true">
            🌑 🌒 🌓 🌔 🌕 🌖 🌗 🌘 🌑
          </div>
          <p className={`${styles.footerText} ${cinzel.className}`}>
            As Above, So Below • Prototyping for Masters
          </p>
        </footer>
      </div>
    </div>
  );
}
