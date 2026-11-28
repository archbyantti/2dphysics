// Convert screen coordinates to world coordinates
function screenToWorld(sx, sy) {
  return { x: (sx - panOffset.x) / zoom, y: (sy - panOffset.y) / zoom };
}

// Convert world coordinates to screen coordinates
function worldToScreen(wx, wy) {
  return { x: wx * zoom + panOffset.x, y: wy * zoom + panOffset.y };
}
