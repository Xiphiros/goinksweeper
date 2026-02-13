import { NODE_TYPES, UPGRADE_DEFINITIONS } from './constants.js';

export class StateStore {
  constructor() {
    this.gp = 0;
    this.registry = {}; 
    this.globalAuto = true;
    this.theme = 'light';
    this.bgEnabled = true;
    this.bgUrl = '../../bg.jpg'; // Default value
    
    this.volume = {
      bgm: 0.5,
      sfx: 1.0
    };

    this.view = { x: -100, y: -100, scale: 1 };
    this.nodes = [];
    this.nextId = 0;
    
    this.load();
  }

  getOwned(id) {
    const count = this.registry[id] || 0;
    const defaults = {
      manualMult: 1,
      autoSpeed: 1,
      autoAcc: 1
    };
    return count || (defaults[id] || 0);
  }

  get systemUnlocked() {
    return this.getOwned('auto_unlock') > 0;
  }

  save() {
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
      nodes: this.nodes.map(n => ({
        id: n.id, type: n.type, x: n.x, y: n.y, w: n.w, h: n.h,
        mines: n.mines, grid: n.grid, status: n.status,
        revealedCount: n.revealedCount, auto: n.auto
      }))
    };
    try {
      localStorage.setItem("goinksweeper_data", JSON.stringify(data));
    } catch (e) {
      console.warn("Storage quota exceeded. Custom background might be too large.");
    }
  }

  load() {
    const save = localStorage.getItem("goinksweeper_data");
    if (!save) return;
    try {
      const loaded = JSON.parse(save);
      this.gp = loaded.gp || 0;
      this.registry = loaded.registry || {};
      this.globalAuto = loaded.globalAuto !== undefined ? loaded.globalAuto : true;
      this.theme = loaded.theme || 'light';
      this.bgEnabled = loaded.bgEnabled !== undefined ? loaded.bgEnabled : true;
      this.bgUrl = loaded.bgUrl || '../../bg.jpg';
      
      if (loaded.volume) {
        this.volume = loaded.volume;
      }

      this.view = loaded.view || this.view;
      this.nextId = loaded.nextId || 0;
      this.nodes = (loaded.nodes || []).map(n => {
        const def = NODE_TYPES[n.type];
        return { ...n, w: n.w || def.w, h: n.h || def.h, mines: n.mines || def.m };
      });
    } catch (e) {
      console.error("Hydration Failure:", e);
    }
  }

  calculateCost(base, scale, currentCount) {
    return Math.floor(base * Math.pow(scale, currentCount));
  }

  getBaseNodeCost(typeKey) {
    const def = NODE_TYPES[typeKey];
    return def ? def.cost : 0;
  }

  getItemCost(id) {
    const upg = UPGRADE_DEFINITIONS.find(u => u.id === id);
    if (upg) {
      if (id === 'auto_unlock') return upg.base;
      const currentLevel = this.getOwned(id);
      return this.calculateCost(upg.base, upg.scale, currentLevel - 1);
    }

    const nodeDef = NODE_TYPES[id];
    if (nodeDef) {
      const count = this.getOwned(id);
      const scaling = id === 'tier_a' ? 1.15 : 1.35;
      return this.calculateCost(nodeDef.cost, scaling, count);
    }
    return 0;
  }

  recordPurchase(id) {
    this.registry[id] = (this.registry[id] || 0) + 1;
    this.save();
  }

  removeNode(nodeId) {
    const index = this.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return;
    const node = this.nodes[index];
    const typeKey = node.type;
    const refund = Math.floor(this.getItemCost(typeKey) * 0.4);
    this.gp += refund;
    this.nodes.splice(index, 1);
    if (this.registry[typeKey] > 0) this.registry[typeKey]--;
    this.save();
  }

  addNode(typeKey, x, y) {
    const def = NODE_TYPES[typeKey];
    const node = {
      id: this.nextId++,
      type: typeKey, x, y, w: def.w, h: def.h, mines: def.m,
      grid: [], status: "active", revealedCount: 0, auto: false 
    };
    this.nodes.push(node);
    this.recordPurchase(typeKey);
    return node;
  }
}

export const state = new StateStore();