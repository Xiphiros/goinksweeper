import { CELL_SIZE } from '../core/constants.js';

/**
 * PlacementEngine now uses a Shelf Packing algorithm to create a 
 * clean, square-like grid of playfields.
 */
export class PlacementEngine {
  /**
   * Finds a position for a single new node.
   * For single additions, we find the first available gap in a virtual grid.
   */
  static findPosition(widthCells, heightCells, existingNodes) {
    const PADDING = 40;
    const wPx = widthCells * CELL_SIZE;
    const hPx = heightCells * CELL_SIZE + 24;

    if (existingNodes.length === 0) return { x: 0, y: 0 };

    // To add a single node without a full rearrange, we look for the 
    // bottom-most, left-most empty space.
    let maxY = -Infinity;
    existingNodes.forEach(n => maxY = Math.max(maxY, n.y + (n.h * CELL_SIZE + 24)));

    // Simplest addition: place at the bottom left of the current cluster
    return { x: 0, y: maxY + PADDING };
  }

  /**
   * Performs a full shelf-packing calculation for a set of nodes.
   * Aims for a square aspect ratio.
   */
  static packNodes(nodes) {
    const PADDING = 40;
    const sorted = [...nodes].sort((a, b) => {
        const heightA = a.h * CELL_SIZE + 24;
        const heightB = b.h * CELL_SIZE + 24;
        return heightB - heightA; // Sort by height descending (standard for shelf packing)
    });

    // Calculate target width to keep the cluster "square"
    const totalArea = nodes.reduce((acc, n) => {
        return acc + (n.w * CELL_SIZE + PADDING) * (n.h * CELL_SIZE + 24 + PADDING);
    }, 0);
    const targetWidth = Math.sqrt(totalArea);

    let currentX = 0;
    let currentY = 0;
    let shelfHeight = 0;
    const packed = [];

    sorted.forEach(node => {
        const nodeW = node.w * CELL_SIZE;
        const nodeH = node.h * CELL_SIZE + 24;

        // If node exceeds shelf width, start new shelf
        if (currentX + nodeW > targetWidth && currentX > 0) {
            currentX = 0;
            currentY += shelfHeight + PADDING;
            shelfHeight = 0;
        }

        node.x = currentX;
        node.y = currentY;

        shelfHeight = Math.max(shelfHeight, nodeH);
        currentX += nodeW + PADDING;
        packed.push(node);
    });

    // Center the entire cluster around (0,0)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    packed.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.w * CELL_SIZE);
        maxY = Math.max(maxY, n.y + n.h * CELL_SIZE + 24);
    });

    const offsetX = (minX + maxX) / 2;
    const offsetY = (minY + maxY) / 2;

    packed.forEach(n => {
        n.x -= offsetX;
        n.y -= offsetY;
    });

    return packed;
  }
}