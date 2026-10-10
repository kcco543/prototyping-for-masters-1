"use client";

/**
 * The row of category filter buttons ("All", "Tarot & Divination"…).
 *
 * This component doesn't decide anything itself: it is told which filter is
 * selected (`value`) and reports clicks through `onChange`. ProjectGallery
 * owns that state and passes the matching projects to the grid.
 *
 * Accessibility: each button is a toggle (aria-pressed), so a screen reader
 * says which filter is on, and all of them can be reached with Tab.
 */

import s from "./CategoryFilter.module.css";

export type FilterOption = {
  id: string;
  label: string;
  /** How many projects this filter shows */
  count: number;
};

type Props = {
  options: FilterOption[];
  /** The id of the selected option */
  value: string;
  onChange: (id: string) => void;
};

export default function CategoryFilter({ options, value, onChange }: Props) {
  return (
    <div className={s.filters} role="group" aria-label="Filter prototypes by category">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            className={`${s.chip} ${selected ? s.selected : ""}`}
            aria-pressed={selected}
            // read out as "Cat Games & Play, 5 prototypes" instead of "Cat Games & Play 5"
            aria-label={`${option.label}, ${option.count} ${option.count === 1 ? "prototype" : "prototypes"}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
            <span className={s.count}>{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}
