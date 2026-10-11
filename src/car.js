// Car composite structure from Matter.js example
// Creates car with rounded chassis and wheel axles
function createCar() {
    var cx = W / 2;
    var cy = H / 2 + 50;
    var wheelSize = 40;
    var wheelBase = 40;
    var width = 280;
    var height = 70;
    var wheelAOffset = -width * 0.5 + wheelBase;
    var wheelBOffset = width * 0.5 - wheelBase;

    // Create car composite group for collision isolation
    var group = Matter.Body.nextGroup(true);

    // Create chassis with rounded corners (chamfer)
    // Position above wheels so wheels are underneath
    var chassis = Matter.Bodies.rectangle(cx, cy, width, height, {
        collisionFilter: { group: group },
        chamfer: { radius: height * 0.5 },
        density: 0.0002,
        friction: 0.1
    });
    chassis.collisionFilter.category = 1;
    chassis.collisionFilter.mask = 2 | 4;

    // Position wheels below chassis
    var wheelY = cy + wheelSize;  // wheels wheelSize below chassis center
    var wheelA = Matter.Bodies.circle(cx + wheelAOffset, wheelY, wheelSize, {
        collisionFilter: { group: group },
        friction: 0.9,
        density: 0.004
    });
    var wheelB = Matter.Bodies.circle(cx + wheelBOffset, wheelY, wheelSize, {
        collisionFilter: { group: group },
        friction: 0.9,
        density: 0.004
    });

    wheelA.collisionFilter.category = 1;
    wheelB.collisionFilter.category = 1;
    wheelA.collisionFilter.mask = 2 | 4;
    wheelB.collisionFilter.mask = 2 | 4;

    // Create axles (constraints) - attach to chassis at wheel positions
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

    // Add car parts to world
    World.add(world, [chassis, wheelA, wheelB, axleA, axleB]);

    car = {
        x: cx,
        y: cy,
        width: width,
        height: height,
        color: '#e74c3c',
        visible: true,
        chassis: chassis,
        wheels: [wheelA, wheelB],
        joints: [axleA, axleB],
        wheelR: wheelSize,
        axOffset: wheelBase,
        speed: 0
    };
}

// Update car motor physics each frame
function updateCarMotor() {
    if (!car) return;
    var fwd = carForward();
    var vx = car.chassis.velocity.x, vy = car.chassis.velocity.y;
    var speed = vx * fwd.x + vy * fwd.y;  // Project velocity onto forward direction
    car.speed = speed;
    var tau;
    if (input.accel) {
        // Torque decreases as speed increases (engine braking effect)
        tau = MOTOR.wheelTorque * Math.max(0, 1 - Math.abs(speed) / MOTOR.topSpeed);
        // Ensure forward motion on start
        if (speed < 0.05) tau += 0.00001;
    } else if (input.rev) {
        // Reverse torque when pressing down arrow
        tau = -MOTOR.revTorque;
    } else {
        tau = 0;
    }
    var delta = 0.01;  // Time step adjustment for stable physics
    car.wheels.forEach(function(wl) {
        wl.torque = (wl.torque || 0) + tau;
        // Apply air drag resistance
        wl.torque -= MOTOR.airDrag * wl.angularVelocity * Math.abs(wl.angularVelocity);
        Matter.Body.setAngularVelocity(wl, wl.angularVelocity + wl.torque * delta);
        wl.torque = 0;  // Reset for next frame
    });
}

// Get car forward direction vector
function carForward() {
    return { x: Math.cos(car.chassis.angle), y: Math.sin(car.chassis.angle) };
}
