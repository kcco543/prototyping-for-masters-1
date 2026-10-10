"use client";

/**
 * The "All Prototypes" browser: the category filters plus the grid of cards.
 *
 * This is the one piece that remembers something (which filter is selected),
 * so it is a Client Component ("use client" at the top). It:
 * 1. builds the filter buttons from the categories and counts the projects in each,
 * 2. remembers the selected filter with useState,
 * 3. hands the matching projects to ProjectGrid.
 */

import { useState } from "react";
import { categories, type Project } from "../../data/projects";
import CategoryFilter, { type FilterOption } from "./CategoryFilter";
import ProjectGrid from "./ProjectGrid";
import s from "./ProjectGallery.module.css";

const ALL = "all";

export default function ProjectGallery({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState(ALL);

  // "All" first, then one button per category (see app/data/projects.ts)
  const options: FilterOption[] = [
    { id: ALL, label: "All", count: projects.length },
    ...categories.map((category) => ({
      id: category.id,
      label: category.label,
      count: projects.filter((project) => project.category === category.id).length,
    })),
  ];

  const visible = selected === ALL ? projects : projects.filter((project) => project.category === selected);

  return (
    <div>
      <div className={s.toolbar}>
        <CategoryFilter options={options} value={selected} onChange={setSelected} />
        {/* role="status" makes screen readers announce the new count after a filter change */}
        <p className={s.count} role="status">
          Showing {visible.length} of {projects.length}
        </p>
      </div>

      <ProjectGrid projects={visible} animationKey={selected} />
    </div>
  );
}
