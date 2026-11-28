// Endless rolling terrain. The surface height is an analytic function of x (`groundHeightAt`),
// so any x can be queried without generating anything. Physics bodies exist only near the car:
// the ground is split into chunks of SEGS_PER_CHUNK static quads that are created ahead of the
// car and removed behind it.

var TERRAIN = {
  segW: 40,             // Width of one ground quad, px
  segsPerChunk: 50,     // Quads per chunk (2000 px = ~33 m)
  depth: 400,           // How far each quad reaches below the surface, px
  keepBehind: 2,        // Chunks kept behind the car's chunk
  keepAhead: 3,         // Chunks kept ahead of the car's chunk
  flatUntil: 700,       // Flat start area (px from the start line)
  rampLength: 1500,     // Hills fade in over this distance after the flat area
  hillsGrowM: 900,      // Hills get this many meters to grow one more time their starting size...
  hillsMaxScale: 2.2,   // ...up to this many times (max slope ~13 deg at the start, ~27 deg at the cap)
  jumpEveryM: 100,      // A jump ramp before every 100 m marker
  jumpLipBefore: 160,   // The lip sits this far before the marker (a multiple of segW keeps it crisp)
  jumpHeight: 150,      // Lip height of the first jump, px
  jumpGrowth: 0.12,     // Each further jump is this much bigger (relative to the first)...
  jumpMaxHeight: 420,   // ...up to this lip height, px
  dropCrestR: 1500,     // Drop-ins: curve radius over the top (follows a car's flight at ~25 px/step)...
  dropBottomR: 1800     // ...and at the bottom, px
};

var terrainChunks = new Map();   // Chunk index -> { index, bodies, x0, x1 }
var terrainSegs = new Map();     // Global quad index -> body (for nearby lookups)
var jumpSpecs = new Map();       // Jump number -> shape, computed once

// Surface y at world x, including jump ramps. y grows downward; the flat start area sits at y = 0.
function groundHeightAt(x) {
  return baseHeightAt(x) - jumpRise(x);
}

// Ground y without the ramps: the hills, lowered by every drop-in passed so far
function baseHeightAt(x) {
  return hillsHeightAt(x) + dropOffset(x);
}

// How far drop-ins have lowered the ground at x (sum of all earlier drops, plus the current one)
var dropPrefix = [0, 0];  // dropPrefix[m] = total drop of jumps 1..m-1
function dropOffset(x) {
  var period = TERRAIN.jumpEveryM * PX_PER_M;
  var m = Math.round((x - START_X + TERRAIN.jumpLipBefore) / period);
  if (m < 1) return 0;
  while (dropPrefix.length <= m) {
    var k = dropPrefix.length - 1;
    dropPrefix.push(dropPrefix[k] + jumpSpec(k).drop);
  }
  var j = jumpSpec(m), before = dropPrefix[m];
  if (!j.drop || x <= j.dropStart) return before;
  if (x >= j.dropStart + j.descent) return before + j.drop;
  var dx = x - j.dropStart, a = j.dropSlope * TERRAIN.dropCrestR;
  if (dx <= a) return before + dx * dx / (2 * TERRAIN.dropCrestR);  // Bending over the top
  var e = dx - a;
  return before + a * a / (2 * TERRAIN.dropCrestR) + j.dropSlope * e - e * e / (2 * TERRAIN.dropBottomR);
}

// Deterministic pseudo-random number in [0, 1) for jump m and channel k (same world every time)
function jumpRand(m, k) {
  var v = Math.sin(m * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

// x of the lip of jump number m (m >= 1)
function jumpLipX(m) {
  return START_X + m * TERRAIN.jumpEveryM * PX_PER_M - TERRAIN.jumpLipBefore;
}

// Shape of jump m. Jumps grow with distance and come in four kinds:
//   kicker    - curves up, steepest at the lip, then a drop straight to the ground
//   tabletop  - a kicker with a flat top, ending in a short drop onto a downhill (so a slow car rolls off)
//   ramp      - a long, almost straight ramp
//   landing   - a kicker whose lip drops onto a long downhill, for soft landings
// Fields: length (run-up), height, curve (profile exponent), table (flat top), landDrop (share of the
// height dropped at the lip) and landLength (downhill after the drop). Lip slope = curve * height / length.
// Extent: start = dropStart (drop-in, if any) .. rampStart (foot of the ramp) .. lip .. end.
function jumpSpec(m) {
  if (jumpSpecs.has(m)) return jumpSpecs.get(m);
  var spec;
  if (m === 1) {
    spec = { kind: 'kicker', height: TERRAIN.jumpHeight, length: 500, curve: 2, table: 0, landDrop: 1, landLength: 0 };
  } else {
    var size = Math.min(1 + TERRAIN.jumpGrowth * (m - 1), TERRAIN.jumpMaxHeight / TERRAIN.jumpHeight);
    var h = Math.min(TERRAIN.jumpMaxHeight, TERRAIN.jumpHeight * size * (0.85 + 0.3 * jumpRand(m, 1)));
    var pick = jumpRand(m, 2);
    var kind = pick < 0.4 ? 'kicker' : pick < 0.6 ? 'tabletop' : pick < 0.8 ? 'ramp' : 'landing';
    var curve = kind === 'ramp' ? 1.15 : 1.7 + 0.9 * jumpRand(m, 3);
    var lipDeg = kind === 'ramp' ? 22 + 6 * jumpRand(m, 4) : 27 + 10 * jumpRand(m, 4);
    spec = {
      kind: kind,
      height: h,
      length: Math.min(2400, curve * h / Math.tan(lipDeg * Math.PI / 180)),
      curve: curve,
      table: kind === 'tabletop' ? 150 + 300 * jumpRand(m, 5) : 0,
      landDrop: kind === 'landing' ? 0.45 : kind === 'tabletop' ? 0.25 : 1,
      landLength: 0
    };
    // Downhill after the drop: ~15 deg for landing jumps, ~22 deg for tabletops
    var downDeg = kind === 'landing' ? 15 : 22;
    if (spec.landDrop < 1) {
      spec.landLength = Math.min(2000, h * (1 - spec.landDrop) / Math.tan(downDeg * Math.PI / 180));
    }
  }
  spec.lip = jumpLipX(m);
  spec.rampStart = spec.lip - spec.table - spec.length;
  // Drop-in: from the third jump on, about half of the jumps start with a steep downhill (up to 30 deg)
  // and a short flat run-out to the foot of the ramp. The ground stays that much lower afterwards, so
  // the car really loses height: gravity takes it past the engine's top speed and it hits the ramp
  // faster. (A hill that is climbed first gives nothing: the climb costs what the descent returns.)
  // Everything must fit in the half period before the lip, or the next jump would overlap.
  spec.drop = 0;
  spec.descent = 0;
  spec.runout = 0;
  if (m >= 3 && jumpRand(m, 6) < 0.5) {
    // Profile: the top bends over like the path of a car flying at ~25 px/step (radius crestR), so the
    // car stays on the ground; the steepest part is in the middle; the bottom levels out over a wider
    // radius (bottomR) so the car is not slammed into the ground at speed. A sharper top would launch
    // the car and it would land on the slope at the wrong angle, losing the speed it should gain.
    var runout = 240, R = TERRAIN.dropCrestR + TERRAIN.dropBottomR;
    var room = TERRAIN.jumpEveryM * PX_PER_M / 2 - 100 - spec.table - spec.length - runout;
    var D = 220 + 0.6 * spec.height * jumpRand(m, 7);
    var slope = Math.min(Math.tan(30 * Math.PI / 180), Math.sqrt(2 * D / R), room / R);
    if (slope >= 0.2) {
      spec.drop = slope * slope * R / 2;
      spec.dropSlope = slope;
      spec.descent = slope * R;
      spec.runout = runout;
    }
  }
  spec.dropStart = spec.rampStart - spec.runout - spec.descent;
  spec.start = spec.dropStart;
  spec.end = spec.lip + TERRAIN.segW + spec.landLength;
  jumpSpecs.set(m, spec);
  return spec;
}

// How far a jump ramp raises the ground at x (0 away from ramps)
function jumpRise(x) {
  var period = TERRAIN.jumpEveryM * PX_PER_M;
  var m = Math.round((x - START_X + TERRAIN.jumpLipBefore) / period);
  if (m < 1) return 0;
  var j = jumpSpec(m);
  if (x <= j.start || x >= j.end) return 0;
  if (x < j.rampStart) return 0;  // Drop-in and run-out are part of the base ground (dropOffset)
  var d = x - j.rampStart;
  if (d <= j.length) return j.height * Math.pow(d / j.length, j.curve);
  if (x <= j.lip) return j.height;  // Table top
  var rest = j.height * (1 - j.landDrop);
  var e = x - j.lip;
  if (e < TERRAIN.segW) return j.height - (j.height - rest) * (e / TERRAIN.segW);  // The drop at the lip
  return rest * (1 - (e - TERRAIN.segW) / j.landLength);  // Landing downhill
}

// Ground y of the rolling hills alone, without jumps.
// A few incommensurate sine waves give hills that never repeat exactly. They start gentle (max slope
// ~13 deg) and grow taller and steeper with distance, up to TERRAIN.hillsMaxScale.
function hillsHeightAt(x) {
  var raw = rawHillsAt(x);
  // Grade the ground under each jump: inside the jump's zone the hills give way to a straight slope
  // between the zone's ends, so drop-ins and ramps get their designed shape instead of riding on bumps.
  // The zone is kept inside this jump's half period, so neighbouring jumps never disagree.
  var period = TERRAIN.jumpEveryM * PX_PER_M;
  var m = Math.round((x - START_X + TERRAIN.jumpLipBefore) / period);
  if (m < 1) return raw;
  var j = jumpSpec(m);
  var z0 = Math.max(j.start - 300, j.lip - period / 2 + 10);
  var z1 = Math.min(j.end + 300, j.lip + period / 2 - 10);
  if (x <= z0 || x >= z1) return raw;
  var h0 = rawHillsAt(z0), h1 = rawHillsAt(z1);
  var line = h0 + (h1 - h0) * (x - z0) / (z1 - z0);
  var w = Math.min(1, (x - z0) / 400, (z1 - x) / 400);
  w = w * w * (3 - 2 * w);
  return raw * (1 - w) + line * w;
}

// The rolling hills before grading
function rawHillsAt(x) {
  var hills = 120 * Math.sin(x / 2600 + 0.8) +
    55 * Math.sin(x / 820 + 1.3) +
    22 * Math.sin(x / 330 + 0.4) +
    6 * Math.sin(x / 120 + 2.1);
  // Offset so the hills start at 0, and fade them in after the flat start area
  var base = 120 * Math.sin(0.8) + 55 * Math.sin(1.3) + 22 * Math.sin(0.4) + 6 * Math.sin(2.1);
  var t = (x - TERRAIN.flatUntil) / TERRAIN.rampLength;
  t = Math.max(0, Math.min(1, t));
  var fade = t * t * (3 - 2 * t);  // Smoothstep
  return -(hills - base) * fade * hillsScale(x);
}

// How many times taller than at the start the hills are at x
function hillsScale(x) {
  var m = Math.max(0, (x - START_X) / PX_PER_M);
  return Math.min(TERRAIN.hillsMaxScale, 1 + m / TERRAIN.hillsGrowM);
}

// One static quad from x0 to x0 + segW: its top follows the surface, its bottom is flat
function makeGroundSeg(i) {
  var x0 = i * TERRAIN.segW, x1 = x0 + TERRAIN.segW;
  var y0 = groundHeightAt(x0), y1 = groundHeightAt(x1);
  var bottom = Math.max(y0, y1) + TERRAIN.depth;
  var verts = [{ x: x0, y: y0 }, { x: x1, y: y1 }, { x: x1, y: bottom }, { x: x0, y: bottom }];
  var c = Matter.Vertices.centre(verts);
  return Bodies.fromVertices(c.x, c.y, [verts], {
    isStatic: true,
    friction: 1,
    collisionFilter: { category: CAT.ground, mask: CAT.car | CAT.box }
  });
}

function loadChunk(k) {
  var bodies = [];
  for (var j = 0; j < TERRAIN.segsPerChunk; j++) {
    var i = k * TERRAIN.segsPerChunk + j;
    var b = makeGroundSeg(i);
    bodies.push(b);
    terrainSegs.set(i, b);
  }
  World.add(world, bodies);
  var w = TERRAIN.segW * TERRAIN.segsPerChunk;
  terrainChunks.set(k, { index: k, bodies: bodies, x0: k * w, x1: (k + 1) * w });
}

function unloadChunk(k) {
  var ch = terrainChunks.get(k);
  World.remove(world, ch.bodies);
  for (var j = 0; j < TERRAIN.segsPerChunk; j++) terrainSegs.delete(k * TERRAIN.segsPerChunk + j);
  terrainChunks.delete(k);
}

// Keep the chunks around world x loaded; call once per frame with the car's x
function updateTerrain(x) {
  var w = TERRAIN.segW * TERRAIN.segsPerChunk;
  var k = Math.floor(x / w);
  for (var a = Math.max(0, k - TERRAIN.keepBehind); a <= k + TERRAIN.keepAhead; a++) {
    if (!terrainChunks.has(a)) loadChunk(a);
  }
  // Hysteresis: unload only one chunk further out than we load, so nothing flickers at a border
  terrainChunks.forEach(function (ch, idx) {
    if (idx < k - TERRAIN.keepBehind - 1 || idx > k + TERRAIN.keepAhead + 1) unloadChunk(idx);
  });
}

// Ground quads within `range` px of world x (for cheap contact queries)
function terrainBodiesNear(x, range) {
  var r = Math.ceil((range || 120) / TERRAIN.segW);
  var c = Math.floor(x / TERRAIN.segW), out = [];
  for (var i = c - r; i <= c + r; i++) {
    var b = terrainSegs.get(i);
    if (b) out.push(b);
  }
  return out;
}
