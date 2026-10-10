/**
 * The "Featured Projects" section: up to two highlighted prototypes, shown
 * with large previews.
 *
 * To feature a prototype, set `featured: true` on it in app/data/projects.ts.
 * Only "live" prototypes are shown, and only the first two that are marked.
 * If nothing is featured, the whole section quietly disappears.
 */

import { isLive, type Project } from "../../data/projects";
import ProjectCard from "./ProjectCard";
import SectionHeading from "./SectionHeading";
import s from "./FeaturedProjects.module.css";

type Props = {
  projects: Project[];
  /** How many featured projects to show at most */
  max?: number;
};

export default function FeaturedProjects({ projects, max = 2 }: Props) {
  const featured = projects.filter((project) => project.featured && isLive(project)).slice(0, max);
  if (featured.length === 0) return null;

  return (
    <section className={s.section} aria-labelledby="featured-title">
      <SectionHeading
        id="featured-title"
        eyebrow="Start here"
        title="Featured Projects"
        note="A good place to begin: pull a card and see what happens."
      />
      <div className={s.grid}>
        {featured.map((project) => (
          <ProjectCard key={project.id} project={project} size="large" />
        ))}
      </div>
    </section>
  );
}
