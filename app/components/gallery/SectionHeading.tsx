/**
 * The heading used at the top of each homepage section: a small label with
 * a sparkle, a big serif title, and (optionally) a short note beside it.
 */

import type { ReactNode } from "react";
import { Sparkle } from "../celestial/Celestial";
import s from "./SectionHeading.module.css";

type Props = {
  /** Used to connect the heading to its <section> (aria-labelledby) */
  id: string;
  /** The small label above the title */
  eyebrow: string;
  title: string;
  /** A sentence shown next to the title on wide screens, below it on narrow ones */
  note?: ReactNode;
};

export default function SectionHeading({ id, eyebrow, title, note }: Props) {
  return (
    <div className={s.heading}>
      <div>
        <p className={s.eyebrow}>
          <Sparkle className={s.eyebrowStar} />
          {eyebrow}
        </p>
        <h2 id={id} className={s.title}>
          {title}
        </h2>
      </div>
      {note && <p className={s.note}>{note}</p>}
    </div>
  );
}
