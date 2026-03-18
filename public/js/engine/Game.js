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

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const entity of this.entities) {
      const transform = entity.getComponent('transform');
      if (transform && !camera.isVisible(transform.x, transform.y, transform.width, transform.height)) {
        continue;
      }
      entity.render(ctx, camera);
    }
  }
}
