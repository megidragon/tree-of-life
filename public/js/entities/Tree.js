import { Entity } from '../engine/Entity.js';
import {
  TransformComponent,
  SpriteComponent,
  ColliderComponent,
} from '../engine/Component.js';

export class Tree extends Entity {
  constructor(x, y) {
    super('tree');
    this.zIndex = 2;

    const trunkW = 24;
    const trunkH = 48;
    const canopyR = 52;
    const totalW = canopyR * 2;
    const totalH = trunkH + canopyR;

    this.addComponent(new TransformComponent(x - totalW / 2, y - totalH, totalW, totalH));

    this.addComponent(
      new SpriteComponent((ctx, sx, sy, w, h) => {
        const cx = sx + w / 2;
        const trunkTop = sy + canopyR;
        const trunkBottom = sy + h;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(cx, trunkBottom + 4, canopyR * 0.8, canopyR * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk
        ctx.fillStyle = '#5C3A1E';
        ctx.fillRect(cx - trunkW / 2, trunkTop, trunkW, trunkH);

        // Trunk detail - bark lines
        ctx.strokeStyle = '#4A2E16';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const lx = cx - trunkW / 2 + 5 + i * 5;
          ctx.beginPath();
          ctx.moveTo(lx, trunkTop + 4);
          ctx.lineTo(lx + 1, trunkTop + trunkH - 4);
          ctx.stroke();
        }

        // Canopy layers (back to front for depth)
        const layers = [
          { ox: -8, oy: 6, r: canopyR * 0.75, color: '#1B6B1B' },
          { ox: 10, oy: 4, r: canopyR * 0.7, color: '#1F7A1F' },
          { ox: 0, oy: 0, r: canopyR * 0.85, color: '#228B22' },
          { ox: -5, oy: -6, r: canopyR * 0.6, color: '#2EA62E' },
          { ox: 6, oy: -8, r: canopyR * 0.45, color: '#34B534' },
        ];

        for (const layer of layers) {
          ctx.fillStyle = layer.color;
          ctx.beginPath();
          ctx.arc(cx + layer.ox, trunkTop + layer.oy, layer.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Leaf highlights
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(cx - 12, trunkTop - 14, canopyR * 0.35, 0, Math.PI * 2);
        ctx.fill();
      })
    );

    this.addComponent(new ColliderComponent(totalW / 2 - trunkW / 2, canopyR, trunkW, trunkH));

    this.addTag('solid');
    this.addTag('nature');
  }
}
