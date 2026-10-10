/**
 * A responsive grid of project cards: three columns on desktop, two on
 * tablets, one on phones. Give it any list of projects and it lays them out.
 */

import type { CSSProperties } from "react";
import type { Project } from "../../data/projects";
import ProjectCard from "./ProjectCard";
import s from "./ProjectGrid.module.css";

type Props = {
  projects: Project[];
  /**
   * Changing this value replays the cards' gentle fade-in. ProjectGallery
   * passes the selected filter, so the cards re-appear when the filter changes.
   */
  animationKey?: string;
};

export default function ProjectGrid({ projects, animationKey = "" }: Props) {
  if (projects.length === 0) {
    return <p className={s.empty}>Nothing here yet. The cats are still working on it.</p>;
  }

  return (
    <ul className={s.grid}>
      {projects.map((project, i) => (
        // --i is the card's position, used to stagger the fade-in a little
        <li key={`${animationKey}-${project.id}`} className={s.item} style={{ "--i": i } as CSSProperties}>
          <ProjectCard project={project} />
        </li>
      ))}
    </ul>
  );
}
