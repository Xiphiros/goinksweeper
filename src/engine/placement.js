import { CELL_SIZE } from '../core/constants.js';

export class PlacementEngine {
  static findPosition(widthCells, heightCells, existingNodes) {
    const PADDING = 20; // px between nodes
    const VIEWPORT_WIDTH = 1800; // Constrain width to force wrapping
    
    const wPx = widthCells * CELL_SIZE;
    const hPx = heightCells * CELL_SIZE;
    
    // Defines the search grid resolution (snap to grid)
    const STEP = 20; 

    // Naive scanning: Check positions left-to-right, top-to-bottom
    // A Skyline algorithm would be O(N log N), this is O(N * Pos) but sufficient for <100 nodes.
    
    let bestY = 0;
    let bestX = 100; // Start with some margin

    // Limit search space to reasonable bounds
    // We scan in "rows"
    for (let y = 100; y < 10000; y += STEP) {
      for (let x = 100; x < VIEWPORT_WIDTH; x += STEP) {
        
        // Check if candidate rect (x, y, wPx, hPx) intersects any existing node
        const candidate = {
          left: x,
          top: y,
          right: x + wPx + PADDING,
          bottom: y + hPx + PADDING
        };

        let collision = false;
        for (const node of existingNodes) {
          const nodeW = node.w * CELL_SIZE;
          const nodeH = node.h * CELL_SIZE;
          const existing = {
            left: node.x - PADDING,
            top: node.y - PADDING,
            right: node.x + nodeW + PADDING,
            bottom: node.y + nodeH + PADDING
          };

          if (this.intersects(candidate, existing)) {
            collision = true;
            break;
          }
        }

        if (!collision) {
          return { x, y };
        }
      }
    }
    
    // Fallback if packed (should rarely happen with infinite scroll)
    return { x: 100, y: existingNodes.length * 200 };
  }

  static intersects(r1, r2) {
    return !(r2.left >= r1.right || 
             r2.right <= r1.left || 
             r2.top >= r1.bottom || 
             r2.bottom <= r1.top);
  }
}