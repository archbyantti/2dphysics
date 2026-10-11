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

// Draw a box body
function drawBox(b) {
    var pos = worldToScreen(b.position.x, b.position.y);
    var color = b.renderColor || '#aaa';
    var w = b._originalWidth, h = b._originalHeight;
    if (w === undefined || h === undefined) {
        var bounds = bodyBounds(b);
        w = bounds.w;
        h = bounds.h;
        b._originalWidth = w;
        b._originalHeight = h;
    }
    var scaledW = w * zoom, scaledH = h * zoom;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = color;
    ctx.fillRect(-scaledW / 2, -scaledH / 2, scaledW, scaledH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(-scaledW / 2, -scaledH / 2, scaledW, scaledH);
    // Add gradient shading
    if (scaledH > 0 && !isNaN(scaledH) && !isFinite(scaledH) === false) {
        var grad = ctx.createLinearGradient(0, -scaledH / 2, 0, scaledH / 2);
        grad.addColorStop(0, 'rgba(255,255,255,0.1)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-scaledW / 2, -scaledH / 2, scaledW, scaledH);
    }
    ctx.restore();
}

// Draw a wall
function drawWall(b) {
    var pos = worldToScreen(b.position.x, b.position.y);
    var w = b.bounds.max.x - b.bounds.min.x;
    var h = b.bounds.max.y - b.bounds.min.y;
    var sw = w * zoom, sh = h * zoom;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.renderColor || '#3a4358';
    ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
    ctx.restore();
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
    ctx.lineWidth = Math.max(1.5 / zoom, 1);
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

// Draw the car (chassis + wheels)
function drawCar() {
    if (!car) return;
    var pos = worldToScreen(car.chassis.position.x, car.chassis.position.y);
    var angle = car.chassis.angle;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.fillStyle = car.color;
    ctx.fillRect(-car.width * zoom / 2, -car.height * zoom / 2, car.width * zoom, car.height * zoom);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(-car.width * zoom / 2, -car.height * zoom / 2, car.width * zoom, car.height * zoom);
    ctx.restore();
    car.wheels.forEach(drawWheel);
}

// Main render loop
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
    updateCameraPosition();
}
