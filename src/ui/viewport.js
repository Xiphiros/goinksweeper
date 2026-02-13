export class ViewportManager {
  constructor(viewportEl, worldEl, state) {
    this.viewport = viewportEl;
    this.world = worldEl;
    this.state = state;
    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };

    this.init();
  }

  init() {
    this.viewport.addEventListener("mousedown", (e) => {
      // Middle click or Left click for panning
      if (e.button === 0 || e.button === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      
      // Move speed scales inversely with zoom for consistent feel
      this.state.view.x += dx / this.state.view.scale;
      this.state.view.y += dy / this.state.view.scale;
      
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.update();
    });

    window.addEventListener("mouseup", () => (this.isDragging = false));

    this.viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      
      const rect = this.viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate world coordinates under the mouse before zoom
      const worldX = mouseX / this.state.view.scale - this.state.view.x;
      const worldY = mouseY / this.state.view.scale - this.state.view.y;

      // Apply zoom
      const delta = Math.sign(e.deltaY) * -0.15;
      const prevScale = this.state.view.scale;
      this.state.view.scale = Math.max(0.1, Math.min(3, prevScale + delta));

      // Adjust offset so world coordinate under mouse stays under mouse (Zoom-to-Cursor)
      this.state.view.x = mouseX / this.state.view.scale - worldX;
      this.state.view.y = mouseY / this.state.view.scale - worldY;

      this.update();
    }, { passive: false });

    this.update();
  }

  /**
   * Centers the viewport on a specific world coordinate.
   * Required for main.js spawnNode functionality.
   */
  centerOn(worldX, worldY, offsetW = 0, offsetH = 0) {
    const rect = this.viewport.getBoundingClientRect();
    
    // Target position calculation relative to viewport center
    this.state.view.x = (rect.width / 2 / this.state.view.scale) - (worldX + offsetW / 2);
    this.state.view.y = (rect.height / 2 / this.state.view.scale) - (worldY + offsetH / 2);
    
    this.update();
  }

  update() {
    const { x, y, scale } = this.state.view;
    // Applying CSS Transform based on internal state
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