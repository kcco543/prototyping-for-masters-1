"use client";

/** "Copy link" for a public board: puts this page's address on the clipboard. */

import { useState } from "react";
import styles from "./styles.module.css";

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Some browsers block the clipboard; the address bar still has the link.
      window.prompt("Copy this link:", window.location.href);
    }
  }

  return (
    <button className={styles.buttonSmallQuiet} type="button" onClick={copy}>
      <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
    </button>
  );
}
