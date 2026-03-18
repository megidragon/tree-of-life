export class InputManager {
  constructor() {
    this.keys = new Set();
    this.keysJustPressed = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.rightMouse = { down: false, dragDX: 0, dragDY: 0 };
    this.scrollDelta = 0;

    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.keysJustPressed.add(e.code);
      }
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.rightMouse.down) {
        this.rightMouse.dragDX += e.movementX;
        this.rightMouse.dragDY += e.movementY;
      }
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.rightMouse.down = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.rightMouse.down = false;
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.scrollDelta += e.deltaY;
    }, { passive: false });
  }

  isKeyDown(code) {
    return this.keys.has(code);
  }

  wasKeyPressed(code) {
    return this.keysJustPressed.has(code);
  }

  consumeScroll() {
    const delta = this.scrollDelta;
    this.scrollDelta = 0;
    return delta;
  }

  consumeDrag() {
    const dx = this.rightMouse.dragDX;
    const dy = this.rightMouse.dragDY;
    this.rightMouse.dragDX = 0;
    this.rightMouse.dragDY = 0;
    return { dx, dy };
  }

  endFrame() {
    this.keysJustPressed.clear();
  }

  getMovementVector() {
    let dx = 0;
    let dy = 0;
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) dy = -1;
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) dy = 1;
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) dx = -1;
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) dx = 1;

    if (dx !== 0 && dy !== 0) {
      const diag = Math.SQRT1_2;
      dx *= diag;
      dy *= diag;
    }

    return { dx, dy };
  }
}
