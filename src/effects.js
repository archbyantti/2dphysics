// Visual effect emitters: exhaust smoke, dust and mud from the tyres, dust from hard impacts.
// Emitters only spawn particles (see particles.js); they never change the physics.

var FX = {
  smokeIdleRate: 5,       // Exhaust puffs per second at idle
  smokeThrottleRate: 45,  // Exhaust puffs per second on throttle
  dirtMaxRate: 90,        // Tyre dirt particles per second per wheel, at most
  mudShare: 0.3,          // Share of tyre dirt that is heavy mud instead of dust
  impactMinSpeed: 3,      // Impact speed (px per 60 Hz step, along the contact normal) for dust
  landingMinSpeed: 6      // Same for the car hitting the ground (a drop of roughly 45 px or more)
};

var fxCarry = { smoke: 0, dirt: [0, 0] };  // Fractional particles carried between frames

function rand(a, b) {
  return a + Math.random() * (b - a);
}

// Emit and advance all effects by `ms` of simulation time; call once per frame
function updateEffects(ms) {
  if (car) {
    emitExhaust(ms);
    car.wheels.forEach(function (wl, i) { emitWheelDirt(wl, i, ms); });
  }
  updateParticles(ms);
}

// Exhaust smoke: a light trickle at idle, thick dark puffs on throttle
function emitExhaust(ms) {
  var throttle = input.accel || input.rev;
  fxCarry.smoke += (throttle ? FX.smokeThrottleRate : FX.smokeIdleRate) * ms / 1000;
  if (fxCarry.smoke < 1) return;
  var at = chassisToWorld({ x: car.exhaust.x - 26, y: car.exhaust.y });
  var fwd = carForward();
  var v = Matter.Body.getVelocity(car.chassis);
  while (fxCarry.smoke >= 1) {
    fxCarry.smoke -= 1;
    var push = rand(40, 90);
    spawnParticle({
      x: at.x, y: at.y,
      vx: v.x * 60 * 0.3 - fwd.x * push + rand(-10, 10),
      vy: v.y * 60 * 0.3 - fwd.y * push + rand(-25, -5),
      life: rand(900, 1700),
      size: rand(3, 5), grow: rand(18, 30),
      alpha: throttle ? 0.55 : 0.35,
      gravity: -25, drag: 1.6,
      color: throttle ? '#9a9aa2' : '#c4c4c8',
      soft: true, layer: 'back'
    });
  }
}

// Dust and mud flung from a tyre that touches the ground or a box. Spinning faster than the car
// moves (wheelspin) and braking hard throw the most; plain rolling throws a little at speed.
function emitWheelDirt(wl, i, ms) {
  var hits = Matter.Query.collides(wl, terrainBodiesNear(wl.position.x).concat(walls, boxes));
  if (!hits.length) {
    fxCarry.dirt[i] = 0;
    return;
  }
  var r = car.wheelR;
  var fwd = carForward();
  var v = Matter.Body.getVelocity(wl);
  var rim = Matter.Body.getAngularVelocity(wl) * 60 * r;   // Tyre surface speed, px/s
  var ground = (v.x * fwd.x + v.y * fwd.y) * 60;           // Car speed along forward, px/s
  var slip = rim - ground;
  var intensity = Math.abs(slip) / 250 + Math.abs(ground) / 1800;
  if (input.brake) intensity += Math.abs(ground) / 600;
  var rate = Math.min(FX.dirtMaxRate, intensity * 60);
  fxCarry.dirt[i] += rate * ms / 1000;
  if (fxCarry.dirt[i] < 1) return;

  // Contact point: the collision support if Matter.js gives one, else the bottom of the tyre
  var sup = hits[0].supports && hits[0].supports[0];
  var at = sup ? { x: sup.x, y: sup.y } : { x: wl.position.x, y: wl.position.y + r };
  // The tyre surface at the contact moves opposite to the spin; dirt flies that way and up
  var dir = rim >= 0 ? -1 : 1;
  if (Math.abs(rim) < 30) dir = ground >= 0 ? -1 : 1;  // Locked wheel: spray from the skid
  while (fxCarry.dirt[i] >= 1) {
    fxCarry.dirt[i] -= 1;
    var mud = Math.random() < FX.mudShare;
    var speed = Math.min(400, Math.abs(slip) * 0.35) + rand(40, 140);
    var base = {
      x: at.x + rand(-6, 6), y: at.y - rand(0, 6),
      vx: v.x * 60 * 0.4 + fwd.x * dir * speed,
      vy: v.y * 60 * 0.4 + fwd.y * dir * speed - rand(60, mud ? 260 : 160)
    };
    if (mud) {
      base.life = rand(700, 1200);
      base.size = rand(1.8, 3.4);
      base.gravity = 900; base.drag = 0.4;
      base.color = Math.random() < 0.5 ? '#8a6a42' : '#a5804f';
      base.bounce = true;
    } else {
      base.life = rand(500, 1100);
      base.size = rand(3, 6); base.grow = rand(20, 35);
      base.alpha = 0.55;
      base.gravity = 40; base.drag = 2.2;
      base.color = '#d6bf98';
      base.soft = true;
    }
    spawnParticle(base);
  }
}

// A puff of dust where bodies hit each other hard (boxes landing, the car slamming down)
function setUpImpactDust() {
  Events.on(engine, 'collisionStart', function (e) {
    for (var i = 0; i < e.pairs.length; i++) {
      var pair = e.pairs[i];
      var hit = impactSpeed(pair);
      // The car rolling over ground seams is not an impact; only a real landing kicks up dust
      var carOnGround = pairHas(pair, CAT.car) && pairHas(pair, CAT.ground);
      if (hit < (carOnGround ? FX.landingMinSpeed : FX.impactMinSpeed)) continue;
      var sup = pair.collision.supports && pair.collision.supports[0];
      if (!sup) continue;
      var n = Math.min(10, Math.round(hit * 1.2));
      for (var k = 0; k < n; k++) {
        var ang = rand(Math.PI, Math.PI * 2);  // Upper half circle
        var sp = rand(30, 50) * Math.min(3, hit / 3);
        spawnParticle({
          x: sup.x, y: sup.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.6,
          life: rand(400, 800),
          size: rand(3, 5), grow: rand(15, 30),
          alpha: 0.5, gravity: 20, drag: 3,
          color: '#cdb896', soft: true, layer: 'front'
        });
      }
    }
  });
}
