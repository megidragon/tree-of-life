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

    // Fog of war
    this.fog = {
      enabled: false,
      /** @type {{ x: number, y: number, clearRadius: number, fogRadius: number }[]} */
      sources: [],
    };
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

  /**
   * Check if a rect is within any fog source's total range (fogRadius).
   * Returns true if fog is disabled or rect is within range.
   */
  isInFogRange(x, y, w, h) {
    if (!this.fog.enabled) return true;
    for (const src of this.fog.sources) {
      const closestX = Math.max(x, Math.min(src.x, x + w));
      const closestY = Math.max(y, Math.min(src.y, y + h));
      const dx = src.x - closestX;
      const dy = src.y - closestY;
      if (dx * dx + dy * dy <= src.fogRadius * src.fogRadius) return true;
    }
    return false;
  }

  applyTransform(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.x * this.zoom, -this.y * this.zoom);
  }

  resetTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
