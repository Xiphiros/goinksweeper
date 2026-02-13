/**
 * Autogoinker manages the decision-making logic for automated playfields.
 */
export class Autogoinker {
  /**
   * Calculates interval between actions. 
   * Scales from ~2s down to ~100ms based on speed level.
   */
  static getInterval(speedLevel) {
    return Math.max(100, 2000 * Math.pow(0.82, speedLevel - 1));
  }

  /**
   * Fidelity Calibration:
   * Starts at 5% (Level 1) - nearly random, mimics a malfunctioning script.
   * Caps at 99.0% (theoretical limit).
   * Progresses exponentially so early levels feel impactful but perfection is expensive.
   */
  static getAccuracy(accLevel) {
    const minFidelity = 0.05; 
    const maxFidelity = 0.99;
    
    // Decay constant: determines how many levels it takes to reach peak performance.
    // 0.90 means each level closes 10% of the remaining distance to 99%.
    const decay = 0.90; 
    
    const progress = 1 - Math.pow(decay, accLevel - 1);
    return minFidelity + (maxFidelity - minFidelity) * progress;
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
        
      // Fallback: If no safe cells are logically identifiable, take any unrevealed cell.
      if (candidates.length === 0) {
        candidates = node.grid
          .map((c, i) => (!c.r ? i : -1))
          .filter(i => i !== -1);
      }
    } else {
      // Logic Failure: Random guess among all unrevealed cells (dangerous)
      candidates = node.grid
        .map((c, i) => (!c.r ? i : -1))
        .filter(i => i !== -1);
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}