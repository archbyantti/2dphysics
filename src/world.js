// Tall wall at the start line so nothing can leave the world to the left
function addStartWall() {
  var thick = 60, height = 3000;
  var wall = Bodies.rectangle(-thick / 2, -height / 2 + TERRAIN.depth, thick, height, {
    isStatic: true,
    friction: 1,
    collisionFilter: { category: CAT.ground, mask: CAT.car | CAT.box }
  });
  wall.renderColor = '#3a4358';
  walls = [wall];
  World.add(world, walls);
}

// Remove boxes that fell out of the world (e.g. their ground chunk was unloaded behind the car)
function removeLostBoxes() {
  var before = boxes.length;
  for (var i = boxes.length - 1; i >= 0; i--) {
    var b = boxes[i];
    if (b.position.y > groundHeightAt(b.position.x) + 1500) {
      World.remove(world, b);
      boxes.splice(i, 1);
    }
  }
  if (boxes.length !== before) updateCount();
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
    collisionFilter: { category: CAT.box, mask: CAT.car | CAT.box | CAT.ground }
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

// Distance the car has travelled from the start line, in meters
function carDistanceM() {
  return car ? Math.max(0, (car.chassis.position.x - START_X) / PX_PER_M) : 0;
}

// Set an element's text only when it changes (avoids DOM work every frame)
function setText(id, text) {
  var el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}

// Update the distance and gear displays
function updateDistance() {
  setText('dist', Math.round(carDistanceM()) + ' m');
  if (car) setText('gear', car.engine.gear === -1 ? 'R' : String(car.engine.gear));
}
