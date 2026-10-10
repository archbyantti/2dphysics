var { Engine, World, Bodies, Body, Constraint } = Matter;
var canvas, ctx, W, H;
var engine, world;
var boxes = [];
var walls = [];
var mousedown = false;
var lastMp = { x: 0, y: 0 };
var panOffset = { x: 0, y: 0 };
var zoom = 1.0;
var car = null;
var countEl = null;

// Motor configuration
var MOTOR = {
    wheelTorque: 3.84,
    revTorque: 1.28,
    topSpeed: 12,
    maxRevSpeed: 5,
    airDrag: 0.0006
};
var input = { accel: false, rev: false };
