import { state } from "./core/state.js";
import {
  NODE_TYPES,
  UPGRADE_DEFINITIONS,
  CELL_SIZE,
} from "./core/constants.js";
import { PlacementEngine } from "./engine/placement.js";
import { Autogoinker } from "./engine/autogoinker.js";
import { audio } from "./engine/audio.js";
import { telemetry } from "./engine/telemetry.js";
import { NodeComponent } from "./ui/nodeComponent.js";
import { ViewportManager } from "./ui/viewport.js";
import { ContextMenu } from "./ui/contextMenu.js";
import { Modal } from "./ui/modal.js";

class GoinksweeperApp {
  constructor() {
    this.worker = new Worker(new URL("./engine/worker.js", import.meta.url), {
      type: "module",
    });
    this.nodeElements = new Map();

    this.viewport = new ViewportManager(
      document.getElementById("viewport"),
      document.getElementById("world"),
      state,
      () => this.closeOverlays(),
    );

    ContextMenu.init(document.getElementById("ctx-menu"));
    this.nodesContainer = document.getElementById("world");

    this.applyTheme();
    this.applyBackground();
    this.initWorkerListeners();
    this.setupEventListeners();
    this.syncWorkerConfig();

    setTimeout(() => {
      if (state.nodes.length === 0) {
        this.spawnNode("tier_a");
      } else {
        this.focusOnFirstNode();
      }
    }, 100);

    requestAnimationFrame(() => this.updateLoop());
  }

  initWorkerListeners() {
    this.worker.onmessage = (e) => {
      const { type, data } = e.data;

      if (type === "GP_GAIN") {
        state.gp += data.amount;
        telemetry.log(data.amount, 1);
      } else if (type === "SFX") {
        if (data.name === "goink") audio.playGoink();
        if (data.name === "success") audio.playSuccess(data.tier);
        if (data.name === "note") audio.playNote(data.value);
      } else if (type === "NODE_STATUS") {
        const node = state.nodes.find((n) => n.id === data.nodeId);
        if (node) {
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
      }
    };
  }

  applyTheme() {
    document.body.setAttribute("data-theme", state.theme);
    this.syncWorkerConfig();
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

    document.getElementById("btn-start").onclick = () => {
      document
        .getElementById("home-screen")
        .classList.add("home-screen--hidden");
      bootAudio();
    };

    window.addEventListener("mousedown", bootAudio, { once: true });
    window.addEventListener("keydown", bootAudio, { once: true });

    // Global listener to close custom selects
    window.addEventListener("mousedown", () => {
      document
        .querySelectorAll(".goink-select--open")
        .forEach((s) => s.classList.remove("goink-select--open"));
    });

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

    const bgmSlider = document.getElementById("slider-bgm");
    const sfxSlider = document.getElementById("slider-sfx");
    bgmSlider.value = state.volume.bgm;
    sfxSlider.value = state.volume.sfx;

    bgmSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      state.volume.bgm = val;
      audio.setMusicVolume(val);
      state.save();
    };

    sfxSlider.oninput = (e) => {
      const val = parseFloat(e.target.value);
      state.volume.sfx = val;
      audio.setSfxVolume(val);
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

  spawnNode(typeKey) {
    const def = NODE_TYPES[typeKey];
    const pos = PlacementEngine.findPosition(def.w, def.h, state.nodes);
    const node = state.addNode(typeKey, pos.x, pos.y);
    node.difficulty = "MEDIUM";
    const el = this.createNodeElement(node);
    state.save();
    this.viewport.centerOn(
      node.x,
      node.y,
      node.w * CELL_SIZE,
      node.h * CELL_SIZE + 24,
    );
    this.renderShop();
  }

  createNodeElement(node) {
    if (this.nodeElements.has(node.id)) return this.nodeElements.get(node.id);

    const el = NodeComponent.createBase(node, this.worker, (e, n) => {
      const activeNode = state.nodes.find((sn) => sn.id === node.id);

      const menuItems = [
        {
          label: "Re-initialize",
          danger: true,
          action: () => {
            this.worker.postMessage({
              type: "RESET_NODE",
              data: { nodeId: node.id },
            });
          },
        },
        {
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
        },
      ];

      if (state.systemUnlocked) {
        menuItems.unshift({
          label: `Auto: ${activeNode.auto ? "ON" : "OFF"}`,
          action: () => {
            this.worker.postMessage({
              type: "TOGGLE_AUTO",
              data: { nodeId: node.id, state: !activeNode.auto },
            });
          },
        });
      }
      ContextMenu.show(e, menuItems);
    });

    this.nodesContainer.appendChild(el);
    this.nodeElements.set(node.id, el);
    return el;
  }

  removeNode(id) {
    state.removeNode(id);
    this.worker.postMessage({ type: "KILL_NODE", data: { nodeId: id } });
    const el = this.nodeElements.get(id);
    if (el) el.remove();
    this.nodeElements.delete(id);
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

  syncWorkerConfig() {
    const s = getComputedStyle(document.body);
    const accLevel = state.getOwned("autoAcc");
    const speedLevel = state.getOwned("autoSpeed");

    this.worker.postMessage({
      type: "SYNC_CONFIG",
      data: {
        scale: state.view.scale,
        accuracy: Autogoinker.getAccuracy(accLevel),
        speed: Autogoinker.getInterval(speedLevel),
        colors: {
          surface: s.getPropertyValue("--color-surface").trim(),
          surfaceAlt: s.getPropertyValue("--color-surface-alt").trim(),
          primary: s.getPropertyValue("--color-primary").trim(),
          danger: s.getPropertyValue("--color-danger").trim(),
          blue: s.getPropertyValue("--color-accent-blue").trim(),
          green: s.getPropertyValue("--color-accent-green").trim(),
          purple: "#9b5de5",
        },
      },
    });
  }

  updateLoop() {
    document.getElementById("disp-gp").textContent = Math.floor(
      state.gp,
    ).toLocaleString();

    const accuracy = Autogoinker.getAccuracy(state.getOwned("autoAcc"));
    document.getElementById("disp-acc").textContent =
      `${(accuracy * 100).toFixed(1)}%`;

    const rates = telemetry.getRates();
    const gpsDisplay =
      rates.gps > 100
        ? Math.floor(rates.gps).toLocaleString()
        : rates.gps.toFixed(1);
    document.getElementById("disp-gps").textContent = gpsDisplay;
    document.getElementById("disp-rps").textContent = rates.rps.toFixed(1);

    if (
      this._lastScale !== state.view.scale ||
      this._lastTheme !== state.theme
    ) {
      this.syncWorkerConfig();
      this._lastScale = state.view.scale;
      this._lastTheme = state.theme;
    }

    const bounds = this.viewport.getVisibleBounds();

    state.nodes.forEach((node) => {
      if (!this.nodeElements.has(node.id)) {
        if (this.isNodeVisible(node, bounds)) {
          this.createNodeElement(node);
        }
      }

      const el = this.nodeElements.get(node.id);
      if (el) {
        const visible = this.isNodeVisible(node, bounds);
        if (visible) {
          el.style.display = "flex";
          NodeComponent.updateOverlay(el, node, this.worker);
        } else {
          el.style.display = "none";
        }
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

  focusOnFirstNode() {
    this.viewport.centerOn(0, 0, 400, 400);
  }
  closeOverlays() {
    this.setMarketOpen(false);
    this.setSidebarOpen(false);
  }
  setMarketOpen(isOpen) {
    const p = document.getElementById("shop-panel");
    if (isOpen) {
      p.classList.add("market--open");
      this.renderShop();
    } else p.classList.remove("market--open");
  }
  setSidebarOpen(isOpen) {
    const s = document.getElementById("sidebar");
    const o = document.getElementById("sidebar-overlay");
    if (isOpen) {
      s.classList.add("sidebar--open");
      o.classList.add("sidebar-overlay--active");
    } else {
      s.classList.remove("sidebar--open");
      o.classList.remove("sidebar-overlay--active");
    }
  }

  renderShop() {
    const list = document.getElementById("shop-list");
    list.innerHTML = "";

    UPGRADE_DEFINITIONS.forEach((u) => {
      const owned = state.getOwned(u.id);
      if (u.max && owned >= u.max) return;
      if (!state.systemUnlocked && (u.id === "autoSpeed" || u.id === "autoAcc"))
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
        <button class="card__buy-btn" ${state.gp < cost ? "disabled" : ""}>PURCHASE</button>
      `;
      card.querySelector("button").onclick = () => {
        if (state.gp >= cost) {
          state.gp -= cost;
          state.recordPurchase(u.id);
          this.syncWorkerConfig();
          this.renderShop();
        }
      };
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
        <button class="card__buy-btn" ${state.gp < cost ? "disabled" : ""}>INITIALIZE</button>
      `;
      card.querySelector("button").onclick = () => {
        if (state.gp >= cost) {
          state.gp -= cost;
          this.spawnNode(key);
        }
      };
      list.appendChild(card);
    });
  }
}

new GoinksweeperApp();
