import { Entity } from '../engine/Entity.js';
import { TransformComponent, SpriteComponent } from '../engine/Component.js';

const TILE_SIZE = 64;

export class GameMap {
  constructor(widthInTiles, heightInTiles) {
    this.widthInTiles = widthInTiles;
    this.heightInTiles = heightInTiles;
    this.pixelWidth = widthInTiles * TILE_SIZE;
    this.pixelHeight = heightInTiles * TILE_SIZE;
  }

  /**
   * Returns a single entity that renders all visible tiles.
   * Much faster than one entity per tile for large maps.
   */
  getEntities() {
    const mapEntity = new Entity('terrain');
    mapEntity.zIndex = 0;
    mapEntity.addTag('ground');

    // Transform covers the entire map so frustum culling works
    mapEntity.addComponent(
      new TransformComponent(0, 0, this.pixelWidth, this.pixelHeight)
    );

    const self = this;
    mapEntity.addComponent(
      new SpriteComponent((ctx, sx, sy, w, h) => {
        self._renderVisibleTiles(ctx, sx, sy);
      })
    );

    return [mapEntity];
  }

  _renderVisibleTiles(ctx, mapX, mapY) {
    // Figure out which tiles are visible from the current canvas clip
    // ctx is already transformed by the camera, so we work in world coords
    // mapX, mapY are the world origin of the map (0, 0)

    // Get the visible area from the inverse of current transform
    const transform = ctx.getTransform();
    const zoom = transform.a;
    const camX = -transform.e / zoom;
    const camY = -transform.f / zoom;

    // Canvas size in world units
    const canvasW = ctx.canvas.width / zoom;
    const canvasH = ctx.canvas.height / zoom;

    // Tile range to render
    const startTX = Math.max(0, Math.floor(camX / TILE_SIZE));
    const startTY = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endTX = Math.min(this.widthInTiles - 1, Math.floor((camX + canvasW) / TILE_SIZE));
    const endTY = Math.min(this.heightInTiles - 1, Math.floor((camY + canvasH) / TILE_SIZE));

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        const shade = this._grassShade(tx, ty);
        ctx.fillStyle = shade;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        // Only draw grass detail when zoomed in enough
        if (zoom > 0.3) {
          this._drawGrassDetail(ctx, px, py, TILE_SIZE, TILE_SIZE, tx, ty);
        }
      }
    }
  }

  _grassShade(tx, ty) {
    const seed = Math.sin(tx * 12.9898 + ty * 78.233) * 43758.5453;
    const noise = seed - Math.floor(seed);
    const g = Math.floor(120 + noise * 40);
    return `rgb(${60 + Math.floor(noise * 15)}, ${g}, ${40 + Math.floor(noise * 10)})`;
  }

  _drawGrassDetail(ctx, sx, sy, w, h, tx, ty) {
    const seed = (tx * 7 + ty * 13) % 17;
    ctx.strokeStyle = 'rgba(34, 100, 34, 0.4)';
    ctx.lineWidth = 1;

    for (let i = 0; i < 3; i++) {
      const bx = sx + ((seed * (i + 1) * 7) % w);
      const by = sy + ((seed * (i + 1) * 11) % h);
      ctx.beginPath();
      ctx.moveTo(bx, by + 8);
      ctx.quadraticCurveTo(bx + 2, by, bx + 4, by + 8);
      ctx.stroke();
    }
  }

  getCenterX() {
    return this.pixelWidth / 2;
  }

  getCenterY() {
    return this.pixelHeight / 2;
  }
}
