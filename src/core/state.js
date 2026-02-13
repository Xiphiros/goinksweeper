import { NODE_TYPES, UPGRADE_DEFINITIONS } from "./constants.js";

/**
 * StateStore
 * Pure data repository responsible for persistence and hydration.
 */
export class StateStore {
  constructor() {
    // Starting capital set to 50 to allow initial Tier-A cluster purchase.
    this.gp = 50;
    this.registry = {};
    this.globalAuto = true;
    this.theme = "light";
    this.bgEnabled = true;
    this.bgUrl = "../../bg.jpg";

    this.volume = {
      bgm: 0.5,
      sfx: 1.0,
    };

    this.view = { x: -100, y: -100, scale: 1 };
    this.nodes = [];
    this.nextId = 0;

    this.saveTimeout = null;
    this.load();
  }

  getOwned(id) {
    const count = this.registry[id] || 0;
    const defaults = {
      manualMult: 1,
      autoSpeed: 1,
      autoAcc: 1,
    };
    return count || defaults[id] || 0;
  }

  get systemUnlocked() {
    return this.getOwned("auto_unlock") > 0;
  }

  save() {
    if (this.saveTimeout) return;

    this.saveTimeout = setTimeout(() => {
      this.forceSave();
      this.saveTimeout = null;
    }, 1000);
  }

  forceSave() {
    const data = {
      gp: this.gp,
      registry: this.registry,
      globalAuto: this.globalAuto,
      theme: this.theme,
      bgEnabled: this.bgEnabled,
      bgUrl: this.bgUrl,
      volume: this.volume,
      view: this.view,
      nextId: this.nextId,
      nodes: this.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.h,
        mines: n.mines,
        grid: n.grid,
        status: n.status,
        revealedCount: n.revealedCount,
        auto: n.auto,
        difficulty: n.difficulty,
      })),
    };
    try {
      localStorage.setItem("goinksweeper_data", JSON.stringify(data));
    } catch (e) {
      console.warn("Storage quota exceeded.");
    }
  }

  load() {
    const save = localStorage.getItem("goinksweeper_data");
    if (!save) return;
    try {
      const loaded = JSON.parse(save);
      this.gp = loaded.gp !== undefined ? loaded.gp : 50;
      this.registry = loaded.registry || {};
      this.globalAuto =
        loaded.globalAuto !== undefined ? loaded.globalAuto : true;
      this.theme = loaded.theme || "light";
      this.bgEnabled = loaded.bgEnabled !== undefined ? loaded.bgEnabled : true;
      this.bgUrl = loaded.bgUrl || "../../bg.jpg";

      if (loaded.volume) {
        this.volume = loaded.volume;
      }

      this.view = loaded.view || this.view;
      this.nextId = loaded.nextId || 0;
      this.nodes = (loaded.nodes || []).map((n) => {
        const def = NODE_TYPES[n.type];
        return {
          ...n,
          w: n.w || def.w,
          h: n.h || def.h,
          mines: n.mines || def.m,
          difficulty: n.difficulty || "MEDIUM",
          dirty: true,
        };
      });
    } catch (e) {
      console.error("Hydration Failure:", e);
    }
  }

  calculateCost(base, scale, currentCount) {
    return Math.floor(base * Math.pow(scale, currentCount));
  }

  getItemCost(id) {
    const upg = UPGRADE_DEFINITIONS.find((u) => u.id === id);
    if (upg) {
      if (id === "auto_unlock") return upg.base;
      const currentLevel = this.getOwned(id);
      return this.calculateCost(upg.base, upg.scale, currentLevel - 1);
    }

    const nodeDef = NODE_TYPES[id];
    if (nodeDef) {
      const count = this.getOwned(id);
      const scaling = id === "tier_a" ? 1.15 : 1.35;
      return this.calculateCost(nodeDef.cost, scaling, count);
    }
    return 0;
  }
}

export const state = new StateStore();
