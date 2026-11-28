# Repository Guidelines

## Project Structure & Module Organization

This is a 2D physics simulation built with [Matter.js](https://github.com/liabru/matter-js/). The application is split across a small set of plain (non-module) scripts under `src/`, loaded in order by `src/index.html`. All scripts share the global scope — there are no imports and no bundling.

| File                     | Purpose                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| src/index.html           | Page layout, CSS styles, and the ordered `<script>` tags; no application logic   |
| src/state.js             | Global state and config (world refs, `CAT` bits, `SIM_SPEED`, `MOTOR`)         |
| src/util.js              | Pure helpers: `screenToWorld`, `worldToScreen`                                   |
| src/sound.js             | Web Audio engine sound and collision sounds (`setUpCollisionSound`)              |
| src/car.js               | Car creation (chassis, wheels, axle constraints) and the torque-based motor     |
| src/world.js             | Walls (rebuilt on resize), box spawn/remove, and the box counter                 |
| src/render.js            | Custom canvas renderer; bodies are drawn from their real vertices                |
| src/input.js             | Mouse, keyboard, and wheel handlers; canvas setup, resize, camera follow         |
| src/main.js              | `init`, the fixed-timestep main loop, and the `load` bootstrap                   |
| test/test-simulation.js  | Playwright smoke test; exits non-zero if any check fails                         |
| package.json             | Dev dependency (`@playwright/test`) and the `check` / `test` scripts             |
| AGENTS.md                | This contributor guide                                                           |

There are no external assets and no build tools. Matter.js loads from a CDN; the app itself has no npm
dependencies. `package.json` exists only for the test tooling.

## Running Locally

Open `src/index.html` directly in a browser (double-click it) — no server is needed. Matter.js loads from CDN and
the plain `<script src>` tags work over `file://`.

You can also serve the `src/` folder (e.g. `npx serve src`) or deploy it as-is to any static host such as
Cloudflare Pages (framework preset: none, output directory: `src`).

## Building & Testing

There is no build step. To test changes:

1. Edit the relevant file under `src/`.
2. Refresh the browser tab (Ctrl+R) to see updates instantly.

For a quick syntax check of every script, run `npm run check` (it runs `node --check` on each `src/*.js`).

## Simulation Testing

Before committing, open `src/index.html` in a browser, check the developer tools Console (F12) for errors, and
verify the visual output and interactions.

## Automated Testing with Playwright

`test/test-simulation.js` opens `src/index.html` (path resolved relative to the script) and checks: box spawning
and the counter, collision sounds firing, Shift+click removal, driving with the up arrow, the C-key status text,
walls following a viewport resize, and no console errors. It saves `test/screenshots/simulation-test.png` and
exits with code 1 if any check fails. Add a check here when you add a feature.

```
npm install
npx playwright install chromium
npm test
```

The test needs network access, because Matter.js loads from the CDN.

## Coding Style & Naming Conventions

The codebase is intentionally minimal. Follow these conventions when adding or modifying code:

- **Indentation:** 2 spaces (no tabs).
- **Variable declarations:** Use `var` for legacy Matter.js compatibility; `let` / `const` are fine elsewhere.
- **Naming:** camelCase for functions and variables. Short abbreviated names keep the scripts small (e.g., `wl` for wheel, `sz` for size).
- **Line length:** Aim for under 120 characters; split longer expressions with parentheses.
- **Semicolons:** Always use semicolons.
- **Comments:** All code and comments must be in English, even when instructed in Finnish.

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
4. **Main Loop** — `requestAnimationFrame` drives the frame. Each frame advances physics (and the car motor) by
   the real elapsed time × `SIM_SPEED`, split into equal substeps of at most `MAX_STEP_MS`, so motion is smooth and
   equally fast on any refresh rate. Code that runs per substep must scale per-step effects by the step length
   (see `updateCarMotor`) and read velocities with `Body.getVelocity` / `getAngularVelocity`. Sound, camera, and
   drawing update once per frame.

## Agent-Specific Instructions

When working on this repository:

- Application code lives in the `src/` scripts; keep `index.html` limited to markup, styles, and `<script>` tags, and keep each `src/` file focused on one concern.
- Scripts share the global scope and load in tag order — do not convert them to ES modules, since that would break opening `src/index.html` directly from `file://`.
- Avoid using Matter.js's built-in Render component — it conflicts with custom zoom/pan logic. Always use the custom canvas renderer instead.
- Be careful with `mouseConstraint.render.visible` — this property does not exist; set `constraint.render.visible` on the create options instead.
- The car is real Matter.js bodies (a chassis and two wheels joined by axle constraints), but it is drawn by the
  custom renderer in `src/render.js`, like everything else.
