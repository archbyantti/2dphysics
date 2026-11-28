// Create boundary walls around the current window size
function addWalls() {
  var thick = 40;
  var opts = function () {
    return { isStatic: true, friction: 1, collisionFilter: { category: CAT.wall, mask: CAT.car | CAT.box } };
  };
  var ground = Bodies.rectangle(W / 2, H + thick / 2, W + 2 * thick, thick, opts());
  var leftWall = Bodies.rectangle(-thick / 2, 0, thick, H * 2, opts());
  var rightWall = Bodies.rectangle(W + thick / 2, 0, thick, H * 2, opts());
  walls = [ground, leftWall, rightWall];
  walls.forEach(function (wl) { wl.renderColor = '#3a4358'; });
  World.add(world, walls);
}

// Rebuild the walls after the window size changes
function resizeWalls() {
  World.remove(world, walls);
  addWalls();
}

// Remove the topmost box under a screen position (Shift+click)
function removeBoxAt(sx, sy) {
  var p = screenToWorld(sx, sy);
  for (var i = boxes.length - 1; i >= 0; i--) {
    if (Matter.Vertices.contains(boxes[i].vertices, p)) {
      World.remove(world, boxes[i]);
      boxes.splice(i, 1);
      updateCount();
      break;
    }
  }
}

// Spawn a random box at position
function addBox(wx, wy) {
  var s = 30 + Math.random() * 40;
  var colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
  var options = {
    restitution: 0.3,
    friction: 0.95,
    density: 0.0012,
    chamfer: { radius: 4 },
    slop: 0.01,
    collisionFilter: { category: CAT.box, mask: CAT.car | CAT.box | CAT.wall }
  };
  var b;
  // Randomly choose between rectangle or polygon shape
  if (Math.random() > 0.5) {
    b = Bodies.rectangle(wx, wy, s, s * (0.6 + Math.random() * 0.8), options);
  } else {
    var sides = Math.floor(3 + Math.random() * 4);
    b = Bodies.polygon(wx, wy, sides, s / 2, options);
  }
  b.renderColor = colors[Math.floor(Math.random() * colors.length)];
  World.add(world, b);
  boxes.push(b);
  updateCount();
}

// Update box counter display
function updateCount() {
  if (countEl) {
    countEl.textContent = 'Boxes: ' + boxes.length;
  }
}
