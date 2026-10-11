// Set up canvas event listeners
function setUpCanvas() {
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('keyup', handleKeyUp);
}

// Handle window resize
function handleResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
}

// Handle mouse press
function handleMouseDown(e) {
    mousedown = true;
    lastMp = { x: e.clientX, y: e.clientY };
    // Shift+click removes box at position
    if (e.shiftKey) {
        removeBoxAt(e.clientX, e.clientY);
        return;
    }
    // Ignore middle and right buttons for spawning
    if (e.button === 1 || e.button === 2) {
        return;
    }
}

// Handle mouse release - spawn box
function handleMouseUp(e) {
    mousedown = false;
    // Left click without modifiers spawns a box
    if (e.button === 0 && !(e.ctrlKey || e.shiftKey)) {
        var worldPos = screenToWorld(e.clientX, e.clientY);
        addBox(worldPos.x, worldPos.y);
    }
}

// Handle mouse drag for panning
function handleMouseMove(e) {
    if (!mousedown) return;
    var dx = e.clientX - lastMp.x, dy = e.clientY - lastMp.y;
    if (dx !== 0 || dy !== 0) {
        panOffset.x += dx;
        panOffset.y += dy;
    }
    lastMp = { x: e.clientX, y: e.clientY };
}

// Handle keyboard input for car controls
function handleKeyDown(e) {
    switch (e.code) {
        case 'ArrowUp': input.accel = true; break;
        case 'ArrowDown': input.rev = true; break;
    }
}

function handleKeyUp(e) {
    switch (e.code) {
        case 'ArrowUp': input.accel = false; break;
        case 'ArrowDown': input.rev = false; break;
        case 'Space':
        case 'KeyC': toggleCarCentering(); break;
    }
}

// Toggle car centering on/off
function toggleCarCentering() {
    centerCar = !centerCar;
    var info = document.getElementById('info');
    var status = centerCar ? ' (centering ON)' : ' (centering OFF)';
    info.textContent = 'Left mouse: create box | Shift+click: remove box | Drag center: pan view | Ctrl+scroll: zoom | Space/C: toggle car centering' + status;
}

// Handle mouse wheel for zoom (Ctrl or Cmd + scroll)
function handleWheel(e) {
    e.preventDefault();
    if (!(e.ctrlKey || e.metaKey)) return;
    var zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    var mouseWorldX = (e.clientX - panOffset.x) / zoom;
    var mouseWorldY = (e.clientY - panOffset.y) / zoom;
    zoom *= zoomFactor;
    zoom = Math.max(0.1, Math.min(5, zoom));
    if (!centerCar) {
        panOffset.x = e.clientX - mouseWorldX * zoom;
        panOffset.y = e.clientY - mouseWorldY * zoom;
    }
}

// Update camera position to follow car if centered
function updateCameraPosition() {
    if (!car) return;
    if (centerCar) {
        // Calculate offset to center car in screen
        panOffset.x = W / 2 - car.chassis.position.x * zoom;
        panOffset.y = H / 2 - car.chassis.position.y * zoom;
    }
}
