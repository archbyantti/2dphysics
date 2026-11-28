// Lightweight particle system for visual effects (smoke, dust, mud).
// Particles are decoration only: they live in world coordinates and never touch the physics.
// Velocities are in px/s, gravity in px/s^2, drag is a per-second damping rate, times in ms.

var MAX_PARTICLES = 800;
var particles = [];
var spriteCache = {};

// Convert '#rrggbb' to an 'rgba(r,g,b,a)' string
function hexToRgba(hex, a) {
  var n = parseInt(hex.slice(1), 16);
  return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

// Soft round sprite of one color, rendered once so each particle is a cheap drawImage
function softSprite(color) {
  if (spriteCache[color]) return spriteCache[color];
  var c = document.createElement('canvas');
  c.width = c.height = 64;
  var g = c.getContext('2d');
  var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, hexToRgba(color, 1));
  grad.addColorStop(0.4, hexToRgba(color, 0.6));
  grad.addColorStop(1, hexToRgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  spriteCache[color] = c;
  return c;
}

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

// Draw the particles of one layer ('back' = behind the car, 'front' = in front of it)
function drawParticles(layer) {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    if (p.layer !== layer) continue;
    var t = p.age / p.life;
    // Fade in over the first 60 ms, fade out over the whole life
    var a = p.alpha * (1 - t) * Math.min(1, p.age / 60);
    if (a <= 0.01) continue;
    var pos = worldToScreen(p.x, p.y);
    var r = Math.max(0.5, p.size * zoom);
    ctx.globalAlpha = a;
    if (p.soft) {
      ctx.drawImage(softSprite(p.color), pos.x - r, pos.y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(pos.x - r, pos.y - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
}
