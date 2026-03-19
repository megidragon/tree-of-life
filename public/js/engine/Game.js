import { Camera } from './Camera.js';
import { InputManager } from './InputManager.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.entities = [];
    this.input = new InputManager();
    this.camera = null;
    this.lastTime = 0;
    this.running = false;

    // Offscreen canvas for fog rendering
    this._fogCanvas = document.createElement('canvas');
    this._fogCtx = this._fogCanvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.camera) {
      this.camera.resize(this.canvas.width, this.canvas.height);
    } else {
      this.camera = new Camera(this.canvas.width, this.canvas.height);
    }
  }

  addEntity(entity) {
    this.entities.push(entity);
    this._sortEntities();
    return entity;
  }

  removeEntity(entity) {
    const idx = this.entities.indexOf(entity);
    if (idx !== -1) this.entities.splice(idx, 1);
  }

  getEntitiesByType(type) {
    return this.entities.filter((e) => e.type === type);
  }

  getEntitiesByTag(tag) {
    return this.entities.filter((e) => e.hasTag(tag));
  }

  _sortEntities() {
    this.entities.sort((a, b) => a.zIndex - b.zIndex);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _loop(timestamp) {
    if (!this.running) return;

    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this._update(dt);
    this._render();

    requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    for (const entity of this.entities) {
      entity.update(dt);
    }
    this.camera.update(dt);
  }

  _render() {
    const { ctx, canvas, camera } = this;

    // Dark background for areas outside fog / outside map
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#080c08';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply camera zoom + pan transform
    camera.applyTransform(ctx);

    for (const entity of this.entities) {
      const transform = entity.getComponent('transform');
      if (transform) {
        if (!camera.isVisible(transform.x, transform.y, transform.width, transform.height)) continue;
        if (!camera.isInFogRange(transform.x, transform.y, transform.width, transform.height)) continue;
      }
      entity.render(ctx, camera);
    }

    camera.resetTransform(ctx);

    // Fog overlay
    this._renderFog();

    // UI overlay (screen-space)
    this._renderUI();
  }

  _renderFog() {
    const { camera, canvas, ctx } = this;
    if (!camera.fog.enabled || camera.fog.sources.length === 0) return;

    const fogCanvas = this._fogCanvas;
    const fogCtx = this._fogCtx;

    // Resize offscreen canvas if needed
    if (fogCanvas.width !== canvas.width || fogCanvas.height !== canvas.height) {
      fogCanvas.width = canvas.width;
      fogCanvas.height = canvas.height;
    }

    // Fill with opaque fog
    fogCtx.globalCompositeOperation = 'source-over';
    fogCtx.fillStyle = 'rgba(8, 12, 8, 0.97)';
    fogCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Punch transparent holes for each vision source
    fogCtx.globalCompositeOperation = 'destination-out';

    for (const src of camera.fog.sources) {
      const sx = (src.x - camera.x) * camera.zoom;
      const sy = (src.y - camera.y) * camera.zoom;
      const clearR = src.clearRadius * camera.zoom;
      const fogR = src.fogRadius * camera.zoom;

      const gradient = fogCtx.createRadialGradient(sx, sy, 0, sx, sy, fogR);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(Math.min(clearR / fogR, 0.99), 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      fogCtx.fillStyle = gradient;
      fogCtx.beginPath();
      fogCtx.arc(sx, sy, fogR, 0, Math.PI * 2);
      fogCtx.fill();
    }

    fogCtx.globalCompositeOperation = 'source-over';

    // Draw fog overlay onto main canvas
    ctx.drawImage(fogCanvas, 0, 0);
  }

  _renderUI() {
    if (!this.onRenderUI) return;
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.onRenderUI(ctx, canvas);
  }
}
