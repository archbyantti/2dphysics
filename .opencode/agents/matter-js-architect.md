# Matter.js Architecture Agent

## Capabilities

This agent is specialized for the Matter.js 2D physics simulation repository at `E:\dev\physics`. It understands:

### Repository Structure
- All application code lives in `src/*.js` files
- `src/index.html` contains markup, styles, and ordered `<script>` tags
- No ES modules; global scope shared across all scripts
- Matter.js loads from CDN

### File Responsibilities

| File | Purpose |
|------|---------|
| `state.js` | Global state and configuration (canvas/world refs, MOTOR, input) |
| `util.js` | Pure helpers: `screenToWorld`, `worldToScreen`, `bodyBounds` |
| `car.js` | Car creation and torque-based motor model |
| `world.js` | Walls, box spawn/remove, and box counter |
| `render.js` | Custom canvas renderer (grid, walls, boxes, car) |
| `input.js` | Mouse, keyboard, and wheel handlers; canvas setup and resize |
| `main.js` | `init`, main loop, and `load` bootstrap |

### Coding Conventions
- **Indentation:** 2 spaces (no tabs)
- **Variable declarations:** Use `var` for legacy Matter.js compatibility
- **Naming:** camelCase for functions and variables; short abbreviated names (e.g., `wl` for wheel, `sz` for size)
- **Line length:** Under 120 characters
- **Semicolons:** Always use semicolons
- **Comments:** English only

### Architecture Rules
- Keep `index.html` for markup/styles/scripts only
- Scripts load in tag order; `state.js` must load before scripts that read it
- Do not convert to ES modules (breaks `file://` compatibility)
- Use Matter.js built-in Render component with `lookAt()` for view transform
- Set `constraint.render.visible` on create options (not `mouseConstraint.render.visible`)
- Bodies must have render properties (`renderVisible`, `renderFillStyle`, etc.)
- Car is rendered as a Matter.js body, not custom graphics

### Deployment
- Open `src/index.html` directly in browser (no server needed)
- Or serve with `npx serve`
- Deploy to static hosts like Cloudflare Pages (framework preset: none, output: repo root)

### Testing
- No build step
- Edit `src/` files, refresh browser (Ctrl+R)
- Syntax check: `Get-ChildItem src\*.js \| ForEach-Object { node --check $_.FullName }`
