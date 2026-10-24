"use client";

/**
 * The bookmarklet itself: a link whose address is a tiny program
 * ("javascript:…") instead of a web address. Drag it to your bookmarks bar;
 * clicking that bookmark on any website runs the program ON THAT WEBSITE,
 * which reads the page's address and title and opens our "Save to a board"
 * window (save/page.tsx) with them.
 *
 * WHY THE ADDRESS IS SET IN useEffect
 * React refuses to put a `javascript:` address in an href, because on most
 * websites that's how attackers sneak code into links. Here it's exactly
 * what we want, and the code is our own, fixed text (nothing typed by
 * anyone goes in), so we set it on the link ourselves once it's on the page.
 *
 * WHY window.location.origin
 * The bookmarklet must open THIS website from any other one, so it needs
 * our full address: http://localhost:3000 on your computer, your Vercel
 * address on the live site. Using the address this page was opened at
 * means each copy makes a bookmarklet for itself.
 */

import { useEffect, useRef } from "react";
import { SAVE } from "./lib/paths";
import styles from "./styles.module.css";

/** The bookmarklet's program, readable. It's squeezed onto one line below. */
function bookmarkletCode(saveAddress: string) {
  const program = `
    (() => {
      const width = 480, height = 640;
      const address = ${JSON.stringify(saveAddress)}
        + "?url=" + encodeURIComponent(location.href)
        + "&title=" + encodeURIComponent(document.title);
      window.open(
        address,
        "inspirationLibrarySave",
        "popup,noopener,width=" + width + ",height=" + height
          + ",left=" + Math.max(0, (screen.width - width) / 2)
          + ",top=" + Math.max(0, (screen.height - height) / 3)
      );
    })();`;
  // A bookmark is one line, so squeeze out the line breaks and indentation.
  return "javascript:" + program.replace(/\s*\n\s*/g, " ").trim();
}

export default function BookmarkletLink() {
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    link.current?.setAttribute("href", bookmarkletCode(window.location.origin + SAVE));
  }, []);

  return (
    <a
      ref={link}
      className={styles.bookmarklet}
      // Clicking it HERE would just open the window for this page, which isn't what you want.
      onClick={(event) => {
        event.preventDefault();
        alert("Drag this button to your bookmarks bar, then click the bookmark on any website.");
      }}
      title="Drag me to your bookmarks bar"
    >
      ✦ Save to Inspiration
    </a>
  );
}
