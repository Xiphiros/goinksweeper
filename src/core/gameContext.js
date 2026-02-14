import { state } from "./state.js";
import { NODE_TYPES, UPGRADE_DEFINITIONS } from "./constants.js";
import { Autogoinker } from "../engine/autogoinker.js";

/**
 * GameContext
 * Central mediator that orchestrates data flow between components.
 */
export class GameContext {
  constructor() {
    this.worker = null;
    this.uiUpdateCallback = null;
    this.uiUpdatePending = false;
  }

  setWorker(worker) {
    this.worker = worker;
  }

  setUIUpdateCallback(callback) {
    this.uiUpdateCallback = callback;
  }

  purchaseUpgrade(upgradeId) {
    const cost = state.getItemCost(upgradeId);
    if (state.gp < cost) return false;

    state.gp -= cost;
    state.registry[upgradeId] = (state.registry[upgradeId] || 0) + 1;
    
    state.save();
    this.syncWorkerConfig();
    this.refreshUI(); // Costs change on purchase, so we must rebuild DOM
    return true;
  }

  purchaseNode(typeKey, x, y, bypassCost = false) {
    const def = NODE_TYPES[typeKey];
    const cost = state.getItemCost(typeKey);
    
    if (!bypassCost && state.gp < cost) return null;

    if (!bypassCost) {
      state.gp -= cost;
    }

    const node = {
      id: state.nextId++,
      type: typeKey,
      x,
      y,
      w: def.w,
      h: def.h,
      mines: def.m,
      grid: [],
      status: "active",
      revealedCount: 0,
      auto: state.globalAuto && state.systemUnlocked,
      difficulty: "MEDIUM",
      dirty: true,
    };

    state.nodes.push(node);
    state.registry[typeKey] = (state.registry[typeKey] || 0) + 1;
    
    state.save();
    this.refreshUI(); // Costs change on purchase, so we must rebuild DOM
    return node;
  }

  syncWorkerConfig() {
    if (!this.worker) return;

    const s = getComputedStyle(document.body);
    const accLevel = state.getOwned("autoAcc");
    const speedLevel = state.getOwned("autoSpeed");
    const rebootLevel = state.getOwned("autoReboot");

    this.worker.postMessage({
      type: "SYNC_CONFIG",
      data: {
        scale: state.view.scale,
        accuracy: Autogoinker.getAccuracy(accLevel),
        speed: Autogoinker.getInterval(speedLevel),
        rebootLevel: rebootLevel,
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

  refreshUI() {
    if (this.uiUpdatePending) return;
    
    this.uiUpdatePending = true;
    requestAnimationFrame(() => {
      if (this.uiUpdateCallback) {
        this.uiUpdateCallback();
      }
      this.uiUpdatePending = false;
    });
  }

  /**
   * Optimized: Pure state mutation.
   * Does NOT trigger DOM updates. The main loop handles text updates.
   */
  addGP(amount) {
    state.gp += amount;
  }
}

export const context = new GameContext();