/**
 * TelemetryEngine
 * Tracks event density over a sliding time window to calculate
 * accurate "Per Second" metrics for both human and automated inputs.
 */
export class TelemetryEngine {
  constructor() {
    this.history = []; // { t: timestamp, gp: amount, ops: count }
    this.windowSize = 3000; // 3-second smoothing window for readability
  }

  /**
   * Records a game event.
   * @param {number} gp - Goink Points earned (can be 0).
   * @param {number} ops - Operations performed (usually 1 reveal).
   */
  log(gp, ops) {
    this.history.push({
      t: performance.now(),
      gp: gp,
      ops: ops
    });
  }

  /**
   * Calculates current throughput rates based on the sliding window.
   * @returns {Object} { gps, rps }
   */
  getRates() {
    const now = performance.now();
    const cutoff = now - this.windowSize;

    // Prune old events
    // Optimized: Find index first to avoid repetitive shift operations
    let removeCount = 0;
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].t < cutoff) {
        removeCount++;
      } else {
        break;
      }
    }
    
    if (removeCount > 0) {
      this.history.splice(0, removeCount);
    }

    if (this.history.length === 0) {
      return { gps: 0, rps: 0 };
    }

    // Sum active window
    let totalGp = 0;
    let totalOps = 0;
    
    // We use a simple loop for performance over reduce
    for (let i = 0; i < this.history.length; i++) {
      totalGp += this.history[i].gp;
      totalOps += this.history[i].ops;
    }

    // Normalize to Per-Second
    // If we simply divide by 3 (windowSize/1000), it averages over 3 seconds.
    // However, if the game just started 1 second ago, dividing by 3 would artificially lower the rate.
    // We calculate the actual effective time span for the start of the buffer.
    
    const oldest = this.history[0].t;
    const timeSpan = Math.max(100, now - oldest); // Minimum 100ms to prevent Infinity
    
    // If the buffer is full (spanning ~3s), we divide by the window size for stability.
    // If the buffer is filling up (start of burst), we divide by elapsed time.
    const divisor = (timeSpan > this.windowSize - 100) ? (this.windowSize / 1000) : (timeSpan / 1000);

    return {
      gps: totalGp / divisor,
      rps: totalOps / divisor
    };
  }
}

export const telemetry = new TelemetryEngine();