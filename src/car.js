// Car composite structure from Matter.js example
// Creates car with rounded chassis and wheel axles
function createCar() {
  var cx = W / 2;
  var cy = H / 2 + 50;
  var wheelSize = 48;
  var wheelBase = 40;
  var width = 280;
  var height = 70;
  var wheelAOffset = -width * 0.5 + wheelBase;
  var wheelBOffset = width * 0.5 - wheelBase;

  // Negative group: car parts never collide with each other
  var group = Matter.Body.nextGroup(true);
  var filter = function () {
    return { group: group, category: CAT.car, mask: CAT.box | CAT.wall };
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
    friction: 0.1
  });
  Matter.Body.setDensity(chassis, 0.0002);

  // Wheels sit below the base center
  var wheelY = cy + wheelSize;
  var wheelOpts = function () {
    return { collisionFilter: filter(), friction: 0.9, density: 0.004 };
  };
  var wheelA = Bodies.circle(cx + wheelAOffset, wheelY, wheelSize, wheelOpts());
  var wheelB = Bodies.circle(cx + wheelBOffset, wheelY, wheelSize, wheelOpts());

  // Axles (constraints) attach each wheel to the chassis. The cabin moves the chassis
  // center of mass, so anchor points are measured from the chassis position.
  var axle = function (wheel) {
    return Matter.Constraint.create({
      bodyB: chassis,
      pointB: { x: wheel.position.x - chassis.position.x, y: wheel.position.y - chassis.position.y },
      bodyA: wheel,
      stiffness: 1,
      length: 0
    });
  };
  var axleA = axle(wheelA);
  var axleB = axle(wheelB);

  World.add(world, [chassis, wheelA, wheelB, axleA, axleB]);

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
    color: '#e74c3c',
    windows: windows,
    exhaust: exhaust,
    chassis: chassis,
    wheels: [wheelA, wheelB],
    wheelR: wheelSize,
    speed: 0
  };
}

// Update car motor physics; call once per physics step
// Velocities are read with getVelocity / getAngularVelocity, which Matter.js normalizes to a
// 16.67 ms step, and every per-step effect is scaled by `k`, so the motor behaves the same for
// any step size `dt` (ms).
function updateCarMotor(dt) {
  if (!car) return;
  var k = dt / (1000 / 60);
  var fwd = carForward();
  var v = Matter.Body.getVelocity(car.chassis);
  var speed = v.x * fwd.x + v.y * fwd.y;  // Project velocity onto forward direction
  car.speed = speed;
  var tau;
  if (input.accel) {
    // Torque fades out as forward speed approaches the top speed
    tau = MOTOR.wheelTorque * Math.max(0, 1 - Math.abs(speed) / MOTOR.topSpeed);
    // Ensure forward motion on start
    if (speed < 0.05) tau += 0.00001;
  } else if (input.rev) {
    // Reverse torque fades out as reverse speed approaches its limit
    tau = -MOTOR.revTorque * Math.max(0, 1 - Math.max(0, -speed) / MOTOR.maxRevSpeed);
  } else {
    tau = 0;
  }
  car.wheels.forEach(function (wl) {
    var w = Matter.Body.getAngularVelocity(wl);
    // Brake (space) removes 10% of the wheel spin per 60 Hz step
    if (input.brake) {
      w *= Math.pow(0.90, k);
    }
    // Air drag resists wheel spin
    var t = tau - MOTOR.airDrag * w * Math.abs(w);
    Matter.Body.setAngularVelocity(wl, w + t * MOTOR.torqueScale * k);
  });
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
