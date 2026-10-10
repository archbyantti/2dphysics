function screenToWorld(sx, sy) { return {x:(sx - panOffset.x)/zoom, y:(sy - panOffset.y)/zoom}; }
function worldToScreen(wx, wy){return {x: wx*zoom + panOffset.x, y: wy*zoom + panOffset.y};}

function bodyBounds(b) {
    if (b.vertices && b.vertices.length) {
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
    if (b.circleRadius) {
        return { w: b.circleRadius * 2, h: b.circleRadius * 2 };
    }
    return { w: b.bounds.max.x - b.bounds.min.x, h: b.bounds.max.y - b.bounds.min.y };
}
