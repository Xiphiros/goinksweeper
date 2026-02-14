import { state } from "./core/state.js";
import { context } from "./core/gameContext.js";
import {
  NODE_TYPES,
  UPGRADE_DEFINITIONS,
  CELL_SIZE,
} from "./core/constants.js";
import { PlacementEngine } from "./engine/placement.js";
import { audio } from "./engine/audio.js";
import { telemetry } from "./engine/telemetry.js";
import { NodeComponent } from "./ui/nodeComponent.js";
import { ViewportManager } from "./ui/viewport.js";
import { ContextMenu } from "./ui/contextMenu.js";
import { Modal } from "./ui/modal.js";
import { Autogoinker } from "./engine/autogoinker.js";

/**
 * GoinksweeperApp
 * Central View-Controller. Coordinates the simulation worker,
 * state management, and real-time DOM synchronization.
 */
class GoinksweeperApp {
  constructor() {
    this.worker = new Worker(new URL("./engine/worker.js", import.meta.url), {
      type: "module",
    });

    // View Cache to prevent redundant DOM operations
    this.viewCache = {
      gp: -1,
      gps: -1,
      rps: -1,
      acc: -1,
      lastTelemetryUpdate: 0,
    };

    context.setWorker(this.worker);
    context.setUIUpdateCallback(() => this.renderShop());

    this.nodeElements = new Map();
    this.viewport = new ViewportManager(
      document.getElementById("viewport"),
      document.getElementById("world"),
      state,
      () => this.closeOverlays(),
    );

    ContextMenu.init(document.getElementById("ctx-menu"));
    this.nodesContainer = document.getElementById("world");

    // Initialize UI State
    this.applyTheme();
    this.applyBackground();
    this.initWorkerListeners();
    this.setupEventListeners();

    context.syncWorkerConfig();

    // Bootstrap Cluster Lifecycle
    setTimeout(() => {
      if (state.nodes.length === 0) {
        this.spawnNode("tier_a", true);
      } else {
        state.nodes.forEach((node) => this.createNodeElement(node));
        this.focusOnFirstNode();
      }
    }, 100);

    requestAnimationFrame(() => this.updateLoop());
  }

  /**
   * Listens for logic events from the simulation worker.
   */
  initWorkerListeners() {
    this.worker.onmessage = (e) => {
      const { type, data } = e.data;

      switch (type) {
        case "GP_GAIN":
          const amt = Number(data.amount) || 0;
          telemetry.log(amt, 1);
          context.addGP(amt);
          break;
        case "SFX":
          this.handleSfx(data);
          break;
        case "NODE_STATUS":
          this.handleNodeStatusUpdate(data);
          break;
      }
    };
  }

  handleSfx(data) {
    if (data.name === "goink") audio.playGoink();
    else if (data.name === "success") audio.playSuccess(data.tier);
    else if (data.name === "note") audio.playNote(data.value);
  }

  handleNodeStatusUpdate(data) {
    const node = state.nodes.find((n) => n.id === data.nodeId);
    if (!node) return;

    node.status = data.status;
    node.auto = data.auto;
    node.difficulty = data.difficulty;
    node.mines = data.mines;
    node.genId = data.genId;
    state.save();

    const el = this.nodeElements.get(data.nodeId);
    if (el) {
      NodeComponent.updateOverlay(el, node, this.worker);
    }
  }

  applyTheme() {
    document.body.setAttribute("data-theme", state.theme);
    context.syncWorkerConfig();
  }

  applyBackground() {
    const viewport = document.getElementById("viewport");
    if (state.bgEnabled) {
      viewport.classList.remove("viewport--no-bg");
    } else {
      viewport.classList.add("viewport--no-bg");
    }
    document.documentElement.style.setProperty(
      "--dynamic-bg-url",
      `url('${state.bgUrl}')`,
    );
  }

  setupEventListeners() {
    const bootAudio = () => {
      audio.init();
      this.applyVolumeSettings();
    };

    const startBtn = document.getElementById("btn-start");
    if (startBtn) {
      startBtn.onclick = () => {
        document
          .getElementById("home-screen")
          .classList.add("home-screen--hidden");
        bootAudio();
      };
    }

    window.addEventListener("mousedown", bootAudio, { once: true });

    document.getElementById("btn-theme").onclick = (e) => {
      e.stopPropagation();
      state.theme = state.theme === "light" ? "dark" : "light";
      state.save();
      this.applyTheme();
    };

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
      state.bgUrl = "../../bg.jpg";
      state.save();
      this.applyBackground();
    };

    document.getElementById("btn-rearrange").onclick = (e) => {
      e.stopPropagation();
      this.rearrangeClusters();
    };

    document.getElementById("btn-home").onclick = (e) => {
      e.stopPropagation();
      this.focusOnFirstNode();
    };

    // Camera Lock Toggle
    const lockBtn = document.getElementById("btn-lock-view");
    const updateLockIcon = () => {
      const icon = lockBtn.querySelector("i");
      if (state.viewLocked) {
        icon.className = "fa-solid fa-lock";
        lockBtn.classList.add("btn-floating--active");
      } else {
        icon.className = "fa-solid fa-lock-open";
        lockBtn.classList.remove("btn-floating--active");
      }
    };
    updateLockIcon();

    lockBtn.onclick = (e) => {
      e.stopPropagation();
      state.viewLocked = !state.viewLocked;
      state.save();
      updateLockIcon();
      audio.playUiToggle(state.viewLocked);
    };

    const bgmSlider = document.getElementById("slider-bgm");
    const sfxSlider = document.getElementById("slider-sfx");
    bgmSlider.value = state.volume.bgm;
    sfxSlider.value = state.volume.sfx;

    bgmSlider.oninput = (e) => {
      state.volume.bgm = parseFloat(e.target.value);
      audio.setMusicVolume(state.volume.bgm);
      state.save();
    };

    sfxSlider.oninput = (e) => {
      state.volume.sfx = parseFloat(e.target.value);
      audio.setSfxVolume(state.volume.sfx);
      state.save();
    };

    document.getElementById("shop-toggle").onclick = (e) => {
      e.stopPropagation();
      this.setMarketOpen(
        !document
          .getElementById("shop-panel")
          .classList.contains("market--open"),
      );
    };

    document.getElementById("btn-reset-data").onclick = async () => {
      if (await Modal.confirm("WIPE DATA?", "Delete everything?")) {
        localStorage.removeItem("goinksweeper_data");
        location.reload();
      }
    };

    document.getElementById("btn-menu").onclick = (e) => {
      e.stopPropagation();
      this.setSidebarOpen(
        !document.getElementById("sidebar").classList.contains("sidebar--open"),
      );
    };

    document.getElementById("sidebar-overlay").onclick = () =>
      this.setSidebarOpen(false);

    document.getElementById("btn-auto-all").onclick = () => {
      state.globalAuto = true;
      state.nodes.forEach((n) => {
        this.worker.postMessage({
          type: "TOGGLE_AUTO",
          data: { nodeId: n.id, state: true },
        });
      });
      state.save();
    };

    document.getElementById("btn-auto-none").onclick = () => {
      state.globalAuto = false;
      state.nodes.forEach((n) => {
        this.worker.postMessage({
          type: "TOGGLE_AUTO",
          data: { nodeId: n.id, state: false },
        });
      });
      state.save();
    };

    this.renderShop();
  }

  applyVolumeSettings() {
    audio.setMusicVolume(state.volume.bgm);
    audio.setSfxVolume(state.volume.sfx);
  }

  /**
   * updateLoop
   * 60FPS synchronization engine between state and view.
   */
  updateLoop() {
    const now = performance.now();

    // 1. Currency & Affordability Synchronization
    const currentGP = Math.floor(state.gp);
    if (this.viewCache.gp !== currentGP) {
      document.getElementById("disp-gp").textContent =
        currentGP.toLocaleString();
      this.viewCache.gp = currentGP;

      const buyBtns = document.querySelectorAll(".card__buy-btn[data-cost]");
      buyBtns.forEach((btn) => {
        const cost = parseInt(btn.getAttribute("data-cost"), 10);
        btn.disabled = currentGP < cost;
      });
    }

    // 2. Accuracy Tracking
    const accLevel = state.getOwned("autoAcc");
    const accVal = (Autogoinker.getAccuracy(accLevel) * 100).toFixed(1);
    if (this.viewCache.acc !== accVal) {
      document.getElementById("disp-acc").textContent = `${accVal}%`;
      this.viewCache.acc = accVal;
    }

    // 3. Throttled Telemetry Sync (10Hz)
    if (now - this.viewCache.lastTelemetryUpdate > 100) {
      const rates = telemetry.getRates();

      const gpsVal =
        rates.gps > 100 ? Math.floor(rates.gps) : Number(rates.gps.toFixed(1));
      if (this.viewCache.gps !== gpsVal) {
        document.getElementById("disp-gps").textContent =
          gpsVal.toLocaleString();
        this.viewCache.gps = gpsVal;
      }

      const rpsVal = Number(rates.rps.toFixed(1));
      if (this.viewCache.rps !== rpsVal) {
        document.getElementById("disp-rps").textContent = rpsVal;
        this.viewCache.rps = rpsVal;
      }
      this.viewCache.lastTelemetryUpdate = now;
    }

    // 4. Transform Sync
    if (
      this._lastScale !== state.view.scale ||
      this._lastTheme !== state.theme
    ) {
      context.syncWorkerConfig();
      this._lastScale = state.view.scale;
      this._lastTheme = state.theme;
    }

    // 5. Spatial Culling & Overlay Sync
    const bounds = this.viewport.getVisibleBounds();
    state.nodes.forEach((node) => {
      const el = this.nodeElements.get(node.id);
      if (el) {
        const visible = this.isNodeVisible(node, bounds);
        if (el.style.display !== (visible ? "flex" : "none")) {
          el.style.display = visible ? "flex" : "none";
        }
        if (visible) NodeComponent.updateOverlay(el, node, this.worker);
      } else if (this.isNodeVisible(node, bounds)) {
        this.createNodeElement(node);
      }
    });

    requestAnimationFrame(() => this.updateLoop());
  }

  isNodeVisible(node, bounds) {
    const w = node.w * CELL_SIZE + node.w + 8;
    const h = node.h * CELL_SIZE + node.h + 36;
    return (
      node.x + w > bounds.left &&
      node.x < bounds.right &&
      node.y + h > bounds.top &&
      node.y < bounds.bottom
    );
  }

  spawnNode(typeKey, bypassCost = false) {
    const def = NODE_TYPES[typeKey];
    const pos = PlacementEngine.findPosition(def.w, def.h, state.nodes);
    const node = context.purchaseNode(typeKey, pos.x, pos.y, bypassCost);
    if (node) {
      this.createNodeElement(node);
      this.viewport.centerOn(
        node.x,
        node.y,
        node.w * CELL_SIZE,
        node.h * CELL_SIZE + 24,
      );
    }
  }

  createNodeElement(node) {
    if (this.nodeElements.has(node.id)) return this.nodeElements.get(node.id);
    const el = NodeComponent.createBase(node, this.worker, (e, n, cellIdx) => {
      this.handleContextMenu(e, node, cellIdx);
    });
    this.nodesContainer.appendChild(el);
    this.nodeElements.set(node.id, el);
    return el;
  }

  handleContextMenu(e, node, cellIdx) {
    const activeNode = state.nodes.find((sn) => sn.id === node.id);
    const menuItems = [];
    if (cellIdx !== -1) {
      menuItems.push({
        label: `Toggle Flag (F)`,
        action: () =>
          this.worker.postMessage({
            type: "TOGGLE_FLAG",
            data: { nodeId: node.id, cellIdx },
          }),
      });
    }
    menuItems.push({
      label: "Re-initialize",
      danger: true,
      action: () =>
        this.worker.postMessage({
          type: "RESET_NODE",
          data: { nodeId: node.id },
        }),
    });
    menuItems.push({
      label: "Sell Cluster",
      danger: true,
      action: async () => {
        const refund = Math.floor(state.getItemCost(node.type) * 0.4);
        if (
          await Modal.confirm(
            "SELL CLUSTER?",
            `Refund: ${refund.toLocaleString()} GP?`,
          )
        ) {
          this.removeNode(node.id);
        }
      },
    });
    if (state.systemUnlocked) {
      menuItems.unshift({
        label: `Auto: ${activeNode.auto ? "ON" : "OFF"}`,
        action: () =>
          this.worker.postMessage({
            type: "TOGGLE_AUTO",
            data: { nodeId: node.id, state: !activeNode.auto },
          }),
      });
    }
    ContextMenu.show(e, menuItems);
  }

  removeNode(nodeId) {
    const index = state.nodes.findIndex((n) => n.id === nodeId);
    if (index === -1) return;
    const node = state.nodes[index];
    context.addGP(Math.floor(state.getItemCost(node.type) * 0.4));
    state.nodes.splice(index, 1);
    if (state.registry[node.type] > 0) state.registry[node.type]--;
    this.worker.postMessage({ type: "KILL_NODE", data: { nodeId } });
    const el = this.nodeElements.get(nodeId);
    if (el) el.remove();
    this.nodeElements.delete(nodeId);
    state.save();
    this.renderShop();
  }

  rearrangeClusters() {
    state.nodes = PlacementEngine.packNodes(state.nodes);
    state.save();
    state.nodes.forEach((n) => {
      const el = this.nodeElements.get(n.id);
      if (el) {
        el.style.left = `${n.x}px`;
        el.style.top = `${n.y}px`;
      }
    });
    audio.playNote(4);
  }

  focusOnFirstNode() {
    this.viewport.centerOn(0, 0, 400, 400);
  }
  closeOverlays() {
    this.setMarketOpen(false);
    this.setSidebarOpen(false);
  }

  setMarketOpen(isOpen) {
    const p = document.getElementById("shop-panel");
    const wasOpen = p.classList.contains("market--open");
    if (wasOpen === isOpen) return;

    if (isOpen) {
      p.classList.add("market--open");
      this.renderShop();
    } else {
      p.classList.remove("market--open");
    }
    audio.playUiToggle(isOpen);
  }

  setSidebarOpen(isOpen) {
    const s = document.getElementById("sidebar");
    const o = document.getElementById("sidebar-overlay");
    const wasOpen = s.classList.contains("sidebar--open");
    if (wasOpen === isOpen) return;

    if (isOpen) {
      s.classList.add("sidebar--open");
      o.classList.add("sidebar-overlay--active");
    } else {
      s.classList.remove("sidebar--open");
      o.classList.remove("sidebar-overlay--active");
    }
    audio.playUiToggle(isOpen);
  }

  renderShop() {
    const list = document.getElementById("shop-list");
    list.innerHTML = "";
    UPGRADE_DEFINITIONS.forEach((u) => {
      const owned = state.getOwned(u.id);
      if (u.max && owned >= u.max) return;
      // Filter out auto upgrades if system isn't unlocked
      if (
        !state.systemUnlocked &&
        (u.id === "autoSpeed" || u.id === "autoAcc" || u.id === "autoReboot")
      )
        return;
      const cost = state.getItemCost(u.id);
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between">
          <span class="card__title">${u.name}</span>
          <span class="card__cost">${cost.toLocaleString()}</span>
        </div>
        <div class="card__desc">${u.desc}<br><span style="color:var(--color-primary-dim)">Level: ${owned}</span></div>
        <button class="card__buy-btn" data-cost="${cost}" ${state.gp < cost ? "disabled" : ""}>PURCHASE</button>
      `;
      card.querySelector("button").onclick = () =>
        context.purchaseUpgrade(u.id);
      list.appendChild(card);
    });

    const nodeHeader = document.createElement("div");
    nodeHeader.className = "market__header";
    nodeHeader.style.border = "none";
    nodeHeader.style.marginTop = "20px";
    nodeHeader.innerText = "CLUSTER EXPANSION";
    list.appendChild(nodeHeader);

    Object.keys(NODE_TYPES).forEach((key) => {
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
        <button class="card__buy-btn" data-cost="${cost}" ${state.gp < cost ? "disabled" : ""}>INITIALIZE</button>
      `;
      card.querySelector("button").onclick = () => this.spawnNode(key);
      list.appendChild(card);
    });
  }
}

new GoinksweeperApp();