export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;
    this.y = 0;
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.targetX = 0;
    this.targetY = 0;
    this.smoothing = 0.1;

    // Zoom
    this.zoom = 1;
    this.targetZoom = 1;
    this.minZoom = 0.15;
    this.maxZoom = 2;
    this.zoomSmoothing = 0.08;
  }

  follow(x, y) {
    this.targetX = x - (this.width / this.zoom) / 2;
    this.targetY = y - (this.height / this.zoom) / 2;
  }

  centerOn(x, y) {
    this.targetX = x - (this.width / this.zoom) / 2;
    this.targetY = y - (this.height / this.zoom) / 2;
    this.x = this.targetX;
    this.y = this.targetY;
  }

  zoomBy(delta) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * delta));
  }

  setZoom(zoom) {
    this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
  }

  update(dt) {
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
    this.zoom += (this.targetZoom - this.zoom) * this.zoomSmoothing;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  /** Visible world width/height accounting for zoom */
  get viewWidth() {
    return this.width / this.zoom;
  }

  get viewHeight() {
    return this.height / this.zoom;
  }

  isVisible(x, y, w, h) {
    const vw = this.viewWidth;
    const vh = this.viewHeight;
    return (
      x + w > this.x &&
      x < this.x + vw &&
      y + h > this.y &&
      y < this.y + vh
    );
  }

  /** Apply camera transform to a canvas context */
  applyTransform(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.x * this.zoom, -this.y * this.zoom);
  }

  /** Reset canvas transform */
  resetTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
