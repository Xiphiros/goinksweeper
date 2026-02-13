export class GridEngine {
  static generate(node, safeIdx = -1) {
    const total = node.w * node.h;
    node.grid = Array.from({ length: total }, () => ({
      m: false, 
      r: false, 
      v: 0 
    }));
    node.revealedCount = 0;
    node.status = "active";

    let placed = 0;
    while (placed < node.mines) {
      const i = Math.floor(Math.random() * total);
      if (i !== safeIdx && !node.grid[i].m) {
        node.grid[i].m = true;
        placed++;
      }
    }
    this.recalculate(node);
  }

  static recalculate(node) {
    const total = node.w * node.h;
    for (let i = 0; i < total; i++) {
      if (node.grid[i].m) continue;
      const cx = i % node.w;
      const cy = Math.floor(i / node.w);
      let count = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < node.w && ny >= 0 && ny < node.h) {
            if (node.grid[ny * node.w + nx].m) count++;
          }
        }
      }
      node.grid[i].v = count;
    }
  }

  static floodFill(node, startIdx) {
    const stack = [startIdx];
    const seen = new Set([startIdx]);
    let count = 0;

    while (stack.length) {
      const i = stack.pop();
      const cx = i % node.w;
      const cy = Math.floor(i / node.w);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < node.w && ny >= 0 && ny < node.h) {
            const ni = ny * node.w + nx;
            if (!seen.has(ni)) {
              seen.add(ni);
              const cell = node.grid[ni];
              if (!cell.r && !cell.m) {
                cell.r = true;
                node.revealedCount++;
                count++;
                if (cell.v === 0) stack.push(ni);
              }
            }
          }
        }
      }
    }
    return count;
  }
}