/**
 * One prototype, shown as a card: a preview picture, its category, title,
 * one-sentence description, technology tags and a link.
 *
 * How the "whole card is clickable" part works:
 * - The only real link is the title. That keeps things tidy for keyboard and
 *   screen-reader users: one Tab stop per card, announced by its title.
 * - In the CSS, the link has an invisible ::after layer stretched over the
 *   entire card, so a click anywhere on the card lands on the link.
 *
 * A project whose status is not "live" is drawn without any link at all, so
 * an unfinished prototype can be shown without sending anyone to a missing page.
 */

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getCategory, getNumeral, isLive, type Project } from "../../data/projects";
import { Sparkle } from "../celestial/Celestial";
import s from "./ProjectCard.module.css";

type Props = {
  project: Project;
  /** "large" is the bigger version used in Featured Projects */
  size?: "regular" | "large";
};

export default function ProjectCard({ project, size = "regular" }: Props) {
  const category = getCategory(project.category);
  const live = isLive(project);
  const large = size === "large";

  return (
    <article
      className={`${s.card} ${large ? s.large : ""} ${live ? s.live : s.unavailable}`}
      style={{ "--accent": category.accent } as CSSProperties}
    >
      <div className={s.thumb}>
        {project.thumbnail ? (
          <Image
            className={s.thumbImage}
            src={project.thumbnail}
            // The picture is decoration: the title next to it already says what this is
            alt=""
            fill
            // Tells the browser how wide the picture is shown, so it can pick a sensible file size
            sizes={large ? "(min-width: 760px) 560px, 100vw" : "(min-width: 1000px) 370px, (min-width: 640px) 50vw, 100vw"}
          />
        ) : (
          // No picture yet: a quiet placeholder in the category's colour
          <span className={s.thumbPlaceholder} aria-hidden="true">
            <Sparkle />
          </span>
        )}
        {!live && <span className={s.badge}>In the works</span>}
      </div>

      <div className={s.body}>
        <p className={s.meta}>
          <span className={s.category}>
            <Sparkle className={s.categoryStar} />
            {category.label}
          </span>
          {/* A Roman numeral, like the number on a tarot card (decoration only) */}
          <span className={s.numeral} aria-hidden="true">
            {getNumeral(project)}
          </span>
        </p>

        <h3 className={s.title}>
          {live ? (
            <Link href={project.href} className={s.link}>
              {project.title}
            </Link>
          ) : (
            project.title
          )}
        </h3>

        <p className={s.description}>{project.description}</p>

        {project.tags.length > 0 && (
          <ul className={s.tags} aria-label="Made with">
            {project.tags.map((tag) => (
              <li key={tag} className={s.tag}>
                {tag}
              </li>
            ))}
          </ul>
        )}

        {live ? (
          // Looks like a link, but the real link is the title above (which
          // covers the whole card), so this is hidden from screen readers.
          <p className={s.open} aria-hidden="true">
            Open prototype
            <span className={s.arrow}>→</span>
          </p>
        ) : (
          <p className={s.soon}>Coming soon. Not playable yet.</p>
        )}
      </div>
    </article>
  );
}
