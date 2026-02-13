/**
 * TelemetryEngine
 * Tracks event density over a sliding time window to calculate
 * accurate "Per Second" metrics.
 */
export class TelemetryEngine {
  constructor() {
    this.history = []; 
    this.windowSize = 3000; // 3 seconds
  }

  log(gp, ops) {
    this.history.push({
      t: performance.now(),
      gp: Number(gp) || 0,
      ops: Number(ops) || 0
    });
  }

  getRates() {
    const now = performance.now();
    const cutoff = now - this.windowSize;

    // 1. Prune old events (efficiently)
    // Find the index of the first event INSIDE the window
    let splitIndex = -1;
    for (let i = 0; i < this.history.length; i++) {
      if (this.history[i].t >= cutoff) {
        splitIndex = i;
        break;
      }
    }

    if (splitIndex === -1) {
      // All events are old, or empty
      // If we found nothing >= cutoff, and list has items, they are all old.
      if (this.history.length > 0) this.history = [];
      return { gps: 0, rps: 0 };
    }

    // Remove everything before splitIndex
    if (splitIndex > 0) {
      this.history.splice(0, splitIndex);
    }

    // 2. Aggregate
    let totalGp = 0;
    let totalOps = 0;
    
    // Cache length for speed
    const len = this.history.length;
    for (let i = 0; i < len; i++) {
      const e = this.history[i];
      totalGp += e.gp;
      totalOps += e.ops;
    }

    if (len === 0) return { gps: 0, rps: 0 };

    // 3. Calculate Divisor
    // If the history spans less than windowSize (ramp-up), use the actual span.
    // Otherwise use windowSize.
    const oldestT = this.history[0].t;
    const timeSpan = now - oldestT;
    
    // Clamp divisor to minimum 1s to prevent astronomical numbers on first click
    // But allow it to scale up to windowSize (3s)
    const effectiveSeconds = Math.max(1, Math.min(timeSpan, this.windowSize) / 1000);

    return {
      gps: totalGp / effectiveSeconds,
      rps: totalOps / effectiveSeconds
    };
  }
}

export const telemetry = new TelemetryEngine();