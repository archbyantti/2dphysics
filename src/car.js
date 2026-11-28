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

  // Chassis with rounded corners (chamfer)
  var chassis = Bodies.rectangle(cx, cy, width, height, {
    collisionFilter: filter(),
    chamfer: { radius: height * 0.5 },
    density: 0.0002,
    friction: 0.1
  });

  // Wheels sit below the chassis center
  var wheelY = cy + wheelSize;
  var wheelOpts = function () {
    return { collisionFilter: filter(), friction: 0.9, density: 0.004 };
  };
  var wheelA = Bodies.circle(cx + wheelAOffset, wheelY, wheelSize, wheelOpts());
  var wheelB = Bodies.circle(cx + wheelBOffset, wheelY, wheelSize, wheelOpts());

  // Axles (constraints) attach each wheel to the chassis
  var axleA = Matter.Constraint.create({
    bodyB: chassis,
    pointB: { x: wheelAOffset, y: wheelSize },
    bodyA: wheelA,
    stiffness: 1,
    length: 0
  });
  var axleB = Matter.Constraint.create({
    bodyB: chassis,
    pointB: { x: wheelBOffset, y: wheelSize },
    bodyA: wheelB,
    stiffness: 1,
    length: 0
  });

  World.add(world, [chassis, wheelA, wheelB, axleA, axleB]);

  car = {
    color: '#e74c3c',
    chassis: chassis,
    wheels: [wheelA, wheelB],
    wheelR: wheelSize,
    speed: 0
  };
}

// Update car motor physics; call once per physics step
function updateCarMotor() {
  if (!car) return;
  var fwd = carForward();
  var vx = car.chassis.velocity.x, vy = car.chassis.velocity.y;
  var speed = vx * fwd.x + vy * fwd.y;  // Project velocity onto forward direction
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
    // Apply brake when space is pressed
    if (input.brake) {
      Matter.Body.setAngularVelocity(wl, wl.angularVelocity * 0.90);
    }
    // Air drag resists wheel spin
    var t = tau - MOTOR.airDrag * wl.angularVelocity * Math.abs(wl.angularVelocity);
    Matter.Body.setAngularVelocity(wl, wl.angularVelocity + t * MOTOR.torqueScale);
  });
}

// Get car forward direction vector
function carForward() {
  return { x: Math.cos(car.chassis.angle), y: Math.sin(car.chassis.angle) };
}
