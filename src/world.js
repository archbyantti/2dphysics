// Create boundary walls around the world
function addWalls() {
    var thick = 40;
    var ground = Bodies.rectangle(W / 2, H + thick / 2, W + 2 * thick, thick, { isStatic: true, friction: 1, collisionFilter: { category: 4, mask: 1 | 2 } });
    var leftWall = Bodies.rectangle(-thick / 2, 0, thick, H * 2, { isStatic: true, friction: 1, collisionFilter: { category: 4, mask: 1 | 2 } });
    var rightWall = Bodies.rectangle(W + thick / 2, 0, thick, H * 2, { isStatic: true, friction: 1, collisionFilter: { category: 4, mask: 1 | 2 } });
    walls = [ground, leftWall, rightWall];
    walls.forEach(function (wl) { wl.renderColor = '#3a4358'; });
    World.add(world, walls);
}

// Remove box at clicked position (Shift+click)
function removeBoxAt(sx, sy) {
    var worldPos = screenToWorld(sx, sy);
    for (var i = boxes.length - 1; i >= 0; i--) {
        var b = boxes[i];
        var pos = b.position;
        var bounds = bodyBounds(b);
        // Check if clicked within box bounds
        if (worldPos.x >= pos.x - bounds.w / 2 && worldPos.x <= pos.x + bounds.w / 2 &&
            worldPos.y >= pos.y - bounds.h / 2 && worldPos.y <= pos.y + bounds.h / 2) {
            World.remove(world, b);
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
    var color = colors[Math.floor(Math.random() * colors.length)];
    var options = { restitution: 0.3, friction: 0.95, density: 0.0012, chamfer: { radius: 4 }, slop: 0.01, isSensor: false, collisionFilter: { category: 2, mask: 1 | 4 } };
    var b;
    // Randomly choose between rectangle or polygon shape
    if (Math.random() > 0.5) {
        var width = s;
        var height = s * (0.6 + Math.random() * 0.8);
        b = Bodies.rectangle(wx, wy, width, height, options);
    } else {
        var sides = Math.floor(3 + Math.random() * 4);
        var radius = s / 2;
        b = Bodies.polygon(wx, wy, sides, radius, options);
    }
    // Cache original dimensions for rendering
    var bounds = bodyBounds(b);
    b._originalWidth = bounds.w;
    b._originalHeight = bounds.h;
    b.renderColor = color;
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
