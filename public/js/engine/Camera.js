export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;
    this.y = 0;
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.targetX = 0;
    this.targetY = 0;
    this.smoothing = 0.1;
  }

  follow(x, y) {
    this.targetX = x - this.width / 2;
    this.targetY = y - this.height / 2;
  }

  update(dt) {
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  isVisible(x, y, w, h) {
    return (
      x + w > this.x &&
      x < this.x + this.width &&
      y + h > this.y &&
      y < this.y + this.height
    );
  }
}
