"use client";

/**
 * The form in the bookmarklet's window (save/page.tsx): which board, the
 * page's title and link (already filled in), and a note.
 *
 * The board you chose last time is remembered in this browser (localStorage),
 * so saving several pages to the same board is one click each. That's only a
 * convenience: if the browser won't store it, you just choose again.
 */

import { useActionState, useEffect, useRef } from "react";
import { saveLinkAction, type SaveLinkState } from "./actions";
import { boardHref } from "./lib/paths";
import { LIMITS } from "./lib/validate";
import styles from "./styles.module.css";

const LAST_BOARD_KEY = "inspiration-library:last-board";

type Props = {
  boards: { id: string; title: string }[];
  url: string;
  title: string;
};

export default function SaveForm({ boards, url, title }: Props) {
  const [state, formAction, pending] = useActionState<SaveLinkState, FormData>(saveLinkAction, { status: "idle" });
  const boardSelect = useRef<HTMLSelectElement>(null);

  // Pick the board you used last time, if it's still one of yours.
  useEffect(() => {
    try {
      const last = window.localStorage.getItem(LAST_BOARD_KEY);
      if (last && boardSelect.current && boards.some((board) => board.id === last)) boardSelect.current.value = last;
    } catch {
      // Storage blocked (private window, strict settings): start with the first board.
    }
  }, [boards]);

  // Saved: remember the board for next time.
  useEffect(() => {
    if (state.status !== "saved") return;
    try {
      window.localStorage.setItem(LAST_BOARD_KEY, state.boardId);
    } catch {
      // Not remembered; that's fine.
    }
  }, [state]);

  if (state.status === "saved") {
    const board = boards.find((b) => b.id === state.boardId);
    return (
      <div className={styles.saveDone} role="status">
        <p className={styles.formSaved}>Saved to “{board?.title ?? "your board"}”.</p>
        <div className={styles.actions}>
          {/* window.close() works here because the bookmarklet opened this window with a script. */}
          <button className={styles.button} type="button" onClick={() => window.close()} autoFocus>
            Close window
          </button>
          <a className={styles.buttonQuiet} href={boardHref(state.boardId)} target="_blank" rel="noopener">
            Open the board
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.label}>
        <span className={styles.labelText}>Board</span>
        <select ref={boardSelect} className={styles.input} name="boardId" required defaultValue={boards[0]?.id}>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.title}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>Title</span>
        <input className={styles.input} name="title" type="text" maxLength={LIMITS.itemTitle} defaultValue={title} />
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>Link</span>
        <input className={styles.input} name="linkUrl" type="text" inputMode="url" required maxLength={LIMITS.url} defaultValue={url} />
      </label>

      <label className={styles.label}>
        <span className={styles.labelText}>
          Note <span className={styles.optional}>(optional)</span>
        </span>
        <textarea className={styles.textarea} name="note" rows={2} maxLength={LIMITS.note} placeholder="Why did you save it?" />
      </label>

      {state.status === "error" && (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      )}

      <div className={styles.actions}>
        <button className={styles.button} type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button className={styles.buttonQuiet} type="button" onClick={() => window.close()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
