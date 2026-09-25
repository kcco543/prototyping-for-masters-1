"use client";

import { useState } from 'react';
import Link from 'next/link';
import styles from './styles.module.css';
import { cinzel, instrumentSans } from '../../fonts';

interface TarotCard {
  arcana: string;
  name: string;
  glyph: string;
  theme: string;
  interpretation: string;
  prompt: string;
}

interface SpreadPosition {
  slotTitle: string;
  slotRole: string;
  cardIndex: number;
}

const TAROT_DECK: TarotCard[] = [
  {
    arcana: 'I',
    name: 'The Magician',
    glyph: '☿',
    theme: 'Creation & Mastery',
    interpretation: 'All tools are laid upon your altar. You possess the raw skills, language, and technology to manifest your intention into form.',
    prompt: 'What prototype have you hesitated to start? The medium is ready for your touch.'
  },
  {
    arcana: 'II',
    name: 'The High Priestess',
    glyph: '☽',
    theme: 'Intuition & Mystery',
    interpretation: 'Look beyond the obvious metrics. The most profound design insights lie in quiet spaces, user subtleties, and unspoken needs.',
    prompt: 'Step back from rapid coding for a moment. Listen to what the system wants to be.'
  },
  {
    arcana: 'III',
    name: 'The Empress',
    glyph: '♀',
    theme: 'Nurture & Abundance',
    interpretation: 'Generous creativity and aesthetic fertility. Allow your early iterations to blossom freely before ruthlessly editing.',
    prompt: 'Give your prototype permission to be playful, rich, and sensorial.'
  },
  {
    arcana: 'IV',
    name: 'The Emperor',
    glyph: '♈',
    theme: 'Structure & Order',
    interpretation: 'Architectural clarity and rock-solid foundational systems. Solid design systems provide safety for fluid experimentation.',
    prompt: 'Where does your code or UI structure need clean, disciplined scaffolding?'
  },
  {
    arcana: 'VII',
    name: 'The Chariot',
    glyph: '♋',
    theme: 'Momentum & Will',
    interpretation: 'Harnessing opposing design tensions into singular forward drive. Speed and conviction will carry this iteration across the threshold.',
    prompt: 'Pick your main design decision and commit to it with full momentum.'
  },
  {
    arcana: 'IX',
    name: 'The Hermit',
    glyph: '♍',
    theme: 'Reflection & Solitude',
    interpretation: 'A solitary lantern illuminating deep craft. Quiet focus away from feedback noise allows your core idea to solidify.',
    prompt: 'Spend an uninterrupted hour tuning micro-interactions and typographic rhythm.'
  },
  {
    arcana: 'X',
    name: 'Wheel of Fortune',
    glyph: '☸',
    theme: 'Cycles & Iteration',
    interpretation: 'Change is the only constant in prototyping. A failed test is merely the wheel turning toward a better realization.',
    prompt: 'Treat your latest glitch not as a bug, but as an invitation to pivot.'
  },
  {
    arcana: 'XVII',
    name: 'The Star',
    glyph: '✦',
    theme: 'Clarity & Inspiration',
    interpretation: 'A beacon shining through complex constraints. Your vision is clearing, and simplicity will guide your interface to beauty.',
    prompt: 'Strip away one layer of complexity. Let the core experience illuminate the user.'
  },
  {
    arcana: 'XIX',
    name: 'The Sun',
    glyph: '☼',
    theme: 'Radiance & Joy',
    interpretation: 'Unabashed delight and playfulness. The best prototypes spark instant warmth and an intuitive smile.',
    prompt: 'Where can you inject micro-delight or tactile celebration into your flow?'
  },
  {
    arcana: 'XXI',
    name: 'The World',
    glyph: '🎴',
    theme: 'Wholeness & Synthesis',
    interpretation: 'Hardware, software, typography, and emotion merging into a coherent design artifact.',
    prompt: 'Step back and witness your work as a holistic ecosystem.'
  }
];

// Generates 3 distinct random cards from the deck
function drawThreeDistinctCards(): number[] {
  const indices: number[] = [];
  while (indices.length < 3) {
    const candidate = Math.floor(Math.random() * TAROT_DECK.length);
    if (!indices.includes(candidate)) {
      indices.push(candidate);
    }
  }
  return indices;
}

export default function ReadingForYourselfPrototype() {
  // Array of 3 card indices currently dealt
  const [spreadIndices, setSpreadIndices] = useState<number[]>([0, 7, 9]);
  
  // Sequential revelation step: 0 = none, 1 = first revealed, 2 = second revealed, 3 = all revealed
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);

  const spreadPositions: SpreadPosition[] = [
    { slotTitle: 'I. The Origin', slotRole: 'Past & Foundation', cardIndex: spreadIndices[0] },
    { slotTitle: 'II. The Catalyst', slotRole: 'Present & Craft', cardIndex: spreadIndices[1] },
    { slotTitle: 'III. The Horizon', slotRole: 'Future & Synthesis', cardIndex: spreadIndices[2] }
  ];

  // Reveals the next card in sequence (0 -> 1 -> 2)
  const revealNextCard = () => {
    if (isShuffling) return;
    if (revealedCount < 3) {
      setRevealedCount((prev) => prev + 1);
    } else {
      // Reset and deal fresh spread
      resetAndShuffle();
    }
  };

  // Handles clicking a card directly: reveals next in sequence
  const handleCardClick = (cardIndex: number) => {
    if (isShuffling) return;
    
    // If user clicks the exact next card to be revealed in sequence
    if (cardIndex === revealedCount) {
      setRevealedCount((prev) => prev + 1);
    } else if (cardIndex < revealedCount) {
      // Already revealed, gentle feedback
      return;
    } else {
      // Clicking a card ahead in sequence automatically advances sequence to that card
      setRevealedCount(cardIndex + 1);
    }
  };

  const resetAndShuffle = () => {
    setIsShuffling(true);
    setRevealedCount(0);

    setTimeout(() => {
      const newIndices = drawThreeDistinctCards();
      setSpreadIndices(newIndices);
      setIsShuffling(false);
    }, 400);
  };

  return (
    <div className={`${styles.container} ${instrumentSans.className}`}>
      {/* Mystical backdrop elements */}
      <div className={styles.celestialBackdrop} aria-hidden="true" />
      <div className={styles.starfield} aria-hidden="true" />

      {/* Slowly rotating astrological chart */}
      <div className={styles.astroChartWrap} aria-hidden="true">
        <svg
          className={styles.astroChart}
          viewBox="0 0 600 600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          {/* ── Outer degree ring ── */}
          <circle cx="300" cy="300" r="288" stroke="rgba(212,175,55,0.18)" strokeWidth="1" />
          <circle cx="300" cy="300" r="272" stroke="rgba(212,175,55,0.10)" strokeWidth="0.5" />

          {/* 72 degree tick marks (every 5°) */}
          {Array.from({ length: 72 }).map((_, i) => {
            const angle = (i * 5 * Math.PI) / 180;
            const isMajor = i % 6 === 0; // Every 30° = a zodiac boundary
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

          {/* ── 12 House division lines (every 30°) ── */}
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

          {/* ── Concentric structural rings ── */}
          <circle cx="300" cy="300" r="240" stroke="rgba(212,175,55,0.14)" strokeWidth="0.5" strokeDasharray="4 6" />
          <circle cx="300" cy="300" r="200" stroke="rgba(139,92,246,0.20)" strokeWidth="0.75" />
          <circle cx="300" cy="300" r="160" stroke="rgba(212,175,55,0.16)" strokeWidth="0.5" strokeDasharray="2 8" />
          <circle cx="300" cy="300" r="110" stroke="rgba(212,175,55,0.22)" strokeWidth="0.75" />
          <circle cx="300" cy="300" r="60"  stroke="rgba(139,92,246,0.25)" strokeWidth="1" />
          <circle cx="300" cy="300" r="28"  stroke="rgba(212,175,55,0.35)" strokeWidth="1" />

          {/* ── Zodiac glyphs at midpoints of each 30° house ── */}
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

          {/* ── Planetary aspect lines (inner hexagram geometry) ── */}
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

          {/* ── Inner sacred square ── */}
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

          {/* ── Planet markers on the 200r ring ── */}
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

          {/* ── Ascendant / Midheaven cross lines ── */}
          <line x1="12" y1="300" x2="588" y2="300" stroke="rgba(212,175,55,0.18)" strokeWidth="0.5" />
          <line x1="300" y1="12" x2="300" y2="588" stroke="rgba(212,175,55,0.18)" strokeWidth="0.5" />

          {/* ── Center glyph ── */}
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

      {/* Navigation header */}
      <div className={styles.navBar}>
        <Link href="/" className={`${styles.backButton} ${cinzel.className}`}>
          ← The Altar
        </Link>
        <div className={styles.deckTag}>
          <span className={styles.tagDot} aria-hidden="true" />
          <span>Three-Card Arcana Spread</span>
        </div>
      </div>

      <main className={styles.main}>
        <header className={styles.header}>
          <p className={`${styles.subheading} ${cinzel.className}`}>
            ✦ The Threefold Divination ✦
          </p>
          <h1 className={`${styles.title} ${cinzel.className}`}>
            A Reading for Yourself
          </h1>
          <p className={styles.description}>
            Three celestial cards laid upon the cloth. Reveal them one by one in sequence to unveil your Past Foundation, Present Craft, and Future Horizon.
          </p>
        </header>

        {/* Sequential Revelation Tracker */}
        <div className={styles.trackerBar}>
          {spreadPositions.map((pos, index) => {
            const isRevealed = index < revealedCount;
            const isNext = index === revealedCount;

            return (
              <div 
                key={index}
                className={`${styles.trackerStep} ${isRevealed ? styles.trackerStepRevealed : ''} ${isNext ? styles.trackerStepNext : ''}`}
                onClick={() => isNext && revealNextCard()}
              >
                <span className={styles.trackerStepNum}>{index + 1}</span>
                <span className={`${styles.trackerStepLabel} ${cinzel.className}`}>
                  {pos.slotTitle}
                </span>
                {isRevealed && <span className={styles.revealedCheck} aria-hidden="true">✓</span>}
              </div>
            );
          })}
        </div>

        {/* The 3 Identical Tarot Cards Side by Side */}
        <div className={styles.cardStage}>
          {spreadPositions.map((position, index) => {
            const card = TAROT_DECK[position.cardIndex];
            const isFlipped = index < revealedCount;
            const isNextInSequence = index === revealedCount;

            return (
              <div key={index} className={styles.cardColumn}>
                {/* Column Slot Eyebrow */}
                <div className={styles.slotHeader}>
                  <span className={`${styles.slotTitle} ${cinzel.className}`}>
                    {position.slotTitle}
                  </span>
                  <span className={styles.slotRole}>
                    {position.slotRole}
                  </span>
                </div>

                {/* The Tarot Card */}
                <div 
                  className={`
                    ${styles.tarotCardWrapper} 
                    ${isFlipped ? styles.isFlipped : ''} 
                    ${isShuffling ? styles.isShuffling : ''}
                    ${isNextInSequence ? styles.isNextInSequence : ''}
                  `}
                  onClick={() => handleCardClick(index)}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    isFlipped 
                      ? `${position.slotTitle}: ${card.name}` 
                      : `Click to reveal ${position.slotTitle}`
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCardClick(index);
                    }
                  }}
                >
                  <div className={styles.tarotCardInner}>
                    {/* Card Back (Ornamental Gold & Violet) */}
                    <div className={styles.cardFaceBack}>
                      <div className={styles.backBorder}>
                        <div className={styles.backPattern}>
                          <span className={styles.backCenterStar}>✦</span>
                          <span className={styles.backMoonPhase}>☽ ☼ ☾</span>
                        </div>
                      </div>

                      {isNextInSequence ? (
                        <span className={`${styles.drawPromptOverlay} ${styles.promptPulse} ${cinzel.className}`}>
                          Click to Reveal ✦
                        </span>
                      ) : (
                        <span className={`${styles.drawPromptOverlay} ${styles.promptLocked} ${cinzel.className}`}>
                          Card {index + 1} of 3
                        </span>
                      )}
                    </div>

                    {/* Card Front (Revealed Reading) */}
                    <div className={styles.cardFaceFront}>
                      <div className={styles.frontBorder} />
                      <span className={styles.cornerTL} aria-hidden="true">✦</span>
                      <span className={styles.cornerTR} aria-hidden="true">✦</span>
                      <span className={styles.cornerBL} aria-hidden="true">✦</span>
                      <span className={styles.cornerBR} aria-hidden="true">✦</span>

                      <div className={styles.cardTop}>
                        <span className={`${styles.arcanaNumeral} ${cinzel.className}`}>
                          Arcana {card.arcana}
                        </span>
                        <span className={styles.uprightTag}>Upright</span>
                      </div>

                      <div className={styles.glyphPortal}>
                        <span className={styles.portalGlyph}>{card.glyph}</span>
                      </div>

                      <div className={styles.cardBody}>
                        <span className={`${styles.cardTheme} ${cinzel.className}`}>
                          {card.theme}
                        </span>
                        <h2 className={`${styles.cardName} ${cinzel.className}`}>
                          {card.name}
                        </h2>
                        <p className={styles.interpretation}>
                          {card.interpretation}
                        </p>
                      </div>

                      <div className={styles.cardPromptBox}>
                        <p className={styles.promptLabel}>Prompt for craft:</p>
                        <p className={styles.promptText}>"{card.prompt}"</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sequential Revelation Action Controls */}
        <div className={styles.controls}>
          <button 
            type="button"
            className={`${styles.drawButton} ${cinzel.className}`}
            onClick={revealNextCard}
            disabled={isShuffling}
          >
            {revealedCount === 0 && 'Reveal Card I: The Origin ✦'}
            {revealedCount === 1 && 'Reveal Card II: The Catalyst ✦'}
            {revealedCount === 2 && 'Reveal Card III: The Horizon ✦'}
            {revealedCount === 3 && '✦ Reset & Deal New Spread ✦'}
          </button>

          {revealedCount > 0 && (
            <button 
              type="button"
              className={`${styles.resetSpreadButton} ${cinzel.className}`}
              onClick={resetAndShuffle}
              disabled={isShuffling}
            >
              Reset Spread ↺
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
