export const CELL_SIZE = 20;
export const CHUNK_SIZE = 1000;

export const LIFECYCLE = {
  CLEARED_RESET_DELAY: 2500,
  GOINKED_RESET_DELAY: 4000,
};

export const AUDIO_CONFIG = {
  SCALE: [130.81, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25],
  WAVEFORM: "triangle",
  BASE_GAIN: 0.15,
};

/**
 * Difficulty Configuration
 * Density: Percentage of cells that are mines.
 * Mult: Bonus applied to GP earned on field clear.
 */
export const DIFFICULTIES = {
  EASY: { id: "EASY", density: 0.1, mult: 1.0, color: "#2dce89" },
  MEDIUM: { id: "MEDIUM", density: 0.16, mult: 2.5, color: "#00b4d8" },
  HARD: { id: "HARD", density: 0.25, mult: 6.0, color: "#ff9f43" },
  GOINK: { id: "GOINK", density: 0.42, mult: 20.0, color: "#ff4d6d" },
};

export const NODE_TYPES = {
  tier_a: {
    w: 10,
    h: 10,
    m: 12,
    cost: 50,
    mult: 1,
    name: "Type-A: Initial Cluster",
    desc: "Standard entry point.",
  },
  tier_b: {
    w: 16,
    h: 16,
    m: 40,
    cost: 750,
    mult: 5,
    name: "Type-B: Linear Relay",
    desc: "Sustained stability.",
  },
  tier_c: {
    w: 16,
    h: 30,
    m: 99,
    cost: 7500,
    mult: 15,
    name: "Type-C: Direct Interface",
    desc: "Vertical precision stack.",
  },
  tier_d: {
    w: 24,
    h: 24,
    m: 135,
    cost: 35000,
    mult: 40,
    name: "Type-D: Balsamic Array",
    desc: "High-viscosity data stream.",
  },
  tier_e: {
    w: 30,
    h: 24,
    m: 180,
    cost: 150000,
    mult: 100,
    name: "Type-E: TAG-IV Module",
    desc: "Complex logic patterns.",
  },
  tier_f: {
    w: 30,
    h: 30,
    m: 225,
    cost: 1000000,
    mult: 350,
    name: "Type-F: Unfathomable",
    desc: "Extreme scale module.",
  },
  tier_g: {
    w: 40,
    h: 40,
    m: 480,
    cost: 10000000,
    mult: 1500,
    name: "Type-G: Singularity",
    desc: "Absolute density.",
  },
};

export const UPGRADE_DEFINITIONS = [
  {
    id: "auto_unlock",
    name: "Initialize Autogoinker",
    base: 500,
    scale: 1,
    max: 1,
    desc: "Unlock automation modules.",
  },
  {
    id: "manualMult",
    name: "Manual Efficiency",
    base: 100,
    scale: 1.6,
    desc: "Multiply GP from manual clicks.",
  },
  {
    id: "autoSpeed",
    name: "Autogoinker Speed",
    base: 750,
    scale: 1.5,
    desc: "Reduces delay between automated actions.",
  },
  {
    id: "autoAcc",
    name: "Autogoinker Logic",
    base: 1000,
    scale: 1.8,
    desc: "Increases probability of safe cell selection.",
  },
  {
    id: "autoReboot",
    name: "Cycle Optimizer",
    base: 2000,
    scale: 1.7,
    desc: "Reduces downtime after board completion.",
  },
];