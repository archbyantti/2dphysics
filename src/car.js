// Car composite structure from Matter.js example
// Creates car with rounded chassis and wheel axles, wheels resting on the ground at world x
function createCar(x) {
  var wheelSize = 48;
  var cx = x;
  // Wheel bottoms just above the highest ground under the car (works on a slope too)
  var top = Infinity;
  for (var sx = -160; sx <= 160; sx += 20) top = Math.min(top, groundHeightAt(x + sx));
  var cy = top - wheelSize * 2 - 6;
  var wheelBase = 40;
  var width = 280;
  var height = 70;
  var wheelAOffset = -width * 0.5 + wheelBase;
  var wheelBOffset = width * 0.5 - wheelBase;

  // Negative group: car parts never collide with each other
  var group = Matter.Body.nextGroup(true);
  var filter = function () {
    return { group: group, category: CAT.car, mask: CAT.box | CAT.ground };
  };

  // Lower body with rounded ends (chamfer)
  var base = Bodies.rectangle(cx, cy, width, height, {
    chamfer: { radius: height * 0.5 }
  });

  // Cabin on top (forward is +x): raked windshield, steeper rear, rounded roof corners.
  // Outline is relative to the base center; the bottom edge sinks 10 px into the base.
  var cabinShape = Matter.Vertices.chamfer([
    { x: -95, y: -25 },  // Rear bottom
    { x: -80, y: -80 },  // Rear roof
    { x: 30, y: -80 },   // Front roof
    { x: 75, y: -25 }    // Front bottom
  ], [0, 12, 16, 0]);
  var cabinCentre = Matter.Vertices.centre(cabinShape);
  var cabin = Bodies.fromVertices(cx + cabinCentre.x, cy + cabinCentre.y, [cabinShape]);

  // Chassis is one rigid compound body: parts[0] is the hull, then base and cabin
  var chassis = Matter.Body.create({
    parts: [base, cabin],
    collisionFilter: filter(),
    friction: 0.1,
    frictionAir: MOTOR.bodyAirFriction
  });
  Matter.Body.setDensity(chassis, SUSPENSION.chassisDensity);

  // Wheels sit below the base center
  var wheelY = cy + wheelSize;
  var wheelOpts = function () {
    return { collisionFilter: filter(), friction: 0.9, density: SUSPENSION.wheelDensity, frictionAir: MOTOR.bodyAirFriction };
  };
  var wheelA = Bodies.circle(cx + wheelAOffset, wheelY, wheelSize, wheelOpts());
  var wheelB = Bodies.circle(cx + wheelBOffset, wheelY, wheelSize, wheelOpts());
  wheelA.freeInertia = wheelA.inertia;  // Restored when the brake releases a held wheel
  wheelB.freeInertia = wheelB.inertia;

  // Suspension (invisible). Each wheel hangs on a rigid trailing arm, pivoted on the chassis toward
  // the car's middle, so it can only swing up and down, not move fore and aft. A spring-damper from a
  // point above the wheel carries the weight. Anchor points are measured from the chassis position
  // (its center of mass, which the cabin moves) while the car is still level.
  var rel0 = function (wheel, dx, dy) {
    return { x: wheel.position.x - chassis.position.x + dx, y: wheel.position.y - chassis.position.y + dy };
  };
  var suspension = function (wheel, armDir) {
    var arm = Matter.Constraint.create({
      bodyA: wheel,
      bodyB: chassis,
      pointB: rel0(wheel, armDir * SUSPENSION.armLength, 0),
      length: SUSPENSION.armLength,
      stiffness: 1,
      damping: 0
    });
    var spring = Matter.Constraint.create({
      bodyA: wheel,
      bodyB: chassis,
      pointB: rel0(wheel, 0, -SUSPENSION.springLength),
      // Preload: a spring longer than the gap pushes the body up against its own weight to ride height
      length: SUSPENSION.springLength + SUSPENSION.preload,
      stiffness: SUSPENSION.stiffness,
      damping: 0  // Damping is done by updateDampers (Matter.js constraint damping is too weak)
    });
    return [arm, spring];
  };
  var suspA = suspension(wheelA, 1);   // Rear wheel: arm points forward
  var suspB = suspension(wheelB, -1);  // Front wheel: arm points back

  // Motor and brake work in units of the original heavy wheel; scale by actual wheel inertia so
  // the drive force at the road stays the same when the wheel mass changes
  var refInertia = Bodies.circle(0, 0, wheelSize, { density: 0.004 }).inertia;
  var torqueGain = refInertia / wheelA.inertia;

  World.add(world, [chassis, wheelA, wheelB].concat(suspA, suspB));

  // Side windows follow the cabin slopes; stored relative to the chassis position so the
  // renderer can rotate them with the body. They are decoration only, not physics.
  var rel = function (pts) {
    return pts.map(function (p) {
      return { x: cx + p.x - chassis.position.x, y: cy + p.y - chassis.position.y };
    });
  };
  var windows = [
    rel([{ x: -84, y: -39 }, { x: -75, y: -68 }, { x: -24, y: -68 }, { x: -24, y: -39 }]),  // Rear
    rel([{ x: -15, y: -39 }, { x: -15, y: -68 }, { x: 24, y: -68 }, { x: 50, y: -39 }])     // Front
  ];

  // Exhaust pipe outlet at the lower rear of the body (smoke comes out here)
  var exhaust = rel([{ x: -130, y: 8 }])[0];

  car = {
    all: [chassis, wheelA, wheelB].concat(suspA, suspB),  // Everything added to the world (bodies first)
    torqueGain: torqueGain,
    springs: [suspA[1], suspB[1]],  // Spring constraints; updateDampers works along them
    color: '#e74c3c',
    windows: windows,
    exhaust: exhaust,
    chassis: chassis,
    wheels: [wheelA, wheelB],
    wheelR: wheelSize,
    speed: 0,
    // Engine and gearbox state. gear: 1..4 forward, -1 reverse. shiftMs counts down a gear change.
    engine: { gear: 1, rpm: MOTOR.idleRpm, shiftMs: 0, throttle: false }
  };
}

// Engine torque factor (0..1) at a given rpm: modest at idle, strongest mid-range, fading near the redline
function torqueCurve(rpm) {
  var t = (rpm - MOTOR.idleRpm) / (MOTOR.redline - MOTOR.idleRpm);
  t = Math.max(0, Math.min(1, t));
  return 0.6 + 0.4 * Math.sin(Math.PI * t);
}

// Engine rpm for a tyre surface speed (px per 60 Hz step) in gear g
function rpmFor(rim, g) {
  var top = g === -1 ? MOTOR.reverse.top : MOTOR.gears[g - 1].top;
  return Math.abs(rim) / top * MOTOR.redline;
}

// Update car motor physics; call once per physics step.
// The engine turns the wheels through a 4+R gearbox: rpm follows the wheel speed in the current gear,
// torque at the wheels is the engine's torque curve times the gear's ratio, and an automatic gearbox
// shifts up near the redline and down when the rpm falls. While shifting there is no drive.
// Velocities are read with getVelocity / getAngularVelocity, which Matter.js normalizes to a
// 16.67 ms step, and every per-step effect is scaled by `k`, so the motor behaves the same for
// any step size `dt` (ms).
function updateCarMotor(dt) {
  if (!car) return;
  var k = dt / (1000 / 60);
  var eng = car.engine;
  var fwd = carForward();
  var v = Matter.Body.getVelocity(car.chassis);
  var speed = v.x * fwd.x + v.y * fwd.y;  // Project velocity onto forward direction
  car.speed = speed;
  // Tyre surface speed (average of both wheels), px per 60 Hz step; positive = forward
  var rim = 0;
  car.wheels.forEach(function (wl) { rim += Matter.Body.getAngularVelocity(wl) * car.wheelR / 2; });

  // Direction: up drives forward; down brakes while rolling forward, then engages reverse
  var brake = input.brake;
  var drive = 0;
  if (input.accel) {
    if (eng.gear === -1) eng.gear = 1;
    drive = 1;
  } else if (input.rev) {
    if (eng.gear !== -1 && speed > 0.6) {
      brake = true;
    } else {
      eng.gear = -1;
      drive = -1;
    }
  }
  eng.throttle = drive !== 0;

  // Automatic gearbox (forward gears only)
  var rpm = rpmFor(rim, eng.gear);
  if (eng.shiftMs > 0) {
    eng.shiftMs -= dt;
  } else if (eng.gear > 0) {
    if (eng.gear < MOTOR.gears.length && rpm > MOTOR.upshiftRpm && drive > 0) {
      eng.gear++;
      eng.shiftMs = MOTOR.shiftMs;
    } else if (eng.gear > 1 && rpm < MOTOR.downshiftRpm) {
      eng.gear--;
    }
    rpm = rpmFor(rim, eng.gear);
  }
  // Clutch slip: on throttle from low speed the engine runs above the wheel-driven rpm
  var floor = eng.throttle ? MOTOR.launchRpm : MOTOR.idleRpm;
  var target = Math.max(floor, rpm);
  eng.rpm += (target - eng.rpm) * Math.min(1, 0.3 * k);

  var tau = 0;
  var gear = eng.gear === -1 ? MOTOR.reverse : MOTOR.gears[eng.gear - 1];
  if (drive !== 0 && eng.shiftMs <= 0 && rpm < MOTOR.redline) {
    tau = drive * gear.torque * torqueCurve(eng.rpm);
  } else if (drive === 0) {
    tau = -rim * MOTOR.engineBrake;  // Engine braking when off the throttle
  }
  var brakeStep = MOTOR.brakeDecel / car.wheelR * k * car.torqueGain;  // Spin the brake can remove this step
  car.wheels.forEach(function (wl) {
    var w = Matter.Body.getAngularVelocity(wl);
    if (brake) {
      // A brake is friction: it removes spin at a steady rate whichever way the wheel turns, and once
      // the wheel has (almost) stopped it holds it. A held wheel gets infinite inertia, so only tyre
      // grip can move the car; on these slopes grip wins and the car stays put, also rolling backward.
      if (Math.abs(w) <= brakeStep) {
        lockWheel(wl, true);
        return;
      }
      w -= (w > 0 ? 1 : -1) * brakeStep;
    } else {
      lockWheel(wl, false);
    }
    // Air drag resists wheel spin
    var t = tau - MOTOR.airDrag * w * Math.abs(w);
    Matter.Body.setAngularVelocity(wl, w + t * MOTOR.torqueScale * k * car.torqueGain);
  });
}

// Shock absorbers: along each spring, a force against the speed at which the spring compresses or
// extends, applied equally and oppositely to the wheel and to the body at the spring's top mount (so it
// also damps the body's pitch). Call once per physics step, before Engine.update; `dt` is the step (ms).
function updateDampers(dt) {
  if (!car) return;
  var ch = car.chassis;
  var v = Matter.Body.getVelocity(ch), av = Matter.Body.getAngularVelocity(ch);
  car.springs.forEach(function (sp) {
    var wl = sp.bodyA;
    var top = Matter.Constraint.pointBWorld(sp);
    var dx = wl.position.x - top.x, dy = wl.position.y - top.y;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dx / len, ny = dy / len;
    // Velocity of the top mount: body velocity plus rotation about the body's center of mass
    var rx = top.x - ch.position.x, ry = top.y - ch.position.y;
    var mvx = v.x - av * ry, mvy = v.y + av * rx;
    var wv = Matter.Body.getVelocity(wl);
    var rel = (wv.x - mvx) * nx + (wv.y - mvy) * ny;  // > 0: spring extending
    // Force so the damping per unit of time does not depend on the step length
    var f = -SUSPENSION.damping * rel * (1000 / 60) / dt;
    Matter.Body.applyForce(wl, wl.position, { x: f * nx, y: f * ny });
    Matter.Body.applyForce(ch, top, { x: -f * nx, y: -f * ny });
  });
}

// Hold (or release) a wheel so it cannot turn
function lockWheel(wl, on) {
  if (on) {
    if (!wl.brakeLocked) {
      wl.brakeLocked = true;
      Matter.Body.setInertia(wl, Infinity);
    }
    Matter.Body.setAngularVelocity(wl, 0);
  } else if (wl.brakeLocked) {
    wl.brakeLocked = false;
    Matter.Body.setInertia(wl, wl.freeInertia);
  }
}

// Put the car back on its wheels at its current x (R key)
function resetCar() {
  if (!car) return;
  var x = Math.max(START_X, car.chassis.position.x);
  World.remove(world, car.all);
  updateTerrain(x);
  createCar(x);
}

// Convert a point stored relative to the chassis into world coordinates
function chassisToWorld(p) {
  var b = car.chassis, cos = Math.cos(b.angle), sin = Math.sin(b.angle);
  return { x: b.position.x + p.x * cos - p.y * sin, y: b.position.y + p.x * sin + p.y * cos };
}

// Get car forward direction vector
function carForward() {
  return { x: Math.cos(car.chassis.angle), y: Math.sin(car.chassis.angle) };
}
