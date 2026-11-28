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
  var base = car.chassis.parts[1], cabin = car.chassis.parts[2];
  // Cabin first, so the base covers the seam where they overlap
  drawCarPart(cabin);
  car.windows.forEach(drawCarWindow);
  drawCarPart(base);
  car.wheels.forEach(drawWheel);
}

// Fill and outline one part of the car body
function drawCarPart(part) {
  traceBody(part);
  ctx.fillStyle = car.color;
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Convert a point stored relative to the chassis into screen coordinates
function chassisToScreen(p) {
  var b = car.chassis, cos = Math.cos(b.angle), sin = Math.sin(b.angle);
  return worldToScreen(b.position.x + p.x * cos - p.y * sin, b.position.y + p.x * sin + p.y * cos);
}

// Draw one side window: tinted glass with a soft reflection and a dark rubber frame
function drawCarWindow(pts) {
  var s = pts.map(chassisToScreen);
  var trace = function () {
    ctx.beginPath();
    ctx.moveTo(s[0].x, s[0].y);
    for (var i = 1; i < s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.closePath();
  };
  trace();

  // Glass: lighter near the roof, darker toward the sill (from roof edge s[1] to sill s[0])
  var glass = ctx.createLinearGradient(s[1].x, s[1].y, s[0].x, s[0].y);
  glass.addColorStop(0, '#cdeef8');
  glass.addColorStop(1, '#6fa9c0');
  ctx.fillStyle = glass;
  ctx.fill();

  // Diagonal reflection streak, clipped to the glass
  ctx.save();
  ctx.clip();
  var a = chassisToScreen({ x: pts[1].x + 10, y: pts[1].y });
  var b = chassisToScreen({ x: pts[1].x - 4, y: pts[0].y });
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 7 * zoom;
  ctx.stroke();
  ctx.restore();

  trace();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = Math.max(1, 2.5 * zoom);
  ctx.lineJoin = 'round';
  ctx.stroke();
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
