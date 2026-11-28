// Convert screen coordinates to world coordinates
function screenToWorld(sx, sy) {
  return { x: (sx - panOffset.x) / zoom, y: (sy - panOffset.y) / zoom };
}

// Convert world coordinates to screen coordinates
function worldToScreen(wx, wy) {
  return { x: wx * zoom + panOffset.x, y: wy * zoom + panOffset.y };
}

// How hard a new contact hit: relative speed along the contact normal, in px per 60 Hz step.
// Sliding or rolling along a surface (e.g. a wheel crossing ground seams) scores near zero.
// Uses the parent bodies, because parts of a compound body (the car chassis) carry no velocity.
function impactSpeed(pair) {
  var a = pair.bodyA.parent, b = pair.bodyB.parent, n = pair.collision.normal;
  var dvx = a.velocity.x - b.velocity.x, dvy = a.velocity.y - b.velocity.y;
  var perStep = Math.abs(dvx * n.x + dvy * n.y);
  // Raw velocity is per physics step; normalize to a 60 Hz step
  return perStep * (1000 / 60) / (a.deltaTime || 1000 / 60);
}

// True if either body of a collision pair is in collision category `cat`
function pairHas(pair, cat) {
  return pair.bodyA.parent.collisionFilter.category === cat || pair.bodyB.parent.collisionFilter.category === cat;
}
