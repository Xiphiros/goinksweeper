import { audio } from '../engine/audio.js';

export class ViewportManager {
  constructor(viewportEl, worldEl, state, onInteraction = null) {
    this.viewport = viewportEl;
    this.world = worldEl;
    this.state = state;
    this.onInteraction = onInteraction;
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };

    this.init();
  }

  init() {
    this.viewport.addEventListener("mousedown", (e) => {
      // Allow context menu but close other UI
      if (this.onInteraction) this.onInteraction();
      
      if (e.button === 0 || e.button === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.state.view.x += dx / this.state.view.scale;
      this.state.view.y += dy / this.state.view.scale;
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.update();
    });

    window.addEventListener("mouseup", () => (this.isDragging = false));

    this.viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (this.onInteraction) this.onInteraction();
      
      const direction = Math.sign(e.deltaY);
      audio.updateScrollHum(-direction);

      const rect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = mouseX / this.state.view.scale - this.state.view.x;
      const worldY = mouseY / this.state.view.scale - this.state.view.y;

      const delta = Math.sign(e.deltaY) * -0.15;
      const prevScale = this.state.view.scale;
      this.state.view.scale = Math.max(0.1, Math.min(3, prevScale + delta));

      this.state.view.x = mouseX / this.state.view.scale - worldX;
      this.state.view.y = mouseY / this.state.view.scale - worldY;

      this.update();
    }, { passive: false });

    this.update();
  }

  centerOn(worldX, worldY, offsetW = 0, offsetH = 0) {
    const rect = this.viewport.getBoundingClientRect();
    this.state.view.x = (rect.width / 2 / this.state.view.scale) - (worldX + offsetW / 2);
    this.state.view.y = (rect.height / 2 / this.state.view.scale) - (worldY + offsetH / 2);
    this.update();
  }

  update() {
    const { x, y, scale } = this.state.view;
    this.world.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
  }

  getVisibleBounds() {
    const rect = this.viewport.getBoundingClientRect();
    return {
      left: -this.state.view.x,
      top: -this.state.view.y,
      right: -this.state.view.x + rect.width / this.state.view.scale,
      bottom: -this.state.view.y + rect.height / this.state.view.scale
    };
  }
}