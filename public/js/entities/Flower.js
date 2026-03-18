import { Entity } from '../engine/Entity.js';
import { TransformComponent, SpriteComponent } from '../engine/Component.js';

const FLOWER_COLORS = ['#FF6B8A', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8B3D', '#C77DFF'];

export class Flower extends Entity {
  constructor(x, y) {
    super('flower');
    this.zIndex = 1;

    const size = 12 + Math.random() * 8;
    this.addComponent(new TransformComponent(x - size / 2, y - size / 2, size, size));

    const color = FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)];
    const petalCount = 4 + Math.floor(Math.random() * 3);
    const rotation = Math.random() * Math.PI * 2;

    this.addComponent(
      new SpriteComponent((ctx, sx, sy, w, h) => {
        const cx = sx + w / 2;
        const cy = sy + h / 2;
        const petalR = w * 0.35;

        ctx.fillStyle = color;
        for (let i = 0; i < petalCount; i++) {
          const angle = rotation + (i * Math.PI * 2) / petalCount;
          const px = cx + Math.cos(angle) * petalR;
          const py = cy + Math.sin(angle) * petalR;
          ctx.beginPath();
          ctx.arc(px, py, petalR * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = '#FFE066';
        ctx.beginPath();
        ctx.arc(cx, cy, petalR * 0.35, 0, Math.PI * 2);
        ctx.fill();
      })
    );

    this.addTag('nature');
    this.addTag('decoration');
  }
}
