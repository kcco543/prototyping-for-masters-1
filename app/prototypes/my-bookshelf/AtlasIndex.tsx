"use client";

/**
 * A Constellation of Stories — the index beside the star map.
 *
 * Like the index at the back of an old star atlas, it lists every
 * constellation (each genre in your Notion database, plus "All
 * Constellations"), with how many books each one holds. Choosing one glides
 * the map to it; it then opens to list its stars, brightest first.
 *
 * At the top, a search box finds a book by its title or its author. It's a
 * "combobox": type, move through the suggestions with ↑ and ↓, and press
 * Enter to fly to that book.
 *
 * On wide screens the index is a panel on the right. On phones it's a sheet
 * that slides up when you tap "Index & search".
 */

import { useId, useMemo, useState, type CSSProperties } from "react";
import { plainText, type Catalogue, type Entry } from "./sky";
import styles from "./sky.module.css";

type Props = {
  catalogue: Catalogue;
  genre: string | null;
  onGenre: (key: string | null) => void;
  /** Fly to a book */
  onFind: (id: string) => void;
  /** Phones only: is the sheet showing? */
  isOpen: boolean;
  onClose: () => void;
};

export function AtlasIndex({ catalogue, genre, onGenre, onFind, isOpen, onClose }: Props) {
  const total = catalogue.entries.size;
  return (
    <aside id="atlas-index" className={styles.index} data-open={isOpen || undefined} data-chrome="wide:right" aria-label="Index of constellations">
      <div className={styles.indexHead}>
        <p className={styles.indexKicker}>Index of Constellations</p>
        <button type="button" className={styles.indexClose} onClick={onClose} aria-label="Close the index">
          ×
        </button>
      </div>

      <Search catalogue={catalogue} onFind={onFind} />

      <ul className={styles.indexList}>
        <li>
          <button type="button" className={styles.indexEntry} aria-pressed={genre === null} onClick={() => onGenre(null)}>
            <span className={styles.indexNumeral} aria-hidden="true">
              ✦
            </span>
            <span className={styles.indexName}>All Constellations</span>
            <span className={styles.indexCount}>{total}</span>
          </button>
        </li>
        {catalogue.constellations.map((info) => {
          const chosen = genre === info.key;
          const count = info.entries.length;
          return (
            <li key={info.key || "uncharted"} style={{ "--accent": info.accent } as CSSProperties}>
              <button type="button" className={styles.indexEntry} aria-pressed={chosen} onClick={() => onGenre(info.key)}>
                <span className={styles.indexNumeral}>{info.numeral}</span>
                <span className={styles.indexName}>
                  {info.genre}
                  <span className={styles.indexLatin}>{info.lore.latin}</span>
                </span>
                <span className={styles.indexCount}>
                  {count}
                  <span className={styles.srOnly}> {count === 1 ? "book" : "books"}</span>
                </span>
              </button>
              {chosen && (
                <div className={styles.indexDetail}>
                  <p className={styles.indexSummary}>
                    {count} {count === 1 ? "book" : "books"} in this constellation
                    {info.meanRating !== null && <> · mean ★ {info.meanRating.toFixed(1)}</>}
                  </p>
                  <ol className={styles.indexStars}>
                    {info.entries.map((entry) => (
                      <li key={entry.book.id}>
                        <button type="button" className={styles.indexStar} onClick={() => onFind(entry.book.id)}>
                          <span className={styles.indexStarLetter}>{entry.letter}</span>
                          <span className={styles.indexStarTitle}>{entry.book.title}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ChartKey />
    </aside>
  );
}

/* ---------- Search: find a book by title or author ---------- */

/** Up to 8 books whose title or author contains the words typed, best matches first. */
function findBooks(catalogue: Catalogue, query: string): Entry[] {
  const wanted = plainText(query);
  if (!wanted) return [];
  const scored: { entry: Entry; score: number }[] = [];
  for (const entry of catalogue.entries.values()) {
    const title = plainText(entry.book.title);
    const author = plainText(entry.book.author);
    let score = -1;
    if (title.startsWith(wanted)) score = 0;
    else if (title.includes(` ${wanted}`)) score = 1;
    else if (title.includes(wanted)) score = 2;
    else if (author.startsWith(wanted) || author.includes(` ${wanted}`)) score = 3;
    else if (author.includes(wanted)) score = 4;
    if (score >= 0) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.entry.book.title.localeCompare(b.entry.book.title))
    .slice(0, 8)
    .map((item) => item.entry);
}

function Search({ catalogue, onFind }: { catalogue: Catalogue; onFind: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = useMemo(() => findBooks(catalogue, query), [catalogue, query]);
  const showing = open && query.trim().length > 0;

  const choose = (entry: Entry | undefined) => {
    if (!entry) return;
    setOpen(false);
    setQuery(entry.book.title);
    onFind(entry.book.id);
  };

  return (
    <div className={styles.search}>
      <label className={styles.srOnly} htmlFor={`${listId}-input`}>
        Find a book by title or author
      </label>
      <svg viewBox="0 0 20 20" className={styles.searchIcon} aria-hidden="true">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <path d="M12.6 12.6 17 17" />
      </svg>
      <input
        id={`${listId}-input`}
        className={styles.searchInput}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        placeholder="Find a title or author"
        value={query}
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showing && results[active] ? `${listId}-${active}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(results.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter") {
            event.preventDefault();
            choose(results[active]);
          } else if (event.key === "Escape") {
            if (showing) setOpen(false);
            else setQuery("");
          }
        }}
      />
      {showing && (
        <ul id={listId} role="listbox" className={styles.results} aria-label="Matching books">
          {results.length === 0 && (
            <li className={styles.resultEmpty} role="option" aria-selected={false} aria-disabled="true">
              No star by that name — yet.
            </li>
          )}
          {results.map((entry, index) => {
            const info = catalogue.byKey.get(entry.key);
            return (
              <li
                key={entry.book.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className={styles.result}
                style={{ "--accent": info?.accent } as CSSProperties}
                // mousedown would take focus from the input (and close the list) before the click lands
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(entry)}
              >
                <span className={styles.resultLetter}>{entry.letter}</span>
                <span className={styles.resultText}>
                  <span className={styles.resultTitle}>{entry.book.title}</span>
                  <span className={styles.resultMeta}>
                    {entry.book.author || "Author unknown"} · {info?.genre}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- The key: what the drawing means ---------- */

export function ChartKey() {
  return (
    <details className={styles.key}>
      <summary className={styles.keySummary}>Key to the chart</summary>
      <dl className={styles.keyList}>
        <div className={styles.keyRow}>
          <dt className={styles.keySymbol}>
            <svg viewBox="0 0 40 12" aria-hidden="true" className={styles.keySvg}>
              <path d="M2 9 L20 3 L38 7" className={styles.keyLine} />
            </svg>
          </dt>
          <dd className={styles.keyText}>Gold lines join the books of one genre into a constellation</dd>
        </div>
        <div className={styles.keyRow}>
          <dt className={styles.keySymbol}>
            <svg viewBox="0 0 40 12" aria-hidden="true" className={styles.keySvg}>
              <path d="M2 10 Q20 -2 38 10" className={styles.keyAuthor} />
            </svg>
          </dt>
          <dd className={styles.keyText}>Dotted arcs join books by the same author</dd>
        </div>
        <div className={styles.keyRow}>
          <dt className={styles.keySymbol}>
            <span className={styles.keyGlow} aria-hidden="true" />
          </dt>
          <dd className={styles.keyText}>The brighter the glow, the higher the rating</dd>
        </div>
        <div className={styles.keyRow}>
          <dt className={styles.keySymbol}>
            <span className={styles.keyGreek} aria-hidden="true">
              α β γ
            </span>
          </dt>
          <dd className={styles.keyText}>Greek letters rank a constellation’s books: α is its brightest (highest rated)</dd>
        </div>
        <div className={styles.keyRow}>
          <dt className={styles.keySymbol}>
            <svg viewBox="0 0 40 12" aria-hidden="true" className={styles.keySvg}>
              <path d="M2 10 Q8 1 20 2 T38 9" className={styles.keyRegion} />
            </svg>
          </dt>
          <dd className={styles.keyText}>A dotted border marks each constellation’s region of the sky</dd>
        </div>
      </dl>
    </details>
  );
}
