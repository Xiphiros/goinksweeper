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
import { telemetry } from './engine/telemetry.js';

class GoinksweeperApp {
  constructor() {
    this.viewport = new ViewportManager(
      document.getElementById("viewport"),
      document.getElementById("world"),
      state,
      () => this.closeOverlays()
    );
    
    ContextMenu.init(document.getElementById("ctx-menu"));
    this.nodesContainer = document.getElementById("world");
    this.nodeElements = new Map();
    this.resetTimers = new Map();
    
    document.getElementById("slider-bgm").value = state.volume.bgm;
    document.getElementById("slider-sfx").value = state.volume.sfx;

    this.applyTheme();
    this.applyBackground();
    this.setupEventListeners();
    this.startLoops();

    const bootAudio = () => {
      audio.init();
      this.applyVolumeSettings();
    };

    window.addEventListener('mousedown', bootAudio, { once: true });
    window.addEventListener('keydown', bootAudio, { once: true });
    
    setTimeout(() => {
      if (state.nodes.length === 0) {
        this.spawnNode("tier_a");
      } else {
        this.focusOnFirstNode();
      }
    }, 50);
  }

  applyTheme() {
    document.body.setAttribute('data-theme', state.theme);
    NodeComponent.refreshColorCache();
  }

  /**
   * Applies background visibility and custom image to the viewport.
   */
  applyBackground() {
    const viewport = document.getElementById("viewport");
    if (state.bgEnabled) {
      viewport.classList.remove("viewport--no-bg");
    } else {
      viewport.classList.add("viewport--no-bg");
    }
    document.documentElement.style.setProperty('--dynamic-bg-url', `url('${state.bgUrl}')`);
  }

  applyVolumeSettings() {
    audio.setMusicVolume(state.volume.bgm);
    audio.setSfxVolume(state.volume.sfx);
  }

  focusOnFirstNode() {
    this.viewport.centerOn(0, 0, 400, 400);
  }

  closeOverlays() {
    this.setMarketOpen(false);
    this.setSidebarOpen(false);
  }

  setMarketOpen(isOpen) {
    const shopPanel = document.getElementById("shop-panel");
    const isCurrentlyOpen = shopPanel.classList.contains("market--open");
    if (isOpen === isCurrentlyOpen) return;

    if (isOpen) {
      shopPanel.classList.add("market--open");
      this.setSidebarOpen(false);
      document.getElementById("viewport").classList.add("viewport--dimmed");
      this.renderShop();
    } else {
      shopPanel.classList.remove("market--open");
      if (!document.getElementById("sidebar").classList.contains("sidebar--open")) {
        document.getElementById("viewport").classList.remove("viewport--dimmed");
      }
    }
    audio.playUiToggle(isOpen);
  }

  setSidebarOpen(isOpen) {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    const isCurrentlyOpen = sidebar.classList.contains("sidebar--open");
    if (isOpen === isCurrentlyOpen) return;
    
    if (isOpen) {
      sidebar.classList.add("sidebar--open");
      overlay.classList.add("sidebar-overlay--active");
      document.getElementById("viewport").classList.add("viewport--dimmed");
    } else {
      sidebar.classList.remove("sidebar--open");
      overlay.classList.remove("sidebar-overlay--active");
      if (!document.getElementById("shop-panel").classList.contains("market--open")) {
        document.getElementById("viewport").classList.remove("viewport--dimmed");
      }
    }
    audio.playUiToggle(isOpen);
  }

  setupEventListeners() {
    document.getElementById("btn-start").onclick = (e) => {
      e.stopPropagation();
      audio.init();
      this.applyVolumeSettings();
      document.getElementById("home-screen").classList.add("home-screen--hidden");
    };

    document.getElementById("btn-menu").onclick = (e) => {
      e.stopPropagation();
      this.setSidebarOpen(!document.getElementById("sidebar").classList.contains("sidebar--open"));
    };

    document.getElementById("sidebar-overlay").onclick = () => this.setSidebarOpen(false);

    document.getElementById("btn-theme").onclick = (e) => {
      e.stopPropagation();
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      state.save();
      this.applyTheme();
    };

    // Background Management
    document.getElementById("btn-bg-toggle").onclick = (e) => {
      e.stopPropagation();
      state.bgEnabled = !state.bgEnabled;
      state.save();
      this.applyBackground();
    };

    document.getElementById("btn-bg-upload").onclick = (e) => {
      e.stopPropagation();
      document.getElementById("input-bg-file").click();
    };

    document.getElementById("input-bg-file").onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        state.bgUrl = ev.target.result;
        state.save();
        this.applyBackground();
      };
      reader.readAsDataURL(file);
    };

    document.getElementById("btn-bg-reset").onclick = (e) => {
      e.stopPropagation();
      state.bgUrl = '../../bg.jpg';
      state.save();
      this.applyBackground();
    };

    document.getElementById("shop-toggle").onclick = (e) => {
      e.stopPropagation();
      this.setMarketOpen(!document.getElementById("shop-panel").classList.contains("market--open"));
    };

    document.getElementById("btn-rearrange").onclick = (e) => {
      e.stopPropagation();
      this.rearrangeClusters();
    };

    document.getElementById("slider-bgm").oninput = (e) => {
      const val = parseFloat(e.target.value);
      state.volume.bgm = val;
      audio.setMusicVolume(val);
      state.save();
    };

    document.getElementById("slider-sfx").oninput = (e) => {
      const val = parseFloat(e.target.value);
      state.volume.sfx = val;
      audio.setSfxVolume(val);
      state.save();
    };

    document.getElementById("btn-home").onclick = (e) => {
      e.stopPropagation();
      this.focusOnFirstNode();
    };

    document.getElementById("btn-reset-data").onclick = async (e) => {
      e.stopPropagation();
      const result = await Modal.confirm("WIPE DATA?", "Proceed to delete all progress?");
      if (result) {
        localStorage.removeItem("goinksweeper_data");
        window.location.reload();
      }
    };

    document.getElementById("btn-auto-all").onclick = (e) => {
      e.stopPropagation();
      state.globalAuto = true;
      state.nodes.forEach(n => n.auto = true);
      state.save();
    };

    document.getElementById("btn-auto-none").onclick = (e) => {
      e.stopPropagation();
      state.globalAuto = false;
      state.nodes.forEach(n => n.auto = false);
      state.save();
    };

    this.renderShop();
  }

  rearrangeClusters() {
    state.nodes = PlacementEngine.packNodes(state.nodes);
    state.save();
    this.nodeElements.forEach(el => el.remove());
    this.nodeElements.clear();
    this.focusOnFirstNode();
    audio.playNote(4);
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

  async handleManualReset(node) {
    if (node.status === "active") {
      const penalty = Math.floor(state.getBaseNodeCost(node.type) * 0.05);
      if (state.gp < penalty) {
        await Modal.alert("INSUFFICIENT FUNDS", `Need ${penalty.toLocaleString()} GP.`);
        return;
      }
      state.gp -= penalty;
    }
    this.executeReset(node);
  }

  executeReset(node) {
    if (this.resetTimers.has(node.id)) {
      clearTimeout(this.resetTimers.get(node.id));
      this.resetTimers.delete(node.id);
    }
    GridEngine.generate(node); 
    state.save();
    const el = this.nodeElements.get(node.id);
    if (el) NodeComponent.update(el, node, (n) => this.executeReset(n));
    this.renderShop();
  }

  handleCellClick(node, idx) {
    if (node.status !== "active") return;
    const cell = node.grid[idx];
    if (cell.r) return;

    if (node.revealedCount === 0 && cell.m) {
      cell.m = false;
      GridEngine.generate(node, idx);
    }

    cell.r = true;
    node.revealedCount++;
    const def = NODE_TYPES[node.type];
    let earnedGp = 0;

    if (cell.m) {
      node.status = "goinked";
      audio.playGoink();
      const timer = setTimeout(() => this.executeReset(node), LIFECYCLE.GOINKED_RESET_DELAY);
      this.resetTimers.set(node.id, timer);
    } else {
      earnedGp = def.mult * state.getOwned('manualMult');
      state.gp += earnedGp;
      audio.playNote(cell.v);
      if (cell.v === 0) GridEngine.floodFill(node, idx);
      
      if (node.revealedCount === (node.w * node.h) - node.mines) {
        node.status = "cleared";
        const bonus = def.mult * (node.w * node.h) * 5;
        state.gp += bonus;
        earnedGp += bonus; // Count bonus towards telemetry
        audio.playSuccess(node.type);
        const timer = setTimeout(() => this.executeReset(node), LIFECYCLE.CLEARED_RESET_DELAY);
        this.resetTimers.set(node.id, timer);
      }
    }
    
    // Log telemetry for this action
    telemetry.log(earnedGp, 1);
    
    state.save();
  }

  startLoops() {
    const render = () => {
      // General Stats
      document.getElementById("disp-gp").textContent = Math.floor(state.gp).toLocaleString();
      const accuracy = Autogoinker.getAccuracy(state.getOwned('autoAcc'));
      document.getElementById("disp-acc").textContent = `${(accuracy * 100).toFixed(1)}%`;
      
      // Telemetry Stats
      const rates = telemetry.getRates();
      // GPS: Use no decimals if > 100, else 1 decimal
      const gpsDisplay = rates.gps > 100 ? Math.floor(rates.gps).toLocaleString() : rates.gps.toFixed(1);
      document.getElementById("disp-gps").textContent = gpsDisplay;
      document.getElementById("disp-rps").textContent = rates.rps.toFixed(1);

      const bounds = this.viewport.getVisibleBounds();
      const visibleIds = new Set();
      state.nodes.forEach(node => {
        const w = node.w * CELL_SIZE + node.w + 8;
        const h = node.h * CELL_SIZE + node.h + 36;
        if (node.x + w > bounds.left && node.x < bounds.right && 
            node.y + h > bounds.top && node.y < bounds.bottom) {
          visibleIds.add(node.id);
          let el = this.nodeElements.get(node.id);
          if (!el) {
            el = NodeComponent.createBase(node, (n, i) => this.handleCellClick(n, i));
            this.nodesContainer.appendChild(el);
            this.nodeElements.set(node.id, el);
            el.oncontextmenu = (e) => {
              e.preventDefault(); e.stopPropagation();
              const menuItems = [
                { label: "Re-initialize", danger: true, action: () => this.handleManualReset(node) },
                { label: "Sell Cluster", danger: true, action: async () => {
                    const refund = Math.floor(state.getItemCost(node.type) * 0.4);
                    const ok = await Modal.confirm("SELL CLUSTER?", `Refund: ${refund.toLocaleString()} GP?`);
                    if (ok) { state.removeNode(node.id); audio.playUiToggle(false); this.renderShop(); }
                }}
              ];
              if (state.systemUnlocked) {
                menuItems.unshift({ label: `Auto: ${node.auto ? 'ON' : 'OFF'}`, action: () => { node.auto = !node.auto; state.save(); } });
              }
              ContextMenu.show(e, menuItems);
            };
          }
          NodeComponent.update(el, node, (n) => this.executeReset(n));
        }
      });
      for (const [id, el] of this.nodeElements) { if (!visibleIds.has(id)) { el.remove(); this.nodeElements.delete(id); } }
      requestAnimationFrame(render);
    };
    render();

    const runAuto = () => {
      if (state.systemUnlocked && state.globalAuto) {
        const active = state.nodes.filter(n => n.status === "active" && n.auto);
        if (active.length > 0) {
          const node = active[Math.floor(Math.random() * active.length)];
          const target = Autogoinker.decideMove(node, Autogoinker.getAccuracy(state.getOwned('autoAcc')));
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
    UPGRADE_DEFINITIONS.forEach(u => {
      const owned = state.getOwned(u.id);
      if (u.max && owned >= u.max) return;
      if (!state.systemUnlocked && (u.id === 'autoSpeed' || u.id === 'autoAcc')) return;
      const cost = state.getItemCost(u.id); 
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between">
          <span class="card__title">${u.name}</span>
          <span class="card__cost">${cost.toLocaleString()}</span>
        </div>
        <div class="card__desc">${u.desc}<br><span style="color:var(--color-primary-dim)">Level: ${owned}</span></div>
        <button class="card__buy-btn" ${state.gp < cost ? 'disabled' : ''}>PURCHASE</button>
      `;
      card.querySelector("button").onclick = () => {
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
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center">
          <span class="card__title" style="font-size:0.85rem">${def.name}</span>
          <span class="card__cost">${cost.toLocaleString()}</span>
        </div>
        <div class="card__desc" style="font-size:0.75rem">Dim: ${def.w}x${def.h}<br><span style="color:var(--color-primary-dim)">Owned: ${owned}</span></div>
        <button class="card__buy-btn" ${state.gp < cost ? 'disabled' : ''}>INITIALIZE</button>
      `;
      card.querySelector("button").onclick = () => {
        if (state.gp >= cost) { state.gp -= cost; this.spawnNode(key); this.renderShop(); }
      };
      list.appendChild(card);
    });
  }
}
new GoinksweeperApp();