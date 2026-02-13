/**
 * CursorTrail
 * A lightweight particle system for mouse movement visualization.
 * Fits the "Goink" theme with pixelated, colorful digital dust.
 */
export class CursorTrail {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'fx-canvas';
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: 0, y: 0, lastX: 0, lastY: 0 };
    
    // Theme colors from CSS
    this.colors = ['#ff4d6d', '#2dce89', '#00b4d8', '#ffccd5'];
    
    this.init();
  }

  init() {
    // Setup Canvas
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none'; // CRITICAL: Let clicks pass through
    this.canvas.style.zIndex = '9000'; // Above viewport, below UI/Modals
    document.body.appendChild(this.canvas);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Track Mouse
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.spawnParticles();
    });

    // Start Loop
    this.loop();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  spawnParticles() {
    // Interpolate between last position and current to prevent gaps on fast movement
    const dx = this.mouse.x - this.mouse.lastX;
    const dy = this.mouse.y - this.mouse.lastY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // Only spawn if moved enough
    if (dist > 2) {
      const count = Math.min(5, Math.floor(dist / 2)); // Dynamic density
      for (let i = 0; i < count; i++) {
        const t = Math.random();
        const x = this.mouse.lastX + (dx * t);
        const y = this.mouse.lastY + (dy * t);
        
        this.particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 4 + 2,
          color: this.colors[Math.floor(Math.random() * this.colors.length)],
          life: 1.0,
          decay: Math.random() * 0.03 + 0.01
        });
      }
    }
    
    this.mouse.lastX = this.mouse.x;
    this.mouse.lastY = this.mouse.y;
  }

  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Physics
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // Gravity (heavy pixels)
      p.life -= p.decay;

      // Render (Square pixels for digital theme)
      if (p.life > 0) {
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      } else {
        this.particles.splice(i, 1);
      }
    }

    requestAnimationFrame(() => this.loop());
  }
}