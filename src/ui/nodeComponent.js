import { CELL_SIZE, NODE_TYPES } from '../core/constants.js';

export class NodeComponent {
  static colorCache = null;
  static hoveredNodes = new Map(); 

  /**
   * Caches theme-specific colors to avoid layout thrashing in the render loop.
   */
  static refreshColorCache() {
    const s = getComputedStyle(document.body);
    this.colorCache = {
      surface: s.getPropertyValue('--color-surface').trim(),
      surfaceAlt: s.getPropertyValue('--color-surface-alt').trim(),
      primary: s.getPropertyValue('--color-primary').trim(),
      danger: s.getPropertyValue('--color-danger').trim(),
      blue: s.getPropertyValue('--color-accent-blue').trim(),
      green: s.getPropertyValue('--color-accent-green').trim()
    };
  }

  /**
   * Converts screen mouse coordinates to grid-cell indices.
   * Accounts for CSS Scale, Device Pixel Ratio, and 4px Grid Padding.
   */
  static getGridCoords(e, canvas, node) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Scale factor between logical pixels and screen pixels (handling zoom)
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;

    // Local coordinates on the canvas logic plane
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;

    const col = Math.floor(localX / (CELL_SIZE + 1));
    const row = Math.floor(localY / (CELL_SIZE + 1));

    return { col, row };
  }

  static createBase(node, onCellClick) {
    const el = document.createElement("div");
    el.className = `node`;
    el.dataset.id = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    
    const gapTotal = Math.max(0, node.w - 1) * 1;
    const paddingTotal = 8; 
    const exactWidth = (node.w * CELL_SIZE) + gapTotal + paddingTotal;
    el.style.width = `${exactWidth}px`;
    
    el.innerHTML = `
      <div class="node__bar"></div>
      <div class="node__grid">
        <canvas class="node__canvas"></canvas>
      </div>
    `;

    const canvas = el.querySelector(".node__canvas");
    const dpr = window.devicePixelRatio || 1;
    const canvasW = (exactWidth - 8);
    const canvasH = (node.h * CELL_SIZE + Math.max(0, node.h - 1));
    
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;

    // Only intercept Left-Clicks for cell interaction
    canvas.onmousedown = (e) => {
      if (e.button !== 0) return; 
      e.stopPropagation();
      const { col, row } = this.getGridCoords(e, canvas, node);
      if (col >= 0 && col < node.w && row >= 0 && row < node.h) {
        onCellClick(node, row * node.w + col);
      }
    };

    canvas.onmousemove = (e) => {
      const { col, row } = this.getGridCoords(e, canvas, node);
      if (col >= 0 && col < node.w && row >= 0 && row < node.h) {
        this.hoveredNodes.set(node.id, row * node.w + col);
      } else {
        this.hoveredNodes.delete(node.id);
      }
    };

    canvas.onmouseleave = () => this.hoveredNodes.delete(node.id);
    
    return el;
  }

  static update(el, node, onReset) {
    const currentStatus = `node node--${node.status}`;
    if (el.className !== currentStatus) el.className = currentStatus;

    const bar = el.querySelector(".node__bar");
    const barHtml = `
      <div style="display:flex; align-items:center;">
        <div class="node__status-dot ${node.auto ? 'node__status-dot--active' : ''}"></div>
        <span>${node.type.toUpperCase()} #${node.id}</span>
      </div>
    `;
    if (bar.innerHTML !== barHtml) bar.innerHTML = barHtml;

    const canvas = el.querySelector(".node__canvas");
    const ctx = canvas.getContext('2d', { alpha: false });
    const dpr = window.devicePixelRatio || 1;

    if (!this.colorCache) this.refreshColorCache();

    ctx.save();
    ctx.scale(dpr, dpr);
    
    const currentHoverIdx = this.hoveredNodes.get(node.id);

    node.grid.forEach((c, i) => {
      const col = i % node.w;
      const row = Math.floor(i / node.w);
      const x = col * (CELL_SIZE + 1);
      const y = row * (CELL_SIZE + 1);

      ctx.fillStyle = c.r ? this.colorCache.surfaceAlt : this.colorCache.surface;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

      // Draw interactive hover highlight
      if (i === currentHoverIdx && !c.r && node.status === 'active') {
          ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
          ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = this.colorCache.primary;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
      }

      if (c.r) {
        if (c.m) {
          ctx.fillStyle = this.colorCache.danger;
          ctx.beginPath();
          ctx.arc(x + 10, y + 10, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (c.v > 0) {
          ctx.fillStyle = this.getNumberColor(c.v);
          ctx.font = "900 13px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(c.v, x + 10, y + 10.5);
        }
      }
    });
    ctx.restore();

    this.updateOverlay(el, node, onReset);
  }

  static getNumberColor(v) {
    if (v === 1) return this.colorCache.blue;
    if (v === 2) return this.colorCache.green;
    if (v === 3) return this.colorCache.danger;
    return "#9b5de5";
  }

  /**
   * Manages the "Win/Loss" overlay visibility and button logic.
   * @param {Function} onReset - Function to call for re-initialization.
   */
  static updateOverlay(el, node, onReset) {
    let overlay = el.querySelector(".node__overlay");
    if (node.status === "goinked" || node.status === "cleared") {
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "node__overlay";
        el.appendChild(overlay);
      }
      
      const isWin = node.status === "cleared";
      const bonus = NODE_TYPES[node.type].mult * (node.w * node.h) * 5;
      
      const newHtml = `
        <span class="node__status-text">${isWin ? 'SUCCESS' : 'GOINKED'}</span>
        ${isWin ? `<span class="node__reward-text">+${bonus.toLocaleString()} GP</span>` : ''}
        <button class="node__reset-btn">${isWin ? 'READY' : 'RE-INITIALIZE'}</button>
      `;
      
      if (overlay.innerHTML !== newHtml) {
        overlay.innerHTML = newHtml;
        const btn = overlay.querySelector(".node__reset-btn");
        // Bind the specific onReset callback passed from the parent
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onReset(node);
        };
      }
    } else if (overlay) {
      overlay.remove();
    }
  }
}