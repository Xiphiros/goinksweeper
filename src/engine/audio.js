import { AUDIO_CONFIG } from '../core/constants.js';

/**
 * Advanced Audio Engine managing synthesized SFX and background media streaming.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.filter = null; 
    this.musicGain = null;
    this.sfxGain = null;
    
    this.bgMusic = new Audio('ctype.mp3');
    this.bgMusic.loop = true;
    this.musicSource = null;

    // Scroll Hum State
    this.scrollOsc = null;
    this.scrollGain = null;
    this.scrollTimeout = null;

    this.activeVoices = 0;
    this.maxVoices = 12; 
    this.lastNoteTime = 0;
    this.minNoteGap = 0.05;
    this.noteIndex = 0;
    
    this.CHORD_MAP = {
      'tier_a': { notes: [1046.50, 1318.51], duration: 0.3, stagger: 0.05, type: 'sine' },
      'tier_b': { notes: [523.25, 659.25, 783.99], duration: 0.5, stagger: 0.06, type: 'triangle' },
      'tier_c': { notes: [349.23, 440.00, 523.25, 659.25], duration: 0.8, stagger: 0.08, type: 'sine' },
      'tier_d': { notes: [196.00, 293.66, 392.00, 493.88, 587.33], duration: 1.0, stagger: 0.1, type: 'triangle' },
      'tier_e': { notes: [146.83, 220.00, 293.66, 369.99, 440.00, 554.37], duration: 1.5, stagger: 0.04, type: 'sawtooth' },
      'tier_f': { notes: [155.56, 233.08, 311.13, 392.00, 466.16, 622.25, 783.99], duration: 2.5, stagger: 0.15, type: 'sine' },
      'tier_g': { notes: [65.41, 130.81, 196.00, 261.63, 329.63, 392.00, 493.88, 523.25], duration: 4.0, stagger: 0.12, type: 'triangle' }
    };
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 20000;

    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    
    this.musicGain.connect(this.filter);
    this.sfxGain.connect(this.filter);
    this.filter.connect(this.ctx.destination);

    this.musicSource = this.ctx.createMediaElementSource(this.bgMusic);
    this.musicSource.connect(this.musicGain);
    
    this.bgMusic.play().catch(() => {});
  }

  /**
   * Triggers or updates a continuous hum sound for viewport scrolling.
   * @param {number} direction - 1 for up/in, -1 for down/out.
   */
  updateScrollHum(direction) {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    
    // Initialize oscillator if not present
    if (!this.scrollOsc) {
      this.scrollOsc = this.ctx.createOscillator();
      this.scrollGain = this.ctx.createGain();
      
      this.scrollOsc.type = 'sine';
      this.scrollOsc.frequency.setValueAtTime(direction > 0 ? 220 : 110, now);
      
      this.scrollGain.gain.setValueAtTime(0, now);
      this.scrollGain.gain.linearRampToValueAtTime(0.05, now + 0.1);
      
      this.scrollOsc.connect(this.scrollGain);
      this.scrollGain.connect(this.sfxGain);
      this.scrollOsc.start();
    }

    // Shift pitch based on direction
    const targetFreq = direction > 0 ? 220 : 110;
    this.scrollOsc.frequency.setTargetAtTime(targetFreq, now, 0.05);

    // Refresh silence timer
    if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
    this.scrollTimeout = setTimeout(() => this.stopScrollHum(), 150);
  }

  stopScrollHum() {
    if (!this.scrollGain) return;
    const now = this.ctx.currentTime;
    this.scrollGain.gain.setTargetAtTime(0, now, 0.05);
    
    setTimeout(() => {
      if (this.scrollOsc && this.scrollGain.gain.value < 0.01) {
        this.scrollOsc.stop();
        this.scrollOsc.disconnect();
        this.scrollOsc = null;
        this.scrollGain = null;
      }
    }, 100);
  }

  setMusicVolume(value) {
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(value) {
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.05);
  }

  setFilterSubmerged(isSubmerged) {
    if (!this.filter) return;
    const freq = isSubmerged ? 450 : 20000;
    this.filter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.3);
  }

  playUiToggle(isOpen) {
    if (!this.ctx) this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    if (isOpen) {
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    } else {
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
    }
    g.gain.setValueAtTime(0.25, now);
    g.gain.linearRampToValueAtTime(0, now + 0.15);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playNote(cellValue) {
    if (!this.ctx) this.init();
    const now = this.ctx.currentTime;
    if (this.activeVoices >= this.maxVoices) return;
    let scheduledTime = now;
    if (scheduledTime < this.lastNoteTime + this.minNoteGap) {
      scheduledTime = this.lastNoteTime + this.minNoteGap;
    }
    this.lastNoteTime = scheduledTime;
    const harmonicOffset = Math.floor(this.noteIndex % 3); 
    const scaleIndex = (cellValue + harmonicOffset) % AUDIO_CONFIG.SCALE.length;
    const freq = AUDIO_CONFIG.SCALE[scaleIndex];
    this.noteIndex++;
    this.triggerOscillator(freq, 0.15, 'triangle', scheduledTime - now, 0.8);
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
    g.connect(this.sfxGain);
    osc.start();
    osc.stop(now + 0.4);
  }

  playSuccess(tierKey) {
    if (!this.ctx) this.init();
    const profile = this.CHORD_MAP[tierKey] || this.CHORD_MAP['tier_b']; 
    profile.notes.forEach((freq, i) => {
      const vol = 0.6 / Math.sqrt(profile.notes.length * 0.5); 
      this.triggerOscillator(freq, profile.duration, profile.type, i * profile.stagger, vol);
    });
  }

  triggerOscillator(freq, duration, type, delay = 0, volumeScale = 1) {
    if (!this.sfxGain) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    this.activeVoices++;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(volumeScale, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(this.sfxGain); 
    osc.start(now);
    osc.stop(now + duration);
    setTimeout(() => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    }, (delay + duration) * 1000);
  }
}

export const audio = new AudioEngine();