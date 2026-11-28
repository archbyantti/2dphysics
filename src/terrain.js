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
  jumpEveryM: 100,      // A jump ramp before every 100 m marker
  jumpLength: 300,      // Ramp run-up length, px
  jumpHeight: 70,       // Height of the lip above the surrounding ground, px
  jumpLipBefore: 160    // The lip sits this far before the marker (a multiple of segW keeps it crisp)
};

var terrainChunks = new Map();   // Chunk index -> { index, bodies, x0, x1 }
var terrainSegs = new Map();     // Global quad index -> body (for nearby lookups)

// Surface y at world x, including jump ramps. y grows downward; the flat start area sits at y = 0.
function groundHeightAt(x) {
  return hillsHeightAt(x) - jumpRise(x);
}

// x of the lip of jump number m (m >= 1)
function jumpLipX(m) {
  return START_X + m * TERRAIN.jumpEveryM * PX_PER_M - TERRAIN.jumpLipBefore;
}

// How far a jump ramp raises the ground at x (0 away from ramps). The ramp curves up like a kicker
// (steeper toward the lip) and the lip drops back to the ground over one ground quad.
function jumpRise(x) {
  var period = TERRAIN.jumpEveryM * PX_PER_M;
  var m = Math.round((x - START_X + TERRAIN.jumpLipBefore) / period);
  if (m < 1) return 0;
  var d = x - (jumpLipX(m) - TERRAIN.jumpLength);
  if (d <= 0) return 0;
  if (d <= TERRAIN.jumpLength) return TERRAIN.jumpHeight * Math.pow(d / TERRAIN.jumpLength, 1.6);
  var drop = d - TERRAIN.jumpLength;
  if (drop < TERRAIN.segW) return TERRAIN.jumpHeight * (1 - drop / TERRAIN.segW);
  return 0;
}

// Ground y of the rolling hills alone, without jumps.
// A few incommensurate sine waves give gentle hills that never repeat exactly. Max slope is ~14 deg.
function hillsHeightAt(x) {
  var hills = 120 * Math.sin(x / 2600 + 0.8) +
    55 * Math.sin(x / 820 + 1.3) +
    22 * Math.sin(x / 330 + 0.4) +
    6 * Math.sin(x / 120 + 2.1);
  // Offset so the hills start at 0, and fade them in after the flat start area
  var base = 120 * Math.sin(0.8) + 55 * Math.sin(1.3) + 22 * Math.sin(0.4) + 6 * Math.sin(2.1);
  var t = (x - TERRAIN.flatUntil) / TERRAIN.rampLength;
  t = Math.max(0, Math.min(1, t));
  var fade = t * t * (3 - 2 * t);  // Smoothstep
  return -(hills - base) * fade;
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
