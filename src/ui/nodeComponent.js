import { CELL_SIZE, NODE_TYPES } from '../core/constants.js';

export class NodeComponent {
  static createBase(node) {
    const el = document.createElement("div");
    el.className = `node`;
    el.dataset.id = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.style.width = `${node.w * CELL_SIZE}px`;
    
    el.innerHTML = `
      <div class="node__bar"></div>
      <div class="node__grid"></div>
    `;
    return el;
  }

  static update(el, node, onCellClick, onReset) {
    const currentStatus = `node node--${node.status}`;
    if (el.className !== currentStatus) {
      el.className = currentStatus;
    }

    const bar = el.querySelector(".node__bar");
    const barHtml = `
      <div style="display:flex; align-items:center;">
        <div class="node__status-dot ${node.auto ? 'node__status-dot--active' : ''}"></div>
        <span>${node.type.toUpperCase()} #${node.id}</span>
      </div>
    `;
    if (bar.innerHTML !== barHtml) bar.innerHTML = barHtml;

    const grid = el.querySelector(".node__grid");
    if (grid.children.length !== node.grid.length) {
      grid.style.gridTemplateColumns = `repeat(${node.w}, ${CELL_SIZE}px)`;
      grid.innerHTML = "";
      node.grid.forEach((c, i) => {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.onmousedown = (e) => {
          e.stopPropagation();
          if (e.button === 0) onCellClick(node, i);
        };
        grid.appendChild(cell);
      });
    }

    node.grid.forEach((c, i) => {
      const cell = grid.children[i];
      const targetClass = "cell" + (c.r ? " cell--revealed" : "") + (c.r && c.m ? " cell--goink" : "");
      
      if (cell.className !== targetClass) {
        cell.className = targetClass;
        if (c.r) {
          if (c.m) {
            cell.innerHTML = '<img src="goink.png" alt="X" onerror="this.style.display=\'none\'">'; 
          } else if (c.v > 0) {
            cell.classList.add(`cell--n${c.v}`);
            cell.textContent = c.v;
          }
        } else {
          cell.textContent = "";
          cell.innerHTML = "";
        }
      }
    });

    let overlay = el.querySelector(".node__overlay");
    
    if (node.status === "goinked" || node.status === "cleared") {
      const isWin = node.status === "cleared";
      const overlayClass = `node__overlay ${isWin ? 'node__overlay--success' : 'node__overlay--danger'}`;
      
      if (!overlay || overlay.className !== overlayClass) {
        if (overlay) overlay.remove();
        
        overlay = document.createElement("div");
        overlay.className = overlayClass;
        
        const def = NODE_TYPES[node.type];
        const bonus = def.mult * (node.w * node.h) * 5;
        
        overlay.innerHTML = `
          <span class="node__status-text ${isWin ? 'node__status-text--success' : 'node__status-text--danger'}">
            ${isWin ? 'SUCCESS' : 'GOINKED'}
          </span>
          ${isWin ? `<span class="node__reward-text">+${bonus.toLocaleString()} GP</span>` : ''}
          <button class="node__reset-btn">${isWin ? 'RE-INITIALIZING...' : 'RE-INITIALIZE'}</button>
        `;
        
        overlay.onmousedown = (e) => e.stopPropagation();
        overlay.onclick = (e) => e.stopPropagation();

        const btn = overlay.querySelector(".node__reset-btn");
        if (!isWin) {
          btn.onclick = (e) => {
            e.stopPropagation();
            onReset(node);
          };
        } else {
          btn.style.opacity = "0.6";
          btn.style.cursor = "default";
        }
        
        el.appendChild(overlay);
      }
    } else {
      if (overlay) overlay.remove();
    }
  }
}