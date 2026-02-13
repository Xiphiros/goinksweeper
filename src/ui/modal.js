export class Modal {
  static get root() {
    return document.getElementById("modal-root");
  }

  /**
   * Displays an informational alert.
   * Returns a Promise that resolves when dismissed.
   */
  static alert(title, message) {
    return this.createDialog(title, message, "alert", ["OK"]);
  }

  /**
   * Displays a confirmation dialog.
   * Returns a Promise that resolves to true (Yes) or false (No).
   */
  static confirm(title, message) {
    return this.createDialog(title, message, "confirm", ["CANCEL", "CONFIRM"]);
  }

  static createDialog(title, message, type, buttons) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      
      const box = document.createElement("div");
      box.className = `modal-box modal-box--${type}`;
      
      const header = document.createElement("div");
      header.className = "modal__header";
      header.innerText = title;
      
      const content = document.createElement("div");
      content.className = "modal__content";
      content.innerText = message;
      
      const actions = document.createElement("div");
      actions.className = "modal__actions";
      
      buttons.forEach((btnLabel, index) => {
        const btn = document.createElement("button");
        btn.className = "modal__btn";
        
        // If it's the last button ("OK" or "CONFIRM"), style it primary
        if (index === buttons.length - 1) {
          btn.classList.add("modal__btn--primary");
        }
        
        btn.innerText = btnLabel;
        btn.onclick = () => {
          this.close(overlay);
          // Confirm logic: if 2 buttons, index 1 is true. Alert logic: always true/void.
          if (type === "confirm") {
            resolve(index === 1); 
          } else {
            resolve(true);
          }
        };
        actions.appendChild(btn);
      });

      box.appendChild(header);
      box.appendChild(content);
      box.appendChild(actions);
      overlay.appendChild(box);
      
      this.root.appendChild(overlay);
    });
  }

  static close(element) {
    element.remove();
  }
}