import { CELL_SIZE, NODE_TYPES, DIFFICULTIES } from "../core/constants.js";

export class NodeComponent {
  /**
   * Creates the DOM element with custom UI components.
   */
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
              <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="4" fill="none"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <div class="goink-select__menu"></div>
          </div>
          <span>#${node.id}</span>
        </div>
        <div class="node__bomb-counter">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
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
          difficulty: node.difficulty || 'MEDIUM',
          auto: node.auto,
          gridData: node.grid,
          canvas: offscreen,
          status: node.status,
          revealedCount: node.revealedCount
        },
      },
      [offscreen]
    );

    const uiCanvas = el.querySelector(".node__ui-layer");
    uiCanvas.width = exactWidth - 8;
    uiCanvas.height = exactHeight;
    uiCanvas.style.width = `${workerCanvas.width}px`;
    uiCanvas.style.height = `${workerCanvas.height}px`;

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
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    });

    uiCanvas.addEventListener("mouseleave", () => ctx.clearRect(0, 0, uiCanvas.width, uiCanvas.height));

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
      onContextMenu(e, node);
    });

    this.updateOverlay(el, node, worker);
    return el;
  }

  /**
   * Logic for the custom GoinkSelect component.
   * Uses mousedown to ensure priority over global window listeners.
   */
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
        const optDef = DIFFICULTIES[key];
        opt.className = "goink-select__option";
        if (key === currentDiff) opt.classList.add("goink-select__option--selected");
        opt.style.color = optDef.color;
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
      document.querySelectorAll('.goink-select--open').forEach(s => s.classList.remove('goink-select--open'));
      if (!isOpen) select.classList.add("goink-select--open");
    };

    updateUI(node.difficulty || "MEDIUM");
    el._syncDifficulty = updateUI;
  }

  static updateOverlay(el, node, worker) {
    let overlay = el.querySelector(".node__overlay");
    el.className = `node node--${node.status}`;

    const bombSpan = el.querySelector(".bomb-val");
    if (bombSpan && node.mines !== undefined) {
      bombSpan.innerText = node.mines;
    }

    if (el._syncDifficulty && node.difficulty) {
      el._syncDifficulty(node.difficulty);
    }

    const dot = el.querySelector('.node__status-dot');
    if (dot) {
      dot.className = node.auto ? 'node__status-dot node__status-dot--active' : 'node__status-dot';
    }

    if (node.status === "goinked" || node.status === "cleared") {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "node__overlay";
        el.appendChild(overlay);
      }
      
      const isWin = node.status === "cleared";
      const typeDef = NODE_TYPES[node.type];
      const diffDef = DIFFICULTIES[node.difficulty] || DIFFICULTIES.MEDIUM;
      const bonusEstimate = typeDef ? Math.floor(typeDef.mult * node.w * node.h * 5 * diffDef.mult) : 0;
      
      const newHtml = `
        <span class="node__status-text" style="color:${diffDef.color}">${isWin ? 'SUCCESS' : 'GOINKED'}</span>
        ${isWin ? `<span class="node__reward-text">+${bonusEstimate.toLocaleString()} GP</span>` : ''}
        <button class="node__reset-btn" style="background:${diffDef.color}">${isWin ? 'READY' : 'RE-INITIALIZE'}</button>
      `;
      
      if (overlay.innerHTML !== newHtml) {
        overlay.innerHTML = newHtml;
        const btn = overlay.querySelector(".node__reset-btn");
        btn.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          worker.postMessage({ type: 'RESET_NODE', data: { nodeId: node.id } });
        };
      }
    } else if (overlay) {
      overlay.remove();
    }
  }
}