# Physics simulation

A 2D physics sandbox built with [Matter.js](https://github.com/liabru/matter-js/). Spawn and destroy boxes, drive a two-wheel car, and pan/zoom around the world. Markup and styles live in **index.html**; the JavaScript is split into plain scripts under **src/**.

## Features

- **Box sandbox** — click to spawn random rectangles and polygons with varied sizes, colors, and physics properties; Shift+click to remove one.
- **Drivable car** — a red chassis with two wheeled axles driven by a torque-based motor model (acceleration scales down as you approach top speed, air drag on the wheels).
- **Infinite camera** — drag to pan, Ctrl+scroll to zoom (0.1x–5x).
- **Custom canvas renderer** — bypasses Matter.js's built-in renderer to keep zoom/pan transforms clean.

## Running

No build step, no server, no dependencies to install. Matter.js loads from a CDN.

Open `index.html` directly in a browser — just double-click it from your file explorer.

## Controls

| Input            | Action                          |
| ---------------- | ------------------------------- |
| Left click       | Spawn a box at the cursor       |
| Shift + click    | Remove a box under the cursor   |
| Drag             | Pan the camera                  |
| Ctrl + scroll    | Zoom in / out around the cursor |
| Cmd + scroll     | Zoom in / out around the cursor (macOS) |
| ArrowUp          | Car accelerate                  |
| ArrowDown        | Car reverse                     |

## Development

To test changes, edit the relevant file under `src/` (or `index.html` for markup/styles) and refresh the browser tab (Ctrl+R). The scripts load in order via plain `<script>` tags, so no server is required.

Optional quick syntax check via Node before opening a browser (run from the repo root):

```
Get-ChildItem src\*.js | ForEach-Object { node --check $_.FullName }
```

## Project structure

| File / folder | Purpose                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| index.html    | Page layout, CSS styles, and the ordered `<script>` tags                |
| src/state.js  | Global state and config (canvas/world refs, `MOTOR`, `input`)           |
| src/util.js   | Pure helpers (`screenToWorld`, `worldToScreen`, `bodyBounds`)           |
| src/car.js    | Car creation and the torque-based motor model                           |
| src/world.js  | Walls, box spawn/remove, and the box counter                            |
| src/render.js | Custom canvas renderer (grid, walls, boxes, car)                        |
| src/input.js  | Mouse, keyboard, and wheel handlers; canvas setup and resize            |
| src/main.js   | `init`, the main loop, and the `load` bootstrap                         |
| AGENTS.md     | Contributor / AI-agent guidelines for working on this repo              |

## Architecture

The app runs a simple `requestAnimationFrame` loop that each frame:

1. **Updates the car motor** — applies wheel torque and air drag.
2. **Steps the engine** — `Engine.update` advances gravity, collisions, and constraints.
3. **Renders** — the custom canvas renderer draws the grid, boxes, and car in world coordinates, transformed by the current pan/zoom.

See [AGENTS.md](AGENTS.md) for coding conventions and contributor notes.
