// PixiJS (WebGL) renderer. Every Matter.js body is mirrored by a Pixi display object whose shape
// is built once in body-local coordinates; each frame only positions and rotations are updated.
// The whole world sits in one container, so pan and zoom are just that container's transform.

var app = null;   // PIXI.Application
var scene = {};   // Layers and display objects, filled by initRenderer

// '#rrggbb' -> 0xrrggbb
function hexColor(hex) {
  return parseInt(hex.slice(1), 16);
}

// Vertices of `verts` in the local frame of `body` (undo its position and rotation)
function toLocal(body, verts) {
  var c = Math.cos(-body.angle), s = Math.sin(-body.angle);
  return verts.map(function (v) {
    var dx = v.x - body.position.x, dy = v.y - body.position.y;
    return { x: dx * c - dy * s, y: dx * s + dy * c };
  });
}

// Texture from a small canvas painted by `paint(ctx2d, w, h)`
function canvasTexture(w, h, paint) {
  var c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d'), w, h);
  return PIXI.Texture.from(c);
}

// Create the Pixi app on the page canvas and build the static parts of the scene
async function initRenderer() {
  app = new PIXI.Application();
  await app.init({
    canvas: canvas,
    width: W,
    height: H,
    background: '#1a1a2e',
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    autoStart: false   // The main loop renders each frame itself
  });

  // White soft dot (tinted per particle) and a vertical glass gradient for the windows
  scene.softTex = canvasTexture(64, 64, function (g) {
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  scene.glassTex = canvasTexture(4, 64, function (g, w, h) {
    var grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#cdeef8');
    grad.addColorStop(1, '#6fa9c0');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });

  scene.sky = new PIXI.Graphics();       // Screen-space stars and the two far hill layers
  scene.palmsFar = new PIXI.Container();  // Palm silhouettes standing on the second hill layer
  scene.hillsNear = new PIXI.Graphics();  // Nearest hill layer
  scene.palmsNear = new PIXI.Container(); // Bigger palms standing on it
  scene.palmTex = [0, 1, 2].map(makePalmTexture);
  scene.palmPool = { far: [], near: [] };
  scene.world = new PIXI.Container();
  scene.terrain = new PIXI.Container();
  scene.ramps = new PIXI.Container();   // Above all ground chunks, since a ramp can cross a chunk border
  scene.walls = new PIXI.Graphics();
  scene.boxes = new PIXI.Container();
  scene.back = new PIXI.Container();    // Particles behind the car (smoke)
  scene.carLayer = new PIXI.Container();
  scene.water = new PIXI.Container();   // Ponds, over the car so that what is in them looks submerged
  scene.front = new PIXI.Container();   // Particles in front of the car (dust, mud)
  scene.world.addChild(scene.terrain, scene.ramps, scene.walls, scene.boxes, scene.back, scene.carLayer,
    scene.water, scene.front);
  app.stage.addChild(scene.sky, scene.palmsFar, scene.hillsNear, scene.palmsNear, scene.world);

  // Fixed star field (fractions of the screen), drawn with a slight parallax
  scene.stars = [];
  var seed = 7;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (var i = 0; i < 90; i++) scene.stars.push({ x: rnd(), y: rnd() * 0.6, r: 0.6 + rnd() * 1.2, a: 0.2 + rnd() * 0.5 });
  scene.chunkGfx = new Map();  // Terrain chunk -> { ground, ramps, water } containers
  scene.ponds = [];            // { pond, surface } of the ponds on screen; the surface ripples

  scene.wallsFor = null;      // The walls array the wall graphics were built from
  scene.boxGfx = new Map();   // Box body -> Graphics
  scene.pool = { back: [], front: [] };
  scene.car = null;
}

// Match the renderer to the window size
function resizeRenderer() {
  if (app) app.renderer.resize(W, H);
}

// Screen-space backdrop: stars and two layers of distant hills. Each layer moves with the camera
// by its parallax factor (0 = fixed to the screen, 1 = moves with the world).
// Backdrop layers in screen space. Each moves with the camera by its parallax factor f
// (0 = fixed to the screen, 1 = moves with the world). Palms stand on the hill layer they belong to.
var PALM_LAYERS = {
  far: { f: 0.3, baseFrac: 0.64, amp: 55, spacing: 230, density: 0.55, scale: 0.5, tint: 0x1d1f3d, salt: 1 },
  near: { f: 0.5, baseFrac: 0.7, amp: 40, spacing: 330, density: 0.5, scale: 0.85, tint: 0x15172d, salt: 2 }
};

function drawSky() {
  var g = scene.sky;
  g.clear();
  var sx = function (fx, f) { return (((fx * W + panOffset.x * f) % W) + W) % W; };
  scene.stars.forEach(function (st) {
    g.circle(sx(st.x, 0.02), st.y * H, st.r).fill({ color: 0xffffff, alpha: st.a });
  });
  drawHillLayer(g, 0.12, 0.50, 70, 0x24264a);
  drawHillLayer(g, 0.3, 0.64, 55, 0x2c2f55);
  syncPalms('far');
  scene.hillsNear.clear();
  drawHillLayer(scene.hillsNear, 0.5, 0.7, 40, 0x31345f);
  syncPalms('near');
}

// Screen y of a hill layer's top edge at screen x
function hillLayerY(x, f, baseFrac, amp) {
  var u = x - panOffset.x * f;
  var baseY = H * baseFrac + (panOffset.y - H * 0.62) * f * 0.5;
  return baseY - amp * (0.6 * Math.sin(u / 260) + 0.4 * Math.sin(u / 97 + 1.7));
}

function drawHillLayer(g, f, baseFrac, amp, color) {
  var pts = [];
  for (var x = 0; x <= W + 20; x += 20) pts.push({ x: x, y: hillLayerY(x, f, baseFrac, amp) });
  pts.push({ x: W + 20, y: H }, { x: 0, y: H });
  g.poly(pts).fill(color);
}

// Deterministic pseudo-random number in [0, 1) for palm slot k of a layer, channel c
function palmRand(k, salt, c) {
  var v = Math.sin(k * 91.7 + salt * 13.1 + c * 47.3) * 43758.5453;
  return v - Math.floor(v);
}

// Palm silhouette (white, tinted per layer) with its trunk base at the texture's anchor.
// The trunk is a tapered curve; each frond is a drooping leaf shape.
function makePalmTexture(variant) {
  var lean = [-0.22, 0.12, 0.32][variant], h = [170, 205, 150][variant];
  var g = new PIXI.Graphics();
  // Trunk along a quadratic curve from the base (0, 0) to the crown
  var p1 = { x: lean * h * 0.25, y: -h * 0.55 }, p2 = { x: lean * h, y: -h };
  var left = [], right = [];
  for (var i = 0; i <= 12; i++) {
    var t = i / 12, it = 1 - t;
    var x = 2 * it * t * p1.x + t * t * p2.x, y = 2 * it * t * p1.y + t * t * p2.y;
    var dx = 2 * it * p1.x + 2 * t * (p2.x - p1.x), dy = 2 * it * p1.y + 2 * t * (p2.y - p1.y);
    var len = Math.sqrt(dx * dx + dy * dy), w = 6 - 3 * t;
    left.push({ x: x - dy / len * w, y: y + dx / len * w });
    right.push({ x: x + dy / len * w, y: y - dx / len * w });
  }
  g.poly(left.concat(right.reverse())).fill(0xffffff);
  // Fronds: directions in degrees (0 = right, -90 = up), drooping under their own weight
  var dirs = [-178, -145, -115, -85, -55, -22, 8, -195];
  dirs.forEach(function (deg, n) {
    var a = deg * Math.PI / 180, L = h * (0.5 + 0.12 * ((n * 37 + variant * 11) % 5) / 4);
    var top = [], bottom = [];
    for (var k = 0; k <= 10; k++) {
      var s = k / 10;
      var cx = p2.x + Math.cos(a) * L * s, cy = p2.y + Math.sin(a) * L * s + 0.55 * L * s * s;
      var nx = -Math.sin(a), ny = Math.cos(a);
      var wd = L * 0.11 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.15)), 0.7);
      top.push({ x: cx + nx * wd, y: cy + ny * wd });
      bottom.push({ x: cx - nx * wd, y: cy - ny * wd });
    }
    g.poly(top.concat(bottom.reverse())).fill(0xffffff);
  });
  // Coconuts under the crown
  g.circle(p2.x - 5, p2.y + 6, 5).fill(0xffffff);
  g.circle(p2.x + 4, p2.y + 8, 5).fill(0xffffff);
  g.circle(p2.x, p2.y + 12, 4.5).fill(0xffffff);
  var b = g.getLocalBounds();
  var tex = app.renderer.generateTexture({ target: g, resolution: 2, antialias: true });
  tex.palmAnchor = { x: -b.x / b.width, y: -b.y / b.height };
  g.destroy();
  return tex;
}

// Place palm sprites for one backdrop layer: slots every `spacing` px in layer space, some left empty,
// each with its own jitter, size, variant and mirroring. Sprites are pooled and reused every frame.
function syncPalms(name) {
  var L = PALM_LAYERS[name], pool = scene.palmPool[name];
  var container = name === 'far' ? scene.palmsFar : scene.palmsNear;
  var off = panOffset.x * L.f;  // Screen x = layer x + off
  var k0 = Math.floor((-off - 200) / L.spacing), k1 = Math.ceil((W - off + 200) / L.spacing);
  var used = 0;
  for (var k = k0; k <= k1; k++) {
    if (palmRand(k, L.salt, 1) > L.density) continue;
    var x = k * L.spacing + (palmRand(k, L.salt, 2) - 0.5) * L.spacing * 0.8 + off;
    var tex = scene.palmTex[Math.floor(palmRand(k, L.salt, 3) * 3)];
    var sp = pool[used];
    if (!sp) {
      sp = new PIXI.Sprite(tex);
      pool.push(sp);
      container.addChild(sp);
    }
    used++;
    sp.texture = tex;
    sp.anchor.set(tex.palmAnchor.x, tex.palmAnchor.y);
    var sc = L.scale * (0.75 + 0.5 * palmRand(k, L.salt, 4));
    sp.scale.set(palmRand(k, L.salt, 5) < 0.5 ? -sc : sc, sc);
    sp.position.set(x, hillLayerY(x, L.f, L.baseFrac, L.amp) + 4);
    sp.tint = L.tint;
    sp.visible = true;
  }
  for (var i = used; i < pool.length; i++) pool[i].visible = false;
}

// Surface points of the terrain from x0 to x1 (inclusive), one per ground quad
function surfacePoints(x0, x1) {
  var pts = [];
  for (var x = x0; x <= x1 + 0.5; x += TERRAIN.segW) pts.push({ x: x, y: groundHeightAt(x) });
  return pts;
}

// Distance post with a sign, standing on the ground at world x
function buildMarker(x, label) {
  var y = groundHeightAt(x);
  var c = new PIXI.Container();
  var g = new PIXI.Graphics();
  g.rect(x - 3, y - 95, 6, 95).fill(0xcfcfcf);
  g.roundRect(x - 42, y - 128, 84, 36, 6).fill(0xf4f1e8).stroke({ width: 2, color: 0x333333 });
  var t = new PIXI.Text({
    text: label,
    style: { fontFamily: 'Arial', fontSize: 20, fontWeight: 'bold', fill: 0x2a2a2a }
  });
  t.resolution = 2;
  t.anchor.set(0.5);
  t.position.set(x, y - 110);
  c.addChild(g, t);
  return c;
}

// Wooden jump ramp: planks between the ramp surface and the hills underneath
function buildRamp(js) {
  var x0 = js.rampStart, x1 = js.rampEnd;
  // Sample every 10 px, plus the exact corners at the lip so the drop stays crisp
  var xs = [];
  for (var x = x0; x < x1; x += 10) xs.push(x);
  xs.push(js.lip, js.lip + TERRAIN.segW, x1);
  xs = xs.filter(function (v) { return v >= x0 && v <= x1; }).sort(function (a, b) { return a - b; });
  var top = [], base = [];
  xs.forEach(function (x) {
    top.push({ x: x, y: groundHeightAt(x) });
    base.push({ x: x, y: baseHeightAt(x) + 4 });
  });
  var g = new PIXI.Graphics();
  g.poly(top.concat(base.reverse())).fill(0x8a5a32);
  // Support posts under the ramp
  for (var px = x0 + 60; px < x1 - 20; px += 70) {
    g.moveTo(px, groundHeightAt(px)).lineTo(px, baseHeightAt(px));
  }
  g.stroke({ width: 3, color: 0x5e3b1e });
  // Riding surface
  g.moveTo(top[0].x, top[0].y);
  for (var i = 1; i < top.length; i++) g.lineTo(top[i].x, top[i].y);
  g.stroke({ width: 8, color: 0xc28d55, join: 'round' });
  return g;
}

// Water of one pond: a translucent body down to the ground, and a rippling surface line (see syncPonds)
function buildPond(p) {
  var lvl = pondLevel(p);
  var pts = [{ x: p.x0, y: lvl }];
  for (var x = p.x0 + 10; x < p.x1; x += 10) pts.push({ x: x, y: groundHeightAt(x) });
  pts.push({ x: p.x1, y: lvl });
  var c = new PIXI.Container();
  var body = new PIXI.Graphics();
  body.poly(pts).fill({ color: 0x2b7fc0, alpha: 0.55 });
  // Lighter water near the surface
  var shallow = pts.map(function (q) { return { x: q.x, y: Math.min(q.y, lvl + 18) }; });
  body.poly(shallow).fill({ color: 0x7cc4ea, alpha: 0.2 });
  var surface = new PIXI.Graphics();
  c.addChild(body, surface);
  scene.ponds.push({ pond: p, surface: surface });
  return c;
}

// Redraw the surface line of each pond with small travelling waves
function syncPonds() {
  var t = performance.now() / 1000;
  scene.ponds = scene.ponds.filter(function (o) { return !o.surface.destroyed; });
  scene.ponds.forEach(function (o) {
    var p = o.pond, lvl = pondLevel(p), g = o.surface;
    g.clear();
    g.moveTo(p.x0, lvl);
    for (var x = p.x0 + 12; x < p.x1; x += 12) {
      g.lineTo(x, lvl + 1.6 * Math.sin(x / 37 - t * 2.2) + 1 * Math.sin(x / 13 + t * 3.1));
    }
    g.lineTo(p.x1, lvl);
    g.stroke({ width: 3, color: 0xbfe6f7, alpha: 0.85, join: 'round' });
  });
}

// Ground of one chunk (deep dirt, a lighter topsoil band, grass on top, distance markers) and,
// separately, the jump ramps that start in it
function buildChunk(ch) {
  var c = new PIXI.Container();
  var ramps = new PIXI.Container();
  var water = new PIXI.Container();
  // Overlap one quad into the next chunk so no seam shows between chunks
  var top = surfacePoints(ch.x0, ch.x1 + TERRAIN.segW);
  var last = top[top.length - 1];
  var g = new PIXI.Graphics();
  g.poly(top.concat([{ x: last.x, y: 3000 }, { x: top[0].x, y: 3000 }])).fill(0x3a2a20);
  var band = top.concat(top.slice().reverse().map(function (p) { return { x: p.x, y: p.y + 26 }; }));
  g.poly(band).fill(0x5a3f2c);
  g.moveTo(top[0].x, top[0].y);
  for (var i = 1; i < top.length; i++) g.lineTo(top[i].x, top[i].y);
  g.stroke({ width: 8, color: 0x4f9a3a, join: 'round' });
  c.addChild(g);
  // Jump ramps (with any table top and landing downhill) that start in this chunk, drawn over the ground
  var period = TERRAIN.jumpEveryM * PX_PER_M;
  for (var m = Math.max(1, Math.floor((ch.x0 - START_X) / period)); jumpSpec(m).rampStart < ch.x1; m++) {
    var js = jumpSpec(m);
    if (js.rampStart >= ch.x0 && js.rampStart < ch.x1) ramps.addChild(buildRamp(js));
    if (js.pond && js.pond.x0 >= ch.x0 && js.pond.x0 < ch.x1) water.addChild(buildPond(js.pond));
  }
  var step = 50 * PX_PER_M;
  var first = Math.ceil((ch.x0 - START_X) / step);
  for (var m = Math.max(1, first); START_X + m * step < ch.x1; m++) {
    c.addChild(buildMarker(START_X + m * step, (m * 50) + ' m'));
  }
  // START sign behind the car's starting spot, so the car does not hide it
  if (ch.index === 0) c.addChild(buildMarker(START_X - 210, 'START'));
  return { ground: c, ramps: ramps, water: water };
}

// Build graphics for newly loaded chunks and destroy those of unloaded ones
function syncTerrain() {
  terrainChunks.forEach(function (ch) {
    if (!scene.chunkGfx.has(ch)) {
      var c = buildChunk(ch);
      scene.terrain.addChild(c.ground);
      scene.ramps.addChild(c.ramps);
      scene.water.addChild(c.water);
      scene.chunkGfx.set(ch, c);
    }
  });
  scene.chunkGfx.forEach(function (c, ch) {
    if (terrainChunks.get(ch.index) !== ch) {
      c.ground.destroy({ children: true });
      c.ramps.destroy({ children: true });
      c.water.destroy({ children: true });
      scene.chunkGfx.delete(ch);
    }
  });
}

// Walls are static: rebuild their graphics only when the walls array is replaced
function syncWalls() {
  if (scene.wallsFor === walls) return;
  scene.wallsFor = walls;
  var g = scene.walls;
  g.clear();
  walls.forEach(function (b) {
    g.poly(b.vertices).fill(hexColor(b.renderColor || '#3a4358'))
      .stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  });
}

// One Graphics per box, built from its real vertices the first time it is seen
function syncBoxes() {
  var seen = new Set();
  for (var i = 0; i < boxes.length; i++) {
    var b = boxes[i];
    var g = scene.boxGfx.get(b);
    if (!g) {
      var pts = toLocal(b, b.vertices);
      g = new PIXI.Graphics();
      g.poly(pts).fill(hexColor(b.renderColor || '#aaaaaa'))
        .stroke({ width: 1.5, color: 0xffffff, alpha: 0.4 });
      scene.boxes.addChild(g);
      scene.boxGfx.set(b, g);
    }
    g.position.set(b.position.x, b.position.y);
    g.rotation = b.angle;
    seen.add(b);
  }
  // Drop graphics of removed boxes
  scene.boxGfx.forEach(function (g, b) {
    if (!seen.has(b)) {
      g.destroy();
      scene.boxGfx.delete(b);
    }
  });
}

// One side window: gradient glass and a reflection streak, clipped to the window shape, plus a frame
function buildWindow(pts) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(function (p) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  var win = new PIXI.Container();
  var glass = new PIXI.Sprite(scene.glassTex);
  glass.position.set(minX, minY);
  glass.width = maxX - minX;
  glass.height = maxY - minY;
  var streak = new PIXI.Graphics()
    .moveTo(pts[1].x + 10, pts[1].y).lineTo(pts[1].x - 4, pts[0].y)
    .stroke({ width: 7, color: 0xffffff, alpha: 0.45 });
  var mask = new PIXI.Graphics().poly(pts).fill(0xffffff);
  win.addChild(glass, streak, mask);
  win.mask = mask;
  var frame = new PIXI.Graphics().poly(pts).stroke({ width: 2.5, color: 0x2b2b2b, join: 'round' });
  var group = new PIXI.Container();
  group.addChild(win, frame);
  return group;
}

// A wheel in its own frame: tyre, five spokes, hub
function buildWheel(r) {
  var g = new PIXI.Graphics();
  g.circle(0, 0, r).fill(0x222222).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 });
  for (var i = 0; i < 5; i++) {
    var a = (i / 5) * Math.PI * 2;
    g.moveTo(0, 0).lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
  }
  g.stroke({ width: r * 0.08, color: 0xaaaaaa });
  g.circle(0, 0, r * 0.2).fill(0x888888);
  return g;
}

// Car body in chassis-local coordinates. Draw order: cabin, windows, tailpipe, then the base,
// which covers the cabin seam and the inner end of the pipe.
function buildCar() {
  var ch = car.chassis;
  var color = hexColor(car.color);
  var body = new PIXI.Container();
  var cabin = new PIXI.Graphics().poly(toLocal(ch, ch.parts[2].vertices)).fill(color)
    .stroke({ width: 2, color: 0x222222 });
  body.addChild(cabin);
  car.windows.forEach(function (pts) { body.addChild(buildWindow(pts)); });
  body.addChild(new PIXI.Graphics()
    .moveTo(car.exhaust.x + 14, car.exhaust.y).lineTo(car.exhaust.x - 22, car.exhaust.y)
    .stroke({ width: 6, color: 0x3a3a3a, cap: 'round' }));
  body.addChild(new PIXI.Graphics().poly(toLocal(ch, ch.parts[1].vertices)).fill(color)
    .stroke({ width: 2, color: 0x222222 }));
  var wheels = car.wheels.map(function () { return buildWheel(car.wheelR); });
  scene.carLayer.addChild(body);
  wheels.forEach(function (w) { scene.carLayer.addChild(w); });
  scene.car = { forCar: car, body: body, wheels: wheels };
}

function syncCar() {
  if (!car) return;
  if (!scene.car || scene.car.forCar !== car) {
    scene.carLayer.removeChildren().forEach(function (c) { c.destroy({ children: true }); });
    buildCar();
  }
  scene.car.body.position.set(car.chassis.position.x, car.chassis.position.y);
  scene.car.body.rotation = car.chassis.angle;
  car.wheels.forEach(function (wl, i) {
    scene.car.wheels[i].position.set(wl.position.x, wl.position.y);
    scene.car.wheels[i].rotation = wl.angle;
  });
}

// Particles reuse a pool of tinted sprites per layer; unused sprites are hidden
function syncParticles() {
  var used = { back: 0, front: 0 };
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var t = p.age / p.life;
    // Fade in over the first 60 ms, fade out over the whole life
    var a = p.alpha * (1 - t) * Math.min(1, p.age / 60);
    if (a <= 0.01) continue;
    var pool = scene.pool[p.layer];
    var s = pool[used[p.layer]];
    if (!s) {
      s = new PIXI.Sprite(PIXI.Texture.WHITE);
      s.anchor.set(0.5);
      pool.push(s);
      scene[p.layer].addChild(s);
    }
    used[p.layer]++;
    s.texture = p.soft ? scene.softTex : PIXI.Texture.WHITE;
    s.visible = true;
    s.position.set(p.x, p.y);
    s.width = s.height = p.size * 2;
    if (p.tint === undefined) p.tint = hexColor(p.color);
    s.tint = p.tint;
    s.alpha = a;
  }
  ['back', 'front'].forEach(function (layer) {
    var pool = scene.pool[layer];
    for (var j = used[layer]; j < pool.length; j++) pool[j].visible = false;
  });
}

// Draw one frame
function draw() {
  if (!app || !isFinite(zoom) || zoom <= 0) return;
  drawSky();
  scene.world.position.set(panOffset.x, panOffset.y);
  scene.world.scale.set(zoom);
  syncTerrain();
  syncPonds();
  syncWalls();
  syncBoxes();
  syncCar();
  syncParticles();
  app.render();
}
