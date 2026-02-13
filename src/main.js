import { state } from './core/state.js';
import { NODE_TYPES, UPGRADE_DEFINITIONS, CELL_SIZE, LIFECYCLE } from './core/constants.js';
import { GridEngine } from './engine/grid.js';
import { PlacementEngine } from './engine/placement.js';
import { Autogoinker } from './engine/autogoinker.js';
import { NodeComponent } from './ui/nodeComponent.js';
import { ViewportManager } from './ui/viewport.js';
import { ContextMenu } from './ui/contextMenu.js';
import { Modal } from './ui/modal.js';
import { audio } from './engine/audio.js';

class GoinksweeperApp {
  constructor() {
    this.viewport = new ViewportManager(
      document.getElementById("viewport"),
      document.getElementById("world"),
      state
    );
    
    ContextMenu.init(document.getElementById("ctx-menu"));
    this.nodesContainer = document.getElementById("world");
    this.nodeElements = new Map();
    this.resetTimers = new Map();
    
    this.setupEventListeners();
    this.startLoops();
    
    setTimeout(() => {
      if (state.nodes.length === 0) {
        this.spawnNode("tier_a");
      } else {
        this.focusOnFirstNode();
      }
    }, 50);
  }

  focusOnFirstNode() {
    const firstNode = state.nodes[0];
    if (firstNode) {
      this.viewport.centerOn(firstNode.x, firstNode.y, firstNode.w * CELL_SIZE, firstNode.h * CELL_SIZE + 24);
    }
  }

  setupEventListeners() {
    document.getElementById("shop-toggle").onclick = (e) => {
      e.stopPropagation();
      audio.init();
      document.getElementById("shop-panel").classList.toggle("market--open");
      this.renderShop();
    };

    document.getElementById("btn-home").onclick = (e) => {
      e.stopPropagation();
      audio.init();
      this.focusOnFirstNode();
    };

    document.getElementById("btn-reset-data").onclick = async (e) => {
      e.stopPropagation();
      audio.init();
      const result = await Modal.confirm(
        "WIPE DATA?", 
        "Are you sure you want to delete all progress? This action cannot be undone."
      );
      
      if (result) {
        localStorage.removeItem("goinksweeper_data");
        window.location.reload();
      }
    };

    document.getElementById("btn-auto-all").onclick = (e) => {
      e.stopPropagation();
      audio.init();
      state.globalAuto = true;
      state.nodes.forEach(n => n.auto = true);
      state.save();
      this.refreshAllNodes();
    };

    document.getElementById("btn-auto-none").onclick = (e) => {
      e.stopPropagation();
      audio.init();
      state.globalAuto = false;
      state.nodes.forEach(n => n.auto = false);
      state.save();
      this.refreshAllNodes();
    };

    this.renderShop();
  }

  refreshAllNodes() {
    state.nodes.forEach(node => this.syncNodeUI(node));
  }

  spawnNode(typeKey) {
    const def = NODE_TYPES[typeKey];
    const pos = PlacementEngine.findPosition(def.w, def.h, state.nodes);
    const node = state.addNode(typeKey, pos.x, pos.y);
    GridEngine.generate(node);
    state.save();
    this.viewport.centerOn(node.x, node.y, node.w * CELL_SIZE, node.h * CELL_SIZE + 24);
    this.renderShop();
  }

  async handleReset(node, isAuto = false) {
    if (!isAuto) {
      const penalty = Math.floor(state.getBaseNodeCost(node.type) * 0.05);
      if (state.gp < penalty) {
        await Modal.alert("INSUFFICIENT FUNDS", `You need ${penalty.toLocaleString()} GP.`);
        return;
      }
      state.gp -= penalty;
    }
    
    if (this.resetTimers.has(node.id)) {
      clearTimeout(this.resetTimers.get(node.id));
      this.resetTimers.delete(node.id);
    }

    GridEngine.generate(node); 
    state.save();
    this.syncNodeUI(node);
    this.renderShop();
  }

  syncNodeUI(node) {
    const el = this.nodeElements.get(node.id);
    if (el) NodeComponent.update(el, node, (n, i) => this.handleCellClick(n, i), (n) => this.handleReset(n));
  }

  scheduleAutoReset(node, delay) {
    if (this.resetTimers.has(node.id)) return;
    const timer = setTimeout(() => this.handleReset(node, true), delay);
    this.resetTimers.set(node.id, timer);
  }

  handleCellClick(node, idx) {
    if (node.status !== "active") return;
    const cell = node.grid[idx];
    if (cell.r) return;

    audio.init();

    if (node.revealedCount === 0 && cell.m) {
      cell.m = false;
      GridEngine.generate(node, idx);
    }

    cell.r = true;
    node.revealedCount++;
    const def = NODE_TYPES[node.type];

    if (cell.m) {
      node.status = "goinked";
      audio.playGoink();
      this.scheduleAutoReset(node, LIFECYCLE.GOINKED_RESET_DELAY);
    } else {
      state.gp += def.mult * state.getOwned('manualMult');
      
      // Global Harmony: Trigger polyphonic note instead of static pitch
      audio.playNote(cell.v);

      if (cell.v === 0) GridEngine.floodFill(node, idx);
      
      if (node.revealedCount === (node.w * node.h) - node.mines) {
        node.status = "cleared";
        const completionBonus = def.mult * (node.w * node.h) * 5;
        state.gp += completionBonus;
        audio.playSuccess();
        this.scheduleAutoReset(node, LIFECYCLE.CLEARED_RESET_DELAY);
      }
    }
    state.save();
    this.syncNodeUI(node);
    this.renderShop();
  }

  startLoops() {
    const render = () => {
      document.getElementById("disp-gp").textContent = Math.floor(state.gp).toLocaleString();
      const accuracy = Autogoinker.getAccuracy(state.getOwned('autoAcc'));
      document.getElementById("disp-acc").textContent = `${(accuracy * 100).toFixed(1)}%`;

      const bounds = this.viewport.getVisibleBounds();
      const visibleIds = new Set();

      state.nodes.forEach(node => {
        const w = node.w * CELL_SIZE;
        const h = node.h * CELL_SIZE + 24;
        if (node.x + w > bounds.left && node.x < bounds.right && 
            node.y + h > bounds.top && node.y < bounds.bottom) {
          visibleIds.add(node.id);
          let el = this.nodeElements.get(node.id);
          if (!el) {
            el = NodeComponent.createBase(node);
            this.nodesContainer.appendChild(el);
            this.nodeElements.set(node.id, el);
            el.oncontextmenu = (e) => {
              const menuItems = [{ label: "Re-initialize", danger: true, action: () => this.handleReset(node) }];
              if (state.systemUnlocked) {
                menuItems.unshift({ 
                  label: `Auto: ${node.auto ? 'ON' : 'OFF'}`, 
                  action: () => { node.auto = !node.auto; state.save(); this.syncNodeUI(node); } 
                });
              }
              ContextMenu.show(e, menuItems);
            };
          }
          if (node.status === "cleared") this.scheduleAutoReset(node, LIFECYCLE.CLEARED_RESET_DELAY);
          if (node.status === "goinked") this.scheduleAutoReset(node, LIFECYCLE.GOINKED_RESET_DELAY);
          NodeComponent.update(el, node, (n, i) => this.handleCellClick(n, i), (n) => this.handleReset(n));
        }
      });

      for (const [id, el] of this.nodeElements) {
        if (!visibleIds.has(id)) { el.remove(); this.nodeElements.delete(id); }
      }
      requestAnimationFrame(render);
    };
    render();

    const runAuto = () => {
      if (state.systemUnlocked && state.globalAuto) {
        const active = state.nodes.filter(n => n.status === "active" && n.auto);
        if (active.length > 0) {
          const node = active[Math.floor(Math.random() * active.length)];
          const acc = Autogoinker.getAccuracy(state.getOwned('autoAcc'));
          const target = Autogoinker.decideMove(node, acc);
          if (target !== null) this.handleCellClick(node, target);
        }
      }
      setTimeout(runAuto, Autogoinker.getInterval(state.getOwned('autoSpeed')));
    };
    runAuto();
  }

  renderShop() {
    const list = document.getElementById("shop-list");
    list.innerHTML = "";
    const autoControls = document.getElementById("auto-controls");
    if (autoControls) autoControls.style.display = state.systemUnlocked ? "flex" : "none";

    UPGRADE_DEFINITIONS.forEach(u => {
      const owned = state.getOwned(u.id);
      if (u.max && owned >= u.max) return;
      if (!state.systemUnlocked && (u.id === 'autoSpeed' || u.id === 'autoAcc')) return;
      const cost = state.getItemCost(u.id); 
      const card = document.createElement("div");
      card.className = "card";
      const isAffordable = state.gp >= cost;
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between">
          <span class="card__title">${u.name}</span>
          <span class="card__cost">${cost.toLocaleString()}</span>
        </div>
        <div class="card__desc">${u.desc}<br><span style="color:#666">Level: ${owned}</span></div>
        <button class="card__buy-btn" ${!isAffordable ? 'disabled' : ''}>PURCHASE</button>
      `;
      card.querySelector("button").onclick = (e) => {
        e.preventDefault(); e.stopPropagation(); audio.init();
        if (state.gp >= cost) { state.gp -= cost; state.recordPurchase(u.id); this.renderShop(); }
      };
      list.appendChild(card);
    });

    const nodeHeader = document.createElement("div");
    nodeHeader.className = "market__header";
    nodeHeader.style.border = "none";
    nodeHeader.style.marginTop = "20px";
    nodeHeader.innerText = "CLUSTER EXPANSION";
    list.appendChild(nodeHeader);

    Object.keys(NODE_TYPES).forEach(key => {
      const def = NODE_TYPES[key];
      const cost = state.getItemCost(key);
      const owned = state.getOwned(key);
      const card = document.createElement("div");
      card.className = "card";
      const isAffordable = state.gp >= cost;
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center">
          <span class="card__title" style="font-size:0.85rem">${def.name}</span>
          <span class="card__cost">${cost.toLocaleString()}</span>
        </div>
        <div class="card__desc" style="font-size:0.75rem">Dim: ${def.w}x${def.h} • Mult: x${def.mult}<br><span style="color:#666">Owned: ${owned}</span></div>
        <button class="card__buy-btn" ${!isAffordable ? 'disabled' : ''}>INITIALIZE</button>
      `;
      card.querySelector("button").onclick = (e) => {
        e.preventDefault(); e.stopPropagation(); audio.init();
        if (state.gp >= cost) { state.gp -= cost; this.spawnNode(key); this.renderShop(); }
      };
      list.appendChild(card);
    });
  }
}

new GoinksweeperApp();