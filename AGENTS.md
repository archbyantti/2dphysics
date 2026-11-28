# Repository Guidelines

## Project Structure & Module Organization

This is a 2D physics simulation built with [Matter.js](https://github.com/liabru/matter-js/). The application is split across a small set of plain (non-module) scripts under `src/`, loaded in order by `src/index.html`. All scripts share the global scope — there are no imports and no bundling.

| File                     | Purpose                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| src/index.html           | Page layout, CSS styles, and the ordered `<script>` tags; no application logic   |
| src/state.js             | Global state and config (`CAT`, `PX_PER_M`, `START_X`, `SIM_SPEED`, `MOTOR` gears) |
| src/util.js              | Helpers: `screenToWorld`, `worldToScreen`, `impactSpeed`, `pairHas`              |
| src/sound.js             | Procedural Web Audio: engine voice driven by `car.engine`, box knock, landing thump |
| src/car.js               | Car creation, engine + automatic 4+R gearbox (`car.engine`), and `resetCar` (R) |
| src/terrain.js           | Endless ground: hills and jumps (every 100 m) grow with distance; `jumpSpec`, streaming |
| src/world.js             | Start wall, box spawn/remove, lost-box cleanup, box counter, distance/gear HUD   |
| src/particles.js         | Particle pool (`spawnParticle`, update, draw by layer); decoration, not physics |
| src/effects.js           | Emitters: exhaust smoke, tyre dust/mud, impact dust; tuning in `FX`             |
| src/render.js            | PixiJS (WebGL) renderer: mirrors bodies, particles and the car as Pixi objects   |
| src/input.js             | Mouse, keyboard, and wheel handlers; resize; smooth look-ahead camera follow    |
| src/main.js              | `init`, the substepped main loop, and the `load` bootstrap                       |
| test/test-simulation.js  | Playwright smoke test; exits non-zero if any check fails                         |
| package.json             | Dev dependency (`@playwright/test`) and the `check` / `test` scripts             |
| AGENTS.md                | This contributor guide                                                           |

There are no external assets and no build tools. Matter.js and PixiJS load from a CDN; the app itself has no npm
dependencies. `package.json` exists only for the test tooling.

## Running Locally

Open `src/index.html` directly in a browser (double-click it) — no server is needed. Matter.js and PixiJS load from CDN and
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

`test/test-simulation.js` opens `src/index.html` (path resolved relative to the script) and checks: the car
resting on the terrain, box spawning and the counter, box knocks, the cabin roof, engine revs, upshifts and the
gear HUD, Shift+click removal,
effects while driving, the distance HUD, braking into reverse, the C-key status text, terrain streaming 600 m out, silence while
rolling, a thump when the car is dropped, a jump ramp launching the car (and the landing thump), the R reset, the
renderer following a viewport resize, and no console errors. It saves `test/screenshots/simulation-test.png` and
exits with code 1 if any check fails. Add a check here when you add a feature.

```
npm install
npx playwright install chromium
npm test
```

The test needs network access, because Matter.js and PixiJS load from the CDN.

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

1. **Matter.js Engine** — Handles physics (gravity, collisions). The world is open to the right: the ground is
   endless rolling terrain (`src/terrain.js`) built from static convex quads, created in chunks ahead of the car
   and removed behind it; only a tall start wall closes the left side. World units are pixels, `PX_PER_M` = 60.
   Use `groundHeightAt(x)` for the surface anywhere and `terrainBodiesNear(x)` for contact queries, never all
   terrain bodies. Boxes whose ground was unloaded fall and are removed. Difficulty grows with distance: hills
   scale up to `TERRAIN.hillsMaxScale`, and each jump (`jumpSpec(m)`, deterministic per jump number) is bigger and
   one of four kinds: kicker, tabletop, ramp, or landing (drop onto a downhill). Tall jumps that a slow car might
   only roll off must not end in a full-height cliff (tabletops get a downhill for that reason). About half of
   the jumps from the third on start with a drop-in: a steep downhill that leaves the ground permanently lower
   (`dropOffset`), so the car gains real speed. Its top must curve over at least as gently as a car's flight
   (`TERRAIN.dropCrestR`) or the car takes off and loses the speed on landing. The hills are graded flat under
   each jump zone, so ramps and drop-ins keep their designed shape.
2. **PixiJS Renderer** (`src/render.js`, PixiJS 8 via WebGL) — Each body gets a Pixi display object whose shape
   is built once in body-local coordinates; per frame only position and rotation are copied from Matter.js. The
   world lives in one container whose position/scale are the pan offset and zoom. Pixi's own ticker is off: the main
   loop calls `draw()`, which ends with `app.render()`. Layer order: sky (stars, two far hill layers), far palms, near hills, near palms (all screen space with
   parallax; palm sprites are pooled), terrain chunks
   with distance markers, walls, boxes,
   `back` particles (smoke), car, `front` particles (dust, mud). Particles are updated once per frame with the
   frame's simulation time (`updateEffects`) and never interact with the physics. Matter.js's built-in renderer is not used.
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
- Avoid using Matter.js's built-in Render component — it conflicts with custom zoom/pan logic. Always draw through `src/render.js` (PixiJS) instead.
- Be careful with `mouseConstraint.render.visible` — this property does not exist; set `constraint.render.visible` on the create options instead.
- The car's engine is simulated in `updateCarMotor` (rpm from wheel speed and gear, torque curve, automatic
  shifting); `car.engine` is the single source of truth that the sound and the HUD read. Tune driving in
  `MOTOR` (gear `top` speeds and `torque`), not in the sound code. The car uses a low `frictionAir`
  (`MOTOR.bodyAirFriction`); Matter.js's default would cap its speed.
- Suspension (`SUSPENSION` in `src/state.js`) is invisible: each wheel hangs on a rigid trailing arm plus a
  spring constraint, and most of the mass is in the body. Shock absorbers are applied by hand in `updateDampers`
  (once per substep, before `Engine.update`); Matter.js constraint damping barely damps body pitch. Motor and brake changes to wheel spin are
  multiplied by `car.torqueGain` (reference inertia / wheel inertia), so changing wheel mass keeps the drive force.
- Braking is friction (`MOTOR.brakeDecel`): it removes wheel spin at a steady rate, and a wheel that has stopped
  is held by giving it infinite inertia (`lockWheel`), released again when the brake lets go. A proportional
  brake (spin x factor) never holds the car on a slope.
- Impact sounds and impact dust must use `impactSpeed(pair)` (speed along the contact normal), not total relative
  speed: the ground is many small bodies, so a rolling wheel starts a new collision at every seam.
- The car is real Matter.js bodies (a chassis and two wheels joined by axle constraints), but it is drawn by the
  custom renderer in `src/render.js`, like everything else.
