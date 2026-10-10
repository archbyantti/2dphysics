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
    car.wheels.forEach(function (wl) {
        wl.torque = (wl.torque || 0) + tau;
        // Apply air drag resistance
        wl.torque -= MOTOR.airDrag * wl.angularVelocity * Math.abs(wl.angularVelocity);
        Body.setAngularVelocity(wl, wl.angularVelocity + wl.torque * delta);
        wl.torque = 0;  // Reset for next frame
    });
}

// Create the car with chassis and wheels
function createCar() {
    var cx = W / 2;
    var cy = H / 2 + 50;
    var w = 280, ch = 70;
    var wheelR = 40;
    var wheelY = cy + ch / 2 - wheelR * 0.2;
    var axOffset = 100;
    var wheels = [
        Bodies.circle(cx - axOffset, wheelY, wheelR, { density: 0.004, friction: 0.9 }),
        Bodies.circle(cx + axOffset, wheelY, wheelR, { density: 0.004, friction: 0.9 })
    ];
    var chassis = Bodies.rectangle(cx, cy, w, ch, { density: 0.002, friction: 0.1 });
    // Prevent wheel-wheeled collisions
    wheels[0].collisionFilter.group = -1;
    wheels[1].collisionFilter.group = -1;
    chassis.collisionFilter.group = -1;
    var joints = wheels.map(function(wl, i) {
        var attachX = (i === 0 ? -axOffset : axOffset);
        return Constraint.create({
            bodyA: chassis,
            bodyB: wl,
            pointA: { x: attachX, y: wheelY - cy },
            pointB: { x: 0, y: 0 },
            stiffness: 0.9,
            damping: 0.1
        });
    });
    World.add(world, [chassis, wheels[0], wheels[1]].concat(joints));
    car = { x: cx, y: cy, width: w, height: ch, color: '#e74c3c', visible: true, chassis: chassis, wheels: wheels, joints: joints, wheelR: wheelR, axOffset: axOffset, speed: 0 };
}

// Get car forward direction vector
function carForward() {
    return { x: Math.cos(car.chassis.angle), y: Math.sin(car.chassis.angle) };
}
