// Matter.js imports
var { Engine, World, Bodies, Events } = Matter;

// Canvas and engine refs
var canvas, W, H;
var engine, world;

// Dynamic objects
var boxes = [];      // Spawned boxes
var walls = [];      // Static walls (the start wall); the ground lives in terrain.js
var mousedown = false;
var lastMp = { x: 0, y: 0 };  // Last mouse position for panning
var panOffset = { x: 0, y: 0 };  // Camera offset for panning
var zoom = 0.8;      // Camera zoom level
var car = null;      // Car object (null when not created)
var countEl = null;  // DOM element for box counter

// Collision filter categories (bit flags)
var CAT = {
  car: 1,
  box: 2,
  ground: 4   // Static world: terrain and the start wall
};

// World scale: the 280 px car is about 4.7 m long
var PX_PER_M = 60;
// The car starts here; distance is measured from this x
var START_X = 400;

// Simulation speed relative to real time, and the largest physics substep (ms).
// 1.6 keeps the feel the sim was originally tuned with (one 60 Hz step per frame on a 100 Hz display).
var SIM_SPEED = 1.6;
var MAX_STEP_MS = 1000 / 60;

// Engine and gearbox. Speeds are tyre surface speeds in px per 60 Hz step (24 px/step is ~24 m/s
// of sim time). `top` is the speed at the redline in that gear; `torque` is the wheel torque at the
// torque peak (lower gears multiply the engine torque more).
var MOTOR = {
  gears: [
    { top: 7, torque: 0.7 },
    { top: 12.5, torque: 0.45 },
    { top: 18.5, torque: 0.33 },
    { top: 25, torque: 0.27 }
  ],
  reverse: { top: 6, torque: 0.5 },
  idleRpm: 850,
  launchRpm: 2200,      // Engine speed while the clutch slips pulling away
  redline: 6000,        // Rev limiter: no drive above this
  upshiftRpm: 5600,
  downshiftRpm: 2300,
  shiftMs: 220,         // Drive is cut for this long (sim time) during an upshift
  engineBrake: 0.004,   // Slows the wheels when off the throttle
  airDrag: 0.0006,      // Air resistance on wheel spin
  bodyAirFriction: 0.0015, // Matter.js frictionAir for the car (default 0.01 would cap the speed near 11)
  torqueScale: 0.01     // Converts torque into angular velocity change per step
};

// Car input state
var input = { accel: false, rev: false, brake: false };
// Camera centering state
var centerCar = true;   // true = camera follows car, false = manual panning
