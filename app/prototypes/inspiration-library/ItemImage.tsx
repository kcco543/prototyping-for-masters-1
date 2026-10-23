"use client";

/**
 * An item's picture. Pictures come from other websites, which sometimes
 * move or delete them; if one doesn't load, this shows a quiet note instead
 * of the browser's broken-image icon. (Noticing that needs the browser, so
 * this small piece is a client component.)
 */

import { useState } from "react";
import styles from "./boards.module.css";

export default function ItemImage({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) return <span className={styles.itemImageBroken}>The picture couldn&apos;t be loaded</span>;

  return (
    // A plain <img>: the picture can come from any website.
    <img
      className={styles.itemImage}
      src={src}
      alt={alt}
      loading="lazy"
      // Don't tell the other website which page you're on.
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
