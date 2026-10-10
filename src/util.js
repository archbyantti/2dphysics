// Convert screen coordinates to world coordinates
function screenToWorld(sx, sy) {
    return { x: (sx - panOffset.x) / zoom, y: (sy - panOffset.y) / zoom };
}

// Convert world coordinates to screen coordinates
function worldToScreen(wx, wy) {
    return { x: wx * zoom + panOffset.x, y: wy * zoom + panOffset.y };
}

// Calculate bounding box dimensions for a body
function bodyBounds(b) {
    if (b.vertices && b.vertices.length) {
        // Body has vertices - find min/max for bounding box
        var minx = b.vertices[0].x, maxx = b.vertices[0].x;
        var miny = b.vertices[0].y, maxy = b.vertices[0].y;
        for (var i = 1; i < b.vertices.length; i++) {
            if (b.vertices[i].x < minx) minx = b.vertices[i].x;
            if (b.vertices[i].x > maxx) maxx = b.vertices[i].x;
            if (b.vertices[i].y < miny) miny = b.vertices[i].y;
            if (b.vertices[i].y > maxy) maxy = b.vertices[i].y;
        }
        return { w: maxx - minx, h: maxy - miny };
    }
    // Circular body
    if (b.circleRadius) {
        return { w: b.circleRadius * 2, h: b.circleRadius * 2 };
    }
    // Fallback to default bounds
    return { w: b.bounds.max.x - b.bounds.min.x, h: b.bounds.max.y - b.bounds.min.y };
}
