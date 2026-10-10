# Fysiikkasimulaatio

A single-file 2D physics sandbox built with [Matter.js](https://github.com/liabru/matter-js/). Spawn and destroy boxes, drive a two-wheel car, and pan/zoom around the world. Everything — HTML, CSS, and JavaScript — lives in **index.html**.

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
| ArrowUp          | Car accelerate                  |
| ArrowDown        | Car reverse                     |

## Development

To test changes, edit `index.html` and refresh the browser tab (Ctrl+R).

Optional quick syntax check via Node before opening a browser (run from the repo root):

```
node -e "const fs=require('fs'); fs.readFileSync('index.html','utf8'); console.log('OK')"
```

## Project structure

| File      | Purpose                                                                 |
| --------- | ----------------------------------------------------------------------- |
| index.html | All source code — layout, styles, physics engine, renderer, and input  |
| AGENTS.md | Contributor / AI-agent guidelines for working on this repo             |

## Architecture

The app runs a simple `requestAnimationFrame` loop that each frame:

1. **Updates the car motor** — applies wheel torque and air drag.
2. **Steps the engine** — `Engine.update` advances gravity, collisions, and constraints.
3. **Renders** — the custom canvas renderer draws the grid, boxes, and car in world coordinates, transformed by the current pan/zoom.

See [AGENTS.md](AGENTS.md) for coding conventions and contributor notes.
