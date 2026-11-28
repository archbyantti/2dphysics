// Matter.js imports
var { Engine, World, Bodies, Events } = Matter;

// Canvas and engine refs
var canvas, ctx, W, H;
var engine, world;

// Dynamic objects
var boxes = [];      // Spawned boxes
var walls = [];      // Static boundary walls
var mousedown = false;
var lastMp = { x: 0, y: 0 };  // Last mouse position for panning
var panOffset = { x: 0, y: 0 };  // Camera offset for panning
var zoom = 1.0;      // Camera zoom level
var car = null;      // Car object (null when not created)
var countEl = null;  // DOM element for box counter

// Collision filter categories (bit flags)
var CAT = {
  car: 1,
  box: 2,
  wall: 4
};

// Fixed physics time step in milliseconds
var STEP_MS = 1000 / 60;

// Motor configuration for the car
var MOTOR = {
  wheelTorque: 3.84,   // Forward acceleration torque
  revTorque: 1.28,     // Reverse torque when pressing down arrow
  topSpeed: 12,        // Maximum forward speed
  maxRevSpeed: 5,      // Maximum reverse speed
  airDrag: 0.0006,     // Air resistance coefficient
  torqueScale: 0.01    // Converts torque into angular velocity change per step
};

// Car input state
var input = { accel: false, rev: false, brake: false };
// Camera centering state
var centerCar = false;  // true = camera follows car, false = manual panning
