// Lightweight particle system for visual effects (smoke, dust, mud): spawning and motion only.
// Particles are decoration: they live in world coordinates and never touch the physics.
// render.js draws them (soft sprites for `soft` particles, solid squares otherwise).
// Velocities are in px/s, gravity in px/s^2, drag is a per-second damping rate, times in ms.

var MAX_PARTICLES = 800;
var particles = [];

// Add one particle; unspecified fields get defaults. The oldest particle is dropped at the cap.
function spawnParticle(o) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push({
    x: o.x, y: o.y,
    vx: o.vx || 0, vy: o.vy || 0,
    age: 0, life: o.life || 1000,
    size: o.size || 4, grow: o.grow || 0,
    alpha: o.alpha === undefined ? 1 : o.alpha,
    gravity: o.gravity || 0, drag: o.drag || 0,
    color: o.color || '#ffffff',
    soft: !!o.soft,          // Soft sprite (smoke, dust) or solid dot (mud)
    bounce: !!o.bounce,      // Bounces off the ground instead of falling through
    layer: o.layer || 'front'
  });
}

// Advance all particles by `ms` of simulation time
function updateParticles(ms) {
  var s = ms / 1000;
  var groundY = walls.length ? walls[0].bounds.min.y : Infinity;
  var keep = 0;
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    p.age += ms;
    if (p.age >= p.life) continue;
    var damp = Math.exp(-p.drag * s);
    p.vy += p.gravity * s;
    p.vx *= damp;
    p.vy *= damp;
    p.x += p.vx * s;
    p.y += p.vy * s;
    p.size += p.grow * s;
    if (p.bounce && p.y > groundY - p.size) {
      p.y = groundY - p.size;
      p.vy *= -0.3;
      p.vx *= 0.5;
    }
    particles[keep++] = p;
  }
  particles.length = keep;
}
