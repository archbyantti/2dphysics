// Water in the ponds (see terrain.js for where they are): buoyancy and drag on everything in them.
// The submerged part of each body is found by clipping its polygon against the water, so the lift
// acts at the right place and tilts a body that enters at an angle. Call applyWater once per
// substep, before Engine.update.

var WATER = {
  density: 0.0014,   // Lift per px^2 under water, in Matter.js density units (boxes, 0.0012, float)
  drag: 0.02,        // Share of the speed lost per 60 Hz step when fully submerged...
  quadDrag: 0.004,   // ...plus this much per px/step of speed (fast entries brake hard)
  turnDrag: 0.06,    // Same for rotation of the car body and the boxes
  spinDrag: 0.012    // Same for the spin of a wheel
};

// Every body the water acts on
function waterBodies() {
  return (car ? [car.chassis].concat(car.wheels) : []).concat(boxes);
}

// Keep the part of polygon `pts` where sign * (p[axis] - v) >= 0 (one Sutherland-Hodgman pass)
function clipPoly(pts, axis, v, sign) {
  var out = [];
  for (var i = 0; i < pts.length; i++) {
    var a = pts[i], b = pts[(i + 1) % pts.length];
    var da = sign * (a[axis] - v), db = sign * (b[axis] - v);
    if (da >= 0) out.push(a);
    if ((da >= 0) !== (db >= 0)) {
      var t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

// Area and centroid of a polygon
function polyAreaCentroid(pts) {
  var a = 0, cx = 0, cy = 0;
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i], q = pts[(i + 1) % pts.length];
    var cr = p.x * q.y - q.x * p.y;
    a += cr;
    cx += (p.x + q.x) * cr;
    cy += (p.y + q.y) * cr;
  }
  if (Math.abs(a) < 1e-6) return { area: 0, x: 0, y: 0 };
  return { area: Math.abs(a / 2), x: cx / (3 * a), y: cy / (3 * a) };
}

// Part of a polygon that is under the water of pond p
function submerged(pts, p) {
  var s = clipPoly(pts, 'y', pondLevel(p), 1);
  if (s.length) s = clipPoly(s, 'x', p.x0, 1);
  if (s.length) s = clipPoly(s, 'x', p.x1, -1);
  return s.length >= 3 ? polyAreaCentroid(s) : null;
}

// Buoyancy and drag for one substep of `dt` ms. Sets body.wetFrac (0..1, share of the body under water).
function applyWater(dt) {
  var k = dt / (1000 / 60);
  var g = engine.gravity.y * engine.gravity.scale;
  waterBodies().forEach(function (b) {
    b.wetFrac = 0;
    var p = pondNear(b.position.x);
    if (!p || b.bounds.max.x < p.x0 || b.bounds.min.x > p.x1 || b.bounds.max.y < pondLevel(p)) return;
    var parts = b.parts.length > 1 ? b.parts.slice(1) : [b];
    var wet = 0;
    parts.forEach(function (part) {
      var s = submerged(part.vertices, p);
      if (!s) return;
      wet += s.area;
      // Lift equal to the weight of the displaced water, at the centre of the displaced water
      Matter.Body.applyForce(b, { x: s.x, y: s.y }, { x: 0, y: -WATER.density * s.area * g });
    });
    if (!wet) return;
    var frac = b.wetFrac = Math.min(1, wet / b.area);
    var v = Matter.Body.getVelocity(b);
    var sp = Math.sqrt(v.x * v.x + v.y * v.y);
    var damp = Math.exp(-(WATER.drag + WATER.quadDrag * sp) * frac * k);
    Matter.Body.setVelocity(b, { x: v.x * damp, y: v.y * damp });
    if (b.brakeLocked) return;  // A held wheel does not turn anyway
    var turn = car && car.wheels.indexOf(b) >= 0 ? WATER.spinDrag : WATER.turnDrag;
    Matter.Body.setAngularVelocity(b, Matter.Body.getAngularVelocity(b) * Math.exp(-turn * frac * k));
  });
}

// True if world point (x, y) is under water
function isUnderwater(x, y) {
  var lvl = waterLevelAt(x);
  return lvl !== null && y > lvl;
}
