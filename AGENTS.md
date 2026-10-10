# Repository Guidelines

## Project Structure & Module Organization

This is a single-file physics simulation built with [Matter.js](https://github.com/liabru/matter-js/). The entire application lives in one file.

| File            | Purpose                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| index.html      | All source code — HTML layout, CSS styles, and JavaScript (physics engine, rendering, input) |
| writer.js       | Helper script used to write/update index.html during development                              |
| AGENTS.md       | This contributor guide                                                                        |

There are no external assets, build tools, or test directories. The project runs directly in a browser — no server required.

## Running Locally

Open the file directly in a web browser:

`
file:///E:/dev/physics/index.html
`

or double-click index.html from your file explorer. No installation or local server is needed; Matter.js loads from CDN.

## Building & Testing

There is no build step. To test changes:

1. Edit **index.html** in any text editor.
2. Refresh the browser tab (Ctrl+R) to see updates instantly.

For quick syntax checks, run the script through Node first — it will flag JS errors before you open a browser:

`
node -e "require('fs').readFileSync('E:/dev/physics/index.html','utf8'); console.log('OK')"
`

## Coding Style & Naming Conventions

The codebase is intentionally minimal and self-contained. Follow these conventions when adding or modifying code:

- **Indentation:** 2 spaces (no tabs).
- **Variable declarations:** Use ar for legacy Matter.js compatibility; let / const are fine elsewhere.
- **Naming:** camelCase for functions and variables. Short abbreviated names are used to keep the single-file size small (e.g., mCon for mouseConstraint, sz for size).
- **Line length:** Aim for under 120 characters; split longer expressions with parentheses.
- **Semicolons:** Always use semicolons — required for the string-concatenation writer script approach.
- **Comments:** Use Finnish-language comments where appropriate since the UI is in Finnish.

## File Updates

When updating index.html, prefer appending to a buffer via **writer.js** or similar Node script rather than inline shell strings. This avoids PowerShell escaping problems:

`
# In writer.js, build HTML line by line, then:
fs.writeFileSync('E:/dev/physics/index.html', html, 'utf-8');
`

## Commit & PR Guidelines

- **Commit messages:** Keep them short and in English (e.g., ix: clamp boxes inside walls on resize).
- **PR descriptions:** Include a brief summary and a screenshot or video if the change affects visuals.
- No special templates or issue links are required beyond being descriptive.

## Architecture Overview

The application follows a straightforward loop:

1. **Matter.js Engine** — Handles physics simulation (gravity, collisions, walls).
2. **Custom Canvas Renderer** — Draws everything to a <canvas> element each frame (grid, walls, boxes, car). Matter.js's built-in renderer is intentionally bypassed to avoid rendering conflicts with CSS transforms used for zoom.
3. **Input Layer** — Keyboard (Arrow keys for the car), mouse/touch (click and drag to spawn boxes), and Ctrl+scroll for zoom.
4. **Main Loop** — equestAnimationFrame drives physics updates, input handling, and canvas drawing in sync.

## Agent-Specific Instructions

When working on this repository:

- Make changes to **index.html only**; do not split code into separate JS/CSS files unless explicitly requested.
- Avoid using Matter.js's built-in Render component — it conflicts with custom zoom/pan logic. Always use the custom canvas renderer instead.
- Be careful with mouseConstraint.render.visible — this property does not exist; set constraint.render.visible on the create options instead.
- The auto-painted car and its wheels are drawn in world coordinates each frame, not as Matter.js bodies.

