export class InputManager {
  constructor() {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };

    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', () => {
      this.mouse.down = true;
    });

    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  isKeyDown(code) {
    return this.keys.has(code);
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
