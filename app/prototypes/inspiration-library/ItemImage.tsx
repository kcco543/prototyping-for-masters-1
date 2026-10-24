"use client";

/**
 * An item's picture. Pictures from other websites are sometimes moved or
 * deleted, and an uploaded one's signed link can fail; if one doesn't load
 * (or there's no address at all), this shows a quiet note instead of the
 * browser's broken-image icon. (Noticing that needs the browser, so
 * this small piece is a client component.)
 */

import { useState } from "react";
import styles from "./boards.module.css";

/** `fill`: cover a square tile, cropping the edges (the "By colour" view). */
export default function ItemImage({ src, alt, fill = false }: { src: string | null; alt: string; fill?: boolean }) {
  const [broken, setBroken] = useState(false);

  if (broken || !src) return <span className={styles.itemImageBroken}>The picture couldn&apos;t be loaded</span>;

  return (
    // A plain <img>: the picture can come from any website.
    <img
      className={fill ? styles.itemImageFill : styles.itemImage}
      src={src}
      alt={alt}
      loading="lazy"
      // Don't tell the other website which page you're on.
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
