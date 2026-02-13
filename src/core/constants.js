export const CELL_SIZE = 20;
export const CHUNK_SIZE = 1000;

/**
 * Temporal constants for playfield lifecycle.
 */
export const LIFECYCLE = {
  CLEARED_RESET_DELAY: 2500, 
  GOINKED_RESET_DELAY: 4000,  
};

/**
 * Audio Engine Configuration
 * Using a C-Major Pentatonic scale (C, D, E, G, A) to ensure harmony.
 */
export const AUDIO_CONFIG = {
  // Safe cell reveal frequencies (Hz) mapped to neighbor count (0-8)
  SCALE: [
    130.81, // C3 (0 mines)
    261.63, // C4 (1 mine)
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25  // E5 (8 mines)
  ],
  WAVEFORM: 'triangle', // Soft, retro-simulation feel
  BASE_GAIN: 0.15
};

export const NODE_TYPES = {
  tier_a: { w: 10, h: 10, m: 12, cost: 50, mult: 1, name: "Type-A: Initial Cluster", desc: "Standard entry point." },
  tier_b: { w: 16, h: 16, m: 40, cost: 750, mult: 5, name: "Type-B: Linear Relay", desc: "Sustained stability." },
  tier_c: { w: 16, h: 30, m: 99, cost: 7500, mult: 15, name: "Type-C: Direct Interface", desc: "Vertical precision stack." },
  tier_d: { w: 24, h: 24, m: 135, cost: 35000, mult: 40, name: "Type-D: Balsamic Array", desc: "High-viscosity data stream." },
  tier_e: { w: 30, h: 24, m: 180, cost: 150000, mult: 100, name: "Type-E: TAG-IV Module", desc: "Complex logic patterns." },
  tier_f: { w: 30, h: 30, m: 225, cost: 1000000, mult: 350, name: "Type-F: Unfathomable", desc: "Extreme scale module." },
  tier_g: { w: 40, h: 40, m: 480, cost: 10000000, mult: 1500, name: "Type-G: Singularity", desc: "Absolute density." }
};

export const UPGRADE_DEFINITIONS = [
  {
    id: "auto_unlock",
    name: "Initialize Autogoinker",
    base: 500,
    scale: 1,
    max: 1,
    desc: "Unlock automation modules for playfields."
  },
  {
    id: "manualMult",
    name: "Manual Efficiency",
    base: 100,
    scale: 1.6,
    desc: "Multiply GP earned from manual clicks."
  },
  {
    id: "autoSpeed",
    name: "Autogoinker Speed",
    base: 750,
    scale: 1.5,
    desc: "Reduces delay between automated actions."
  },
  {
    id: "autoAcc",
    name: "Autogoinker Logic",
    base: 1000,
    scale: 1.8,
    desc: "Increases probability of safe cell selection."
  },
];