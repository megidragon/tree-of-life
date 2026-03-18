import { Entity } from '../engine/Entity.js';
import { TransformComponent, SpriteComponent } from '../engine/Component.js';

const TILE_SIZE = 64;

export class GameMap {
  constructor(widthInTiles, heightInTiles) {
    this.widthInTiles = widthInTiles;
    this.heightInTiles = heightInTiles;
    this.pixelWidth = widthInTiles * TILE_SIZE;
    this.pixelHeight = heightInTiles * TILE_SIZE;
    this.tileEntities = [];

    this._generateTerrain();
  }

  _generateTerrain() {
    for (let ty = 0; ty < this.heightInTiles; ty++) {
      for (let tx = 0; tx < this.widthInTiles; tx++) {
        const tile = new Entity('terrain');
        tile.zIndex = 0;

        tile.addComponent(
          new TransformComponent(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        );

        const shade = this._grassShade(tx, ty);
        tile.addComponent(
          new SpriteComponent((ctx, sx, sy, w, h) => {
            ctx.fillStyle = shade;
            ctx.fillRect(sx, sy, w, h);

            this._drawGrassDetail(ctx, sx, sy, w, h, tx, ty);
          })
        );

        tile.addTag('ground');
        this.tileEntities.push(tile);
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

  getEntities() {
    return this.tileEntities;
  }
}
