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

  getEntities() {
    const mapEntity = new Entity('terrain');
    mapEntity.zIndex = 0;
    mapEntity.addTag('ground');

    mapEntity.addComponent(
      new TransformComponent(0, 0, this.pixelWidth, this.pixelHeight)
    );

    const self = this;
    mapEntity.addComponent(
      new SpriteComponent((ctx, sx, sy, w, h, camera) => {
        self._renderVisibleTiles(ctx, camera);
      })
    );

    return [mapEntity];
  }

  _renderVisibleTiles(ctx, camera) {
    const zoom = camera.zoom;
    const camX = camera.x;
    const camY = camera.y;
    const canvasW = camera.width / zoom;
    const canvasH = camera.height / zoom;

    // Tile range visible on screen
    const startTX = Math.max(0, Math.floor(camX / TILE_SIZE));
    const startTY = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endTX = Math.min(this.widthInTiles - 1, Math.floor((camX + canvasW) / TILE_SIZE));
    const endTY = Math.min(this.heightInTiles - 1, Math.floor((camY + canvasH) / TILE_SIZE));

    const fogEnabled = camera.fog?.enabled;
    const fogSources = camera.fog?.sources;

    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const px = tx * TILE_SIZE;
        const py = ty * TILE_SIZE;

        // Skip tiles outside fog range
        if (fogEnabled && fogSources?.length) {
          if (!this._isTileInFogRange(px, py, fogSources)) continue;
        }

        const shade = this._grassShade(tx, ty);
        ctx.fillStyle = shade;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        if (zoom > 0.3) {
          this._drawGrassDetail(ctx, px, py, TILE_SIZE, TILE_SIZE, tx, ty);
        }
      }
    }
  }

  _isTileInFogRange(px, py, sources) {
    for (const src of sources) {
      const closestX = Math.max(px, Math.min(src.x, px + TILE_SIZE));
      const closestY = Math.max(py, Math.min(src.y, py + TILE_SIZE));
      const dx = src.x - closestX;
      const dy = src.y - closestY;
      if (dx * dx + dy * dy <= src.fogRadius * src.fogRadius) return true;
    }
    return false;
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
