# Agent Guidelines

These instructions apply to every AI coding agent working in this repository.

## Project context

This repository is a central prototyping workspace for students taking the
"Prototyping for Masters" workshop. Students have a wide range of technical
experience, from first-time command-line users to experienced front-end
developers. Most students are product or UX designers.

When working with students:

- Assume varying levels of technical expertise.
- Use clear, plain language and provide step-by-step instructions when useful.
- Make documentation beginner-friendly.
- Write descriptive, educational code comments when comments add value.
- Explain the cause of an issue and why a proposed solution works.

## Repository structure

- Application code lives in `app/`.
- Prototypes live in `app/prototypes/`.
- Each prototype has its own folder and should be treated as an independent
  project unless explicitly documented otherwise.
- A prototype may use its own dependencies and technical approach as needed.
- Each prototype should include a `README.md` with setup and usage instructions.
- Do not modify `app/prototypes/_template/` when creating a prototype; copy it.

## Creating a prototype

When asked to create or make a prototype:

1. If the prototype's purpose or name cannot be determined from the request,
   ask for the missing information before creating it.
2. Copy `app/prototypes/_template/` into a new, clearly named folder under
   `app/prototypes/`.
3. Build the prototype by updating its `page.tsx`, `styles.module.css`, and any
   other prototype-local files.
4. Install only the dependencies the prototype needs.
5. Add the prototype to the `prototypes` array on the homepage.
6. Verify that the homepage and the prototype route both build and work.

## CSS

### Global styles

- Do not change `app/styles/globals.css` unless the request requires a global
  style change.
- Keep prototype-specific CSS in that prototype's folder.
- Use `:root` only in `app/styles/globals.css`.
- Do not reuse another prototype's CSS unless explicitly requested.

### CSS Modules

- Do not use bare HTML element selectors such as `div`, `pre`, or `code` in a
  CSS Module.
- Start selectors with a local class name.
- Give styled elements purpose-specific class names, such as `.preBlock`
  instead of styling `pre` directly.
- Every nested selector must include at least one local class name. For example,
  `.bookInfo h2` is valid because it is scoped by `.bookInfo`.
- Prefer adding a class to the target element over relying on nested selectors.

## Debugging

When asked to diagnose or fix a problem:

1. Inspect the relevant code and available diagnostics first.
2. Establish the expected behavior, actual behavior, complete error message,
   affected file and line when available, and relevant recent changes.
3. Ask a focused question only when required information cannot be discovered
   from the repository or existing context.
4. Explain the root cause in language appropriate to the student's experience.
5. Propose a specific fix, implement it when requested, and explain why it
   works.
6. Run an appropriate verification, such as a focused test, type check, build,
   or route check.
7. If the first fix does not work, use the new evidence to investigate an
   alternative instead of repeating the same approach.

Break unfamiliar concepts into small steps and use examples when they make the
solution easier to understand.
