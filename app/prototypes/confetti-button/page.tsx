"use client";

import { useState } from 'react';
import styles from './styles.module.css';
import BackHome from '../../components/back-home/BackHome';
import confetti from 'canvas-confetti';

export default function ConfettiButtonPrototype() {
  const [isAnimating, setIsAnimating] = useState(false);

  const triggerConfetti = () => {
    setIsAnimating(true);
    
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FF69B4', '#00FFFF', '#9932CC'], // Pink, bright aqua, purple
      shapes: ['square'], // Keep the square particles for the pixel look
    });

    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <div className={styles.container}>
      {/* Shared back button, in this page's retro style: outlined, hard shadow, confetti-pink ears */}
      <BackHome variant="retro" placement="floating" accent="#FF69B4" surface="#ffffff" ink="#000000" />
      
      <div className={styles.window}>
        <div className={styles.windowTitle}>
          Confetti button
        </div>
        <div className={styles.windowContent}>
          <h1 className={styles.title}>Congratulations! You have set up your first repository.</h1>
          <button 
            className={`${styles.confettiButton} ${isAnimating ? styles.animate : ''}`}
            onClick={triggerConfetti}
          >
            Celebrate
          </button>
        </div>
      </div>
    </div>
  );
} 