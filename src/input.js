function setUpCanvas() {
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('keyup', handleKeyUp);
}

function handleResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
}

function handleMouseDown(e) {
    mousedown = true;
    lastMp = { x: e.clientX, y: e.clientY };
    if (e.shiftKey) {
        removeBoxAt(e.clientX, e.clientY);
        return;
    }
    if (e.button === 1 || e.button === 2) {
        return;
    }
}

function handleMouseUp(e) {
    mousedown = false;
    if (e.button === 0 && !(e.ctrlKey || e.shiftKey)) {
        var worldPos = screenToWorld(e.clientX, e.clientY);
        addBox(worldPos.x, worldPos.y);
    }
}

function handleMouseMove(e) {
    if (!mousedown) return;
    var dx = e.clientX - lastMp.x, dy = e.clientY - lastMp.y;
    if (dx !== 0 || dy !== 0) {
        panOffset.x += dx;
        panOffset.y += dy;
    }
    lastMp = { x: e.clientX, y: e.clientY };
}
function handleKeyDown(e){
    switch(e.code){
        case 'ArrowUp': input.accel = true; break;
        case 'ArrowDown': input.rev = true; break;
    }
}
function handleKeyUp(e){
    switch(e.code){
        case 'ArrowUp': input.accel = false; break;
        case 'ArrowDown': input.rev = false; break;
    }
}

function handleWheel(e) {
    e.preventDefault();
    if (!(e.ctrlKey || e.metaKey)) return;
    var zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    var mouseWorldX = (e.clientX - panOffset.x) / zoom;
    var mouseWorldY = (e.clientY - panOffset.y) / zoom;
    zoom *= zoomFactor;
    zoom = Math.max(0.1, Math.min(5, zoom));
    panOffset.x = e.clientX - mouseWorldX * zoom;
    panOffset.y = e.clientY - mouseWorldY * zoom;
}
