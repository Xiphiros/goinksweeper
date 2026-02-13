export class ContextMenu {
  static init(el) {
    this.el = el;
    // Hide menu on any click on the window...
    window.addEventListener("click", () => this.hide());
    
    // ...BUT prevent clicks inside the menu from closing it immediately
    this.el.addEventListener("click", (e) => e.stopPropagation());
    
    // Prevent right-click on the menu itself from triggering the browser context menu
    this.el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  static show(e, items) {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: Don't let this click bubble to window!
    
    this.el.style.display = "block";
    this.el.style.left = `${e.clientX}px`;
    this.el.style.top = `${e.clientY}px`;
    
    this.el.innerHTML = "";
    items.forEach(item => {
      const div = document.createElement("div");
      div.className = "context-menu__item";
      if (item.danger) div.classList.add("context-menu__item--danger");
      div.innerText = item.label;
      
      div.onclick = (ev) => {
        ev.stopPropagation(); // Prevent bubbling
        item.action();
        this.hide();
      };
      
      this.el.appendChild(div);
    });
  }

  static hide() {
    if (this.el) this.el.style.display = "none";
  }
}