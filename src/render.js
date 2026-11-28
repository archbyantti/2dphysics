// Draw background grid
function drawGrid() {
  var gridSize = 50 * zoom;
  if (gridSize < 10) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  var startX = panOffset.x % gridSize, startY = panOffset.y % gridSize;
  for (var x = startX; x < W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (var y = startY; y < H; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

// Trace a body's outline (its real vertices) as a screen-space path
function traceBody(b) {
  var v = b.vertices;
  ctx.beginPath();
  var p = worldToScreen(v[0].x, v[0].y);
  ctx.moveTo(p.x, p.y);
  for (var i = 1; i < v.length; i++) {
    p = worldToScreen(v[i].x, v[i].y);
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

// Draw a box body (rectangle or polygon)
function drawBox(b) {
  traceBody(b);
  ctx.fillStyle = b.renderColor || '#aaa';
  ctx.fill();
  // Subtle top-to-bottom highlight
  var top = b.bounds.min.y * zoom + panOffset.y;
  var bottom = b.bounds.max.y * zoom + panOffset.y;
  var grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, 'rgba(255,255,255,0.1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// Draw a wall
function drawWall(b) {
  traceBody(b);
  ctx.fillStyle = b.renderColor || '#3a4358';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Draw all walls
function drawWalls() {
  for (var i = 0; i < walls.length; i++) {
    drawWall(walls[i]);
  }
}

// Draw a wheel
function drawWheel(wl) {
  var r = car.wheelR * zoom;
  var pos = worldToScreen(wl.position.x, wl.position.y);
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(wl.angle);
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Draw spoke lines
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = r * 0.08;
  for (var i = 0; i < 5; i++) {
    var a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    ctx.stroke();
  }
  // Center hub
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Draw the car (rounded chassis + wheels)
function drawCar() {
  if (!car) return;
  traceBody(car.chassis);
  ctx.fillStyle = car.color;
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.stroke();
  car.wheels.forEach(drawWheel);
}

// Draw one frame
function draw() {
  if (!isFinite(zoom) || zoom <= 0) return;
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);
  drawGrid();
  drawWalls();
  for (var i = 0; i < boxes.length; i++) {
    drawBox(boxes[i]);
  }
  drawCar();
}
