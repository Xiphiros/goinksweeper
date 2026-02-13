import { CELL_SIZE, NODE_TYPES, DIFFICULTIES } from "../core/constants.js";

const hoverState = {
  nodeId: null,
  cellIdx: -1,
  worker: null,
};

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "f") {
    if (
      hoverState.nodeId !== null &&
      hoverState.cellIdx !== -1 &&
      hoverState.worker
    ) {
      hoverState.worker.postMessage({
        type: "TOGGLE_FLAG",
        data: { nodeId: hoverState.nodeId, cellIdx: hoverState.cellIdx },
      });
    }
  }
});

export class NodeComponent {
  static createBase(node, worker, onContextMenu) {
    const el = document.createElement("div");
    el.className = `node node--${node.status}`;
    el.dataset.id = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;

    const exactWidth = node.w * CELL_SIZE + (node.w - 1) + 8;
    const exactHeight = node.h * CELL_SIZE + (node.h - 1);
    el.style.width = `${exactWidth}px`;

    el.innerHTML = `
      <div class="node__bar">
        <div class="node__bar-left">
          <div class="node__status-dot"></div>
          <div class="goink-select" id="diff-select-${node.id}">
            <div class="goink-select__trigger">
              <span class="goink-select__label">--</span>
              <i class="fa-solid fa-chevron-down" style="font-size: 10px;"></i>
            </div>
            <div class="goink-select__menu"></div>
          </div>
          <span>#${node.id}</span>
        </div>
        <div class="node__bomb-counter">
          <i class="fa-solid fa-bomb"></i>
          <span class="bomb-val">--</span>
        </div>
      </div>
      <div class="node__grid">
        <canvas class="node__canvas"></canvas>
        <canvas class="node__ui-layer"></canvas>
      </div>
    `;

    this.setupCustomSelect(el, node, worker);

    const workerCanvas = el.querySelector(".node__canvas");
    workerCanvas.width = exactWidth - 8;
    workerCanvas.height = exactHeight;

    const offscreen = workerCanvas.transferControlToOffscreen();
    worker.postMessage(
      {
        type: "INIT_NODE",
        data: {
          id: node.id,
          w: node.w,
          h: node.h,
          nodeType: node.type,
          difficulty: node.difficulty || "MEDIUM",
          auto: node.auto,
          gridData: node.grid,
          canvas: offscreen,
          status: node.status,
          revealedCount: node.revealedCount,
        },
      },
      [offscreen],
    );

    const uiCanvas = el.querySelector(".node__ui-layer");
    uiCanvas.width = exactWidth - 8;
    uiCanvas.height = exactHeight;

    const ctx = uiCanvas.getContext("2d");
    const styles = getComputedStyle(document.body);
    const highlightColor = "rgba(255, 255, 255, 0.3)";
    const borderColor = styles.getPropertyValue("--color-primary").trim();

    uiCanvas.addEventListener("mousemove", (e) => {
      ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
      const col = Math.floor(e.offsetX / (CELL_SIZE + 1));
      const row = Math.floor(e.offsetY / (CELL_SIZE + 1));

      if (col >= 0 && col < node.w && row >= 0 && row < node.h) {
        const x = col * (CELL_SIZE + 1);
        const y = row * (CELL_SIZE + 1);
        ctx.fillStyle = highlightColor;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = borderColor;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);

        hoverState.nodeId = node.id;
        hoverState.cellIdx = row * node.w + col;
        hoverState.worker = worker;
      }
    });

    uiCanvas.addEventListener("mouseleave", () => {
      ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
      if (hoverState.nodeId === node.id) {
        hoverState.nodeId = null;
        hoverState.cellIdx = -1;
        hoverState.worker = null;
      }
    });

    uiCanvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        e.stopPropagation();
        const col = Math.floor(e.offsetX / (CELL_SIZE + 1));
        const row = Math.floor(e.offsetY / (CELL_SIZE + 1));
        if (col >= 0 && col < node.w && row >= 0 && row < node.h) {
          worker.postMessage({
            type: "CLICK_CELL",
            data: { nodeId: node.id, cellIdx: row * node.w + col },
          });
        }
      }
    });

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(
        e,
        node,
        hoverState.nodeId === node.id ? hoverState.cellIdx : -1,
      );
    });

    this.updateOverlay(el, node, worker);
    return el;
  }

  static setupCustomSelect(el, node, worker) {
    const select = el.querySelector(".goink-select");
    const trigger = select.querySelector(".goink-select__trigger");
    const menu = select.querySelector(".goink-select__menu");
    const label = select.querySelector(".goink-select__label");

    const updateUI = (currentDiff) => {
      const diffDef = DIFFICULTIES[currentDiff];
      if (!diffDef) return;

      label.innerText = currentDiff;
      trigger.style.color = diffDef.color;
      trigger.style.borderColor = diffDef.color;

      menu.innerHTML = "";
      Object.keys(DIFFICULTIES).forEach((key) => {
        const opt = document.createElement("div");
        opt.className = "goink-select__option";
        if (key === currentDiff)
          opt.classList.add("goink-select__option--selected");
        opt.style.color = DIFFICULTIES[key].color;
        opt.innerText = key;

        opt.onmousedown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          worker.postMessage({
            type: "CHANGE_DIFFICULTY",
            data: { nodeId: node.id, difficulty: key },
          });
          select.classList.remove("goink-select--open");
        };
        menu.appendChild(opt);
      });
    };

    trigger.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = select.classList.contains("goink-select--open");
      document
        .querySelectorAll(".goink-select--open")
        .forEach((s) => s.classList.remove("goink-select--open"));
      if (!isOpen) select.classList.add("goink-select--open");
    };

    updateUI(node.difficulty || "MEDIUM");
    el._syncDifficulty = updateUI;
  }

  /**
   * updateOverlay
   * Standard Game-Logic: Uses status caching to prevent layout thrashing.
   * Only rebuilds DOM when status or difficulty actually changes.
   */
  static updateOverlay(el, node, worker) {
    // 1. Cache Check: Compare against last known state stored on the element
    if (
      el._lastStatus === node.status &&
      el._lastDiff === node.difficulty &&
      el._lastAuto === node.auto &&
      el._lastMines === node.mines
    ) {
      return;
    }

    // 2. State Sync: Meta-data updates
    const bombSpan = el.querySelector(".bomb-val");
    if (bombSpan) bombSpan.innerText = node.mines || 0;

    const dot = el.querySelector(".node__status-dot");
    if (dot) {
      dot.className = node.auto
        ? "node__status-dot node__status-dot--active"
        : "node__status-dot";
    }

    if (el._syncDifficulty) el._syncDifficulty(node.difficulty);

    // 3. Overlay Stability logic
    let overlay = el.querySelector(".node__overlay");
    el.className = `node node--${node.status}`;

    if (node.status === "goinked" || node.status === "cleared") {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "node__overlay";
        el.appendChild(overlay);
      }

      const isWin = node.status === "cleared";
      const diffDef = DIFFICULTIES[node.difficulty] || DIFFICULTIES.MEDIUM;

      // CRITICAL: We only overwrite innerHTML once per status change
      overlay.innerHTML = `
        <span class="node__status-text" style="color:${diffDef.color}">
          ${isWin ? '<i class="fa-solid fa-check-circle"></i> SUCCESS' : '<i class="fa-solid fa-skull"></i> GOINKED'}
        </span>
        <button class="node__reset-btn" style="background:${diffDef.color}">RE-INITIALIZE</button>
      `;

      // Re-bind the stable click listener
      overlay.querySelector(".node__reset-btn").onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        worker.postMessage({ type: "RESET_NODE", data: { nodeId: node.id } });
      };
    } else if (overlay) {
      overlay.remove();
    }

    // 4. Update Cache
    el._lastStatus = node.status;
    el._lastDiff = node.difficulty;
    el._lastAuto = node.auto;
    el._lastMines = node.mines;
  }
}
