import { DIFFICULTIES, NODE_TYPES } from "../core/constants.js";
import { Autogoinker } from "./autogoinker.js";

/**
 * GOINKSWEEPER Simulation Worker
 * Source of Truth for all cluster logic and temporal states.
 */

let nodes = new Map();
let activeTimers = new Map(); // nodeId -> timeoutId
let config = {
  themeColors: {},
  viewScale: 1,
  accuracy: 0.05,
  speed: 2000,
};

let lastTick = performance.now();
let actionAccumulator = 0;

self.onmessage = function (e) {
  const { type, data } = e.data;

  switch (type) {
    case "SYNC_CONFIG":
      config.themeColors = data.colors;
      config.viewScale = data.scale;
      config.accuracy = data.accuracy || 0.05;
      config.speed = data.speed || 2000;
      nodes.forEach((n) => (n.dirty = true));
      break;

    case "INIT_NODE":
      initNode(data);
      break;

    case "CLICK_CELL":
      processInteraction(data.nodeId, data.cellIdx, false);
      break;

    case "TOGGLE_FLAG":
      toggleFlag(data.nodeId, data.cellIdx);
      break;

    case "CHANGE_DIFFICULTY":
      const node = nodes.get(data.nodeId);
      if (node) {
        node.difficulty = data.difficulty;
        executeLifecycleReset(node.id); // Immediate atomic reset
      }
      break;

    case "TOGGLE_AUTO":
      const nAuto = nodes.get(data.nodeId);
      if (nAuto) {
        nAuto.auto = data.state;
        nAuto.dirty = true;
        broadcastStatus(nAuto);
      }
      break;

    case "RESET_NODE":
      executeLifecycleReset(data.nodeId);
      break;

    case "KILL_NODE":
      clearNodeTimer(data.nodeId);
      nodes.delete(data.nodeId);
      break;
  }
};

function clearNodeTimer(nodeId) {
  if (activeTimers.has(nodeId)) {
    clearTimeout(activeTimers.get(nodeId));
    activeTimers.delete(nodeId);
  }
}

function initNode(data) {
  const node = {
    id: data.id,
    w: data.w,
    h: data.h,
    type: data.nodeType,
    difficulty: data.difficulty || "MEDIUM",
    status: data.status || "active",
    auto: data.auto,
    grid: data.gridData || null,
    canvas: data.canvas,
    ctx: data.canvas.getContext("2d", { alpha: false }),
    dirty: true,
    revealedCount: data.revealedCount || 0,
    genId: Date.now() + Math.random(),
  };

  // Ensure grid exists
  if (!node.grid || node.grid.length === 0) {
    node.grid = generateGrid(node);
    node.status = "active";
    node.revealedCount = 0;
  }

  nodes.set(node.id, node);
  broadcastStatus(node);
  node.dirty = true;
}

/**
 * executeLifecycleReset
 * The single, atomic way to restart a board.
 * Clears timers, increments generation, and generates a new grid.
 */
function executeLifecycleReset(nodeId) {
  const node = nodes.get(nodeId);
  if (!node) return;

  clearNodeTimer(nodeId);

  node.genId = Date.now() + Math.random();
  node.grid = generateGrid(node);
  node.status = "active";
  node.revealedCount = 0;
  node.dirty = true;

  broadcastStatus(node);
}

function broadcastStatus(node) {
  const diffDef = DIFFICULTIES[node.difficulty] || DIFFICULTIES.MEDIUM;
  const mineCount = Math.floor(node.w * node.h * diffDef.density);
  self.postMessage({
    type: "NODE_STATUS",
    data: {
      nodeId: node.id,
      status: node.status,
      auto: node.auto,
      difficulty: node.difficulty,
      mines: mineCount,
      genId: node.genId,
    },
  });
}

function generateGrid(node) {
  const total = node.w * node.h;
  const diffDef = DIFFICULTIES[node.difficulty] || DIFFICULTIES.MEDIUM;
  const mineCount = Math.floor(total * diffDef.density);

  const grid = [];
  for (let i = 0; i < total; i++) {
    // f: flagged
    grid.push({ m: false, r: false, v: 0, f: false });
  }

  let placed = 0;
  while (placed < mineCount) {
    const i = Math.floor(Math.random() * total);
    if (!grid[i].m) {
      grid[i].m = true;
      placed++;
    }
  }

  for (let i = 0; i < total; i++) {
    if (grid[i].m) continue;
    let count = 0;
    const cx = i % node.w;
    const cy = Math.floor(i / node.w);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < node.w && ny >= 0 && ny < node.h) {
          if (grid[ny * node.w + nx].m) count++;
        }
      }
    }
    grid[i].v = count;
  }
  return grid;
}

function toggleFlag(nodeId, idx) {
  const node = nodes.get(nodeId);
  if (!node || node.status !== "active") return;
  const cell = node.grid[idx];
  
  if (!cell || cell.r) return; // Cannot flag revealed cells

  cell.f = !cell.f;
  node.dirty = true;
}

function processInteraction(nodeId, idx, isAuto) {
  const node = nodes.get(nodeId);
  if (!node || node.status !== "active") return;

  const cell = node.grid[idx];
  if (!cell || cell.r) return;
  if (cell.f && !isAuto) return; // Cannot reveal flagged cells (safety)

  // First click safety
  if (node.revealedCount === 0 && cell.m) {
    cell.m = false;
    node.grid = generateGrid(node);
    // Persist flag if it was set before regen? No, reset it.
    node.dirty = true;
    processInteraction(nodeId, idx, isAuto);
    return;
  }

  cell.r = true;
  cell.f = false; // Remove flag if revealed (e.g. via auto or logic force)
  node.revealedCount++;
  node.dirty = true;

  const diffDef = DIFFICULTIES[node.difficulty] || DIFFICULTIES.MEDIUM;
  const typeDef = NODE_TYPES[node.type];
  const totalMines = Math.floor(node.w * node.h * diffDef.density);

  if (cell.m) {
    node.status = "goinked";
    self.postMessage({ type: "SFX", data: { name: "goink", nodeId } });
    broadcastStatus(node);

    const currentGen = node.genId;
    clearNodeTimer(nodeId);
    const tid = setTimeout(() => {
      if (nodes.has(nodeId) && nodes.get(nodeId).genId === currentGen) {
        executeLifecycleReset(nodeId);
      }
    }, 4000);
    activeTimers.set(nodeId, tid);
  } else {
    self.postMessage({ type: "SFX", data: { name: "note", value: cell.v } });
    self.postMessage({
      type: "GP_GAIN",
      data: { amount: typeDef.mult, isAuto },
    });

    if (cell.v === 0) floodFill(node, idx);

    if (node.revealedCount === node.w * node.h - totalMines) {
      node.status = "cleared";
      const clearBonus = Math.floor(
        typeDef.mult * node.w * node.h * 5 * diffDef.mult,
      );

      self.postMessage({
        type: "GP_GAIN",
        data: { amount: clearBonus, isAuto },
      });
      self.postMessage({
        type: "SFX",
        data: { name: "success", nodeId, tier: node.type },
      });
      broadcastStatus(node);

      const currentGen = node.genId;
      clearNodeTimer(nodeId);
      const tid = setTimeout(() => {
        if (nodes.has(nodeId) && nodes.get(nodeId).genId === currentGen) {
          executeLifecycleReset(nodeId);
        }
      }, 2500);
      activeTimers.set(nodeId, tid);
    }
  }
}

function floodFill(node, startIdx) {
  const stack = [startIdx];
  const seen = new Set([startIdx]);

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
            // Don't auto-reveal flagged cells during floodfill? 
            // Standard minesweeper: usually safely ignores flags if v=0.
            // But let's assume flags protect the cell.
            if (!cell.r && !cell.m && !cell.f) {
              cell.r = true;
              node.revealedCount++;
              if (cell.v === 0) stack.push(ni);
            }
          }
        }
      }
    }
  }
}

function runAutomation() {
  const now = performance.now();
  const dt = now - lastTick;
  lastTick = now;

  const activeNodes = Array.from(nodes.values()).filter(
    (n) => n.status === "active" && n.auto,
  );

  if (activeNodes.length > 0 && nodes.size > 0) {
    const globalInterval = config.speed / nodes.size;
    actionAccumulator += dt / globalInterval;

    if (actionAccumulator > 20) actionAccumulator = 20;

    while (actionAccumulator >= 1) {
      const node = activeNodes[Math.floor(Math.random() * activeNodes.length)];
      const target = Autogoinker.decideMove(node, config.accuracy);

      if (target !== null) {
        processInteraction(node.id, target, true);
      }
      actionAccumulator -= 1;
    }

    setTimeout(runAutomation, 16);
  } else {
    actionAccumulator = 0;
    setTimeout(runAutomation, 100);
  }
}
runAutomation();

function getNumberColor(v, colors) {
  if (v === 1) return colors.blue || colors.primary;
  if (v === 2) return colors.green || colors.primary;
  if (v === 3) return colors.danger || "red";
  return colors.purple || colors.primary;
}

function render() {
  nodes.forEach((node) => {
    if (!node.dirty) return;

    const ctx = node.ctx;
    const colors = config.themeColors;
    const cellSize = 20;

    ctx.fillStyle = colors.surfaceAlt || "#ffffff";
    ctx.fillRect(0, 0, node.canvas.width, node.canvas.height);

    node.grid.forEach((c, i) => {
      const x = (i % node.w) * (cellSize + 1);
      const y = Math.floor(i / node.w) * (cellSize + 1);

      ctx.fillStyle = c.r
        ? colors.surfaceAlt || "#ffffff"
        : colors.surface || "#cccccc";
      ctx.fillRect(x, y, cellSize, cellSize);

      if (c.r) {
        if (c.m) {
          ctx.fillStyle = colors.danger || "red";
          ctx.beginPath();
          ctx.arc(x + 10, y + 10, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (c.v > 0 && config.viewScale > 0.5) {
          ctx.fillStyle = getNumberColor(c.v, colors);
          ctx.font = "900 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(c.v, x + 10, y + 10.5);
        }
      } else if (c.f) {
        // Draw Flag
        ctx.fillStyle = colors.danger || "red";
        ctx.beginPath();
        // Flag pole
        ctx.rect(x + 5, y + 3, 2, 14);
        // Triangle
        ctx.moveTo(x + 7, y + 3);
        ctx.lineTo(x + 15, y + 7);
        ctx.lineTo(x + 7, y + 11);
        ctx.fill();
      }
    });

    node.dirty = false;
  });
  requestAnimationFrame(render);
}
render();