# Repository Guidelines

## Project Structure & Module Organization

This is a 2D physics simulation built with [Matter.js](https://github.com/liabru/matter-js/). The application is split across a small set of plain (non-module) scripts under `src/`, loaded in order by `index.html`. All scripts share the global scope — there are no imports and no bundling.

| File          | Purpose                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| index.html    | Page layout, CSS styles, and the ordered `<script>` tags; no application logic       |
| src/state.js  | Global state and configuration (canvas/world refs, `MOTOR`, `input`)                |
| src/util.js   | Pure helpers: `screenToWorld`, `worldToScreen`, `bodyBounds`                         |
| src/car.js    | Car creation and the torque-based motor model                                        |
| src/world.js  | Walls, box spawn/remove, and the box counter                                         |
| src/render.js | Custom canvas renderer (grid, walls, boxes, car)                                     |
| src/input.js  | Mouse, keyboard, and wheel handlers; canvas setup and resize                         |
| src/main.js   | `init`, the main loop, and the `load` bootstrap                                      |
| AGENTS.md     | This contributor guide                                                               |

There are no external assets, build tools, or test directories. Matter.js loads from a CDN.

## Running Locally

Open `index.html` directly in a browser (double-click it from the repo root) — no server is needed. Matter.js loads from CDN and the plain `<script src>` tags work over `file://`.

You can also serve the folder (e.g. `npx serve`) or deploy it as-is to any static host such as Cloudflare Pages (framework preset: none, output directory: repo root).

## Building & Testing

There is no build step. To test changes:

1. Edit the relevant file under `src/`.
2. Refresh the browser tab (Ctrl+R) to see updates instantly.

For quick syntax checks, run each script through Node before opening a browser:

```
Get-ChildItem src\*.js | ForEach-Object { node --check $_.FullName }
```

or on Unix-like shells:

```
for f in src/*.js; do node --check "$f"; done
```

## Coding Style & Naming Conventions

The codebase is intentionally minimal. Follow these conventions when adding or modifying code:

- **Indentation:** 2 spaces (no tabs).
- **Variable declarations:** Use `var` for legacy Matter.js compatibility; `let` / `const` are fine elsewhere.
- **Naming:** camelCase for functions and variables. Short abbreviated names keep the scripts small (e.g., `wl` for wheel, `sz` for size).
- **Line length:** Aim for under 120 characters; split longer expressions with parentheses.
- **Semicolons:** Always use semicolons.
- **Comments:** Use Finnish-language comments where appropriate since the UI is in Finnish.

## File Updates

Edit the relevant script directly under `src/`; keep each file focused on its single responsibility. `index.html` should contain only markup, styles, and the ordered `<script>` tags — not application code.

When adding a new script, register it in `index.html` in the correct load order. Scripts execute in tag order, so shared state (`src/state.js`) must load before any script that reads it at load time.

## Commit & PR Guidelines

- **Commit messages:** Keep them short and in English (e.g., `fix: clamp boxes inside walls on resize`).
- **PR descriptions:** Include a brief summary and a screenshot or video if the change affects visuals.
- No special templates or issue links are required beyond being descriptive.

## Architecture Overview

The application follows a straightforward loop:

1. **Matter.js Engine** — Handles physics simulation (gravity, collisions, walls).
2. **Custom Canvas Renderer** — Draws everything to a `<canvas>` element each frame (grid, walls, boxes, car). Matter.js's built-in renderer is intentionally bypassed to avoid rendering conflicts with CSS transforms used for zoom.
3. **Input Layer** — Keyboard (Arrow keys for the car), mouse (click to spawn, drag to pan, Ctrl+scroll to zoom).
4. **Main Loop** — `requestAnimationFrame` drives physics updates, input handling, and canvas drawing in sync.

## Agent-Specific Instructions

When working on this repository:

- Application code lives in the `src/` scripts; keep `index.html` limited to markup, styles, and `<script>` tags, and keep each `src/` file focused on one concern.
- Scripts share the global scope and load in tag order — do not convert them to ES modules, since that would break opening `index.html` directly from `file://`.
- Avoid using Matter.js's built-in Render component — it conflicts with custom zoom/pan logic. Always use the custom canvas renderer instead.
- Be careful with `mouseConstraint.render.visible` — this property does not exist; set `constraint.render.visible` on the create options instead.
- The auto-painted car and its wheels are drawn in world coordinates each frame, not as Matter.js bodies.
