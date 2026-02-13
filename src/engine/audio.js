import { AUDIO_CONFIG } from '../core/constants.js';

/**
 * Singleton Audio Engine with Global Harmony Management.
 * Synchronizes notes across all playfields to prevent frequency clashing.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeVoices = 0;
    this.maxVoices = 6; // Prevents audio mudding
    this.lastNoteTime = 0;
    this.minNoteGap = 0.08; // 80ms minimum gap between global notes
    this.noteIndex = 0; // Tracks position in global scale for variety
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = AUDIO_CONFIG.BASE_GAIN;
    this.masterGain.connect(this.ctx.destination);
  }

  /**
   * Plays a note that respects global timing and harmony.
   * If nodes click too fast, notes are queued or shifted in pitch.
   */
  playNote(cellValue) {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    
    // Voice limiting: don't play if too many things are happening
    if (this.activeVoices >= this.maxVoices) return;

    // Temporal Quantization: ensure notes aren't exactly at the same time
    let scheduledTime = now;
    if (scheduledTime < this.lastNoteTime + this.minNoteGap) {
      scheduledTime = this.lastNoteTime + this.minNoteGap;
    }
    this.lastNoteTime = scheduledTime;

    // Harmonic Shifting: Use cell value + global index to ensure spread
    // This prevents 5 nodes all playing 'C3' at once.
    const harmonicOffset = Math.floor(this.noteIndex % 3); 
    const scaleIndex = (cellValue + harmonicOffset) % AUDIO_CONFIG.SCALE.length;
    const freq = AUDIO_CONFIG.SCALE[scaleIndex];

    this.noteIndex++;
    this.triggerOscillator(freq, 0.15, 'triangle', scheduledTime - now);
  }

  playGoink() {
    if (!this.ctx) this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);

    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(g);
    g.connect(this.masterGain);

    osc.start();
    osc.stop(now + 0.4);
  }

  playSuccess() {
    if (!this.ctx) this.init();
    const now = this.ctx.currentTime;
    // Arpeggiated success chord to prevent instant spike
    const chord = [261.63, 329.63, 392.00, 523.25]; 
    chord.forEach((freq, i) => {
      this.triggerOscillator(freq, 0.5, 'sine', i * 0.06);
    });
  }

  /**
   * Core synthesis with Voice Tracking.
   */
  triggerOscillator(freq, duration, type, delay = 0) {
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    this.activeVoices++;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // ADSR Envelope
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(1, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(g);
    g.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);

    // Cleanup voice count
    setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, (delay + duration) * 1000);
  }
}

export const audio = new AudioEngine();