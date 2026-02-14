/**
 * Autogoinker manages the decision-making logic for automated playfields.
 */
export class Autogoinker {
  /**
   * Calculates the base interval for a SINGLE cluster.
   * Level 1: 2000ms
   * Level 10: ~380ms
   * Level 20: ~50ms
   */
  static getInterval(speedLevel) {
    const level = Math.max(1, speedLevel);
    // Exponential decay: each level reduces the interval.
    // We clamp the floor at 10ms to prevent CPU thermal runaway.
    return Math.max(10, 2000 * Math.pow(0.82, level - 1));
  }

  /**
   * Fidelity Calibration:
   * Level 1: ~5% (Nearly random)
   * Progresses exponentially towards 99%.
   */
  static getAccuracy(accLevel) {
    const level = Math.max(1, accLevel);
    const minFidelity = 0.05; 
    const maxFidelity = 0.99;
    const decay = 0.90; 
    
    const progress = 1 - Math.pow(decay, level - 1);
    return minFidelity + (maxFidelity - minFidelity) * progress;
  }

  /**
   * Calculates the reset delay after a board is cleared or goinked.
   * Reduces the downtime based on upgrade level.
   * Floor is clamped to 500ms to ensure animations resolve.
   */
  static getRebootDelay(rebootLevel, baseDelay) {
    // Default level is 0 if not bought, treat as 1 (no reduction)
    const level = Math.max(0, rebootLevel || 0);
    // Each level reduces delay by ~8%
    const scalar = Math.pow(0.92, level); 
    return Math.max(500, baseDelay * scalar);
  }

  /**
   * Decision Engine:
   * Based on fidelity roll, chooses a guaranteed safe cell or a random unrevealed cell.
   */
  static decideMove(node, accuracy) {
    if (node.status !== "active") return null;

    const isLogicSuccessful = Math.random() < accuracy;
    let candidates = [];

    if (isLogicSuccessful) {
      // High Fidelity: Filter for actual safe cells (non-mine, unrevealed)
      candidates = node.grid
        .map((c, i) => (!c.r && !c.m ? i : -1))
        .filter(i => i !== -1);
        
      if (candidates.length === 0) {
        candidates = node.grid
          .map((c, i) => (!c.r ? i : -1))
          .filter(i => i !== -1);
      }
    } else {
      // Logic Failure: Random guess
      candidates = node.grid
        .map((c, i) => (!c.r ? i : -1))
        .filter(i => i !== -1);
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}