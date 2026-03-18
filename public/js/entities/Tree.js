import { Entity } from '../engine/Entity.js';
import {
  TransformComponent,
  SpriteComponent,
  ColliderComponent,
} from '../engine/Component.js';

// Seeded pseudo-random for deterministic trees
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Default leaf color palette
const DEFAULT_LEAF_PALETTE = {
  greens: ['#1B6B1B', '#228B22', '#2EA62E', '#1F7A1F'],
  darkGreens: ['#145214', '#1A6B1A', '#237A23', '#186418'],
};

export class Tree extends Entity {
  /**
   * @param {number} x
   * @param {number} y
   * @param {object} [options]
   * @param {number} [options.seed] - Deterministic seed for branch generation
   * @param {number} [options.branchCount=null] - Number of main branches (default: 5-7 random). 0 = trunk only
   * @param {number} [options.subBranchCount=2] - Max sub-branches per main branch. 0 = no sub-branches
   * @param {number} [options.leafDensity=1] - Leaf size: 0 = no leaves, 1 = normal, >1 = bigger
   * @param {number} [options.leafClusters=0] - Clusters per branch: 0 = single leaf at tip (default), 1-5+ = multiple clusters along branch
   * @param {object} [options.leafColor] - Custom leaf color palette
   * @param {string[]} [options.leafColor.greens] - Array of 4 hex colors for leaf body
   * @param {string[]} [options.leafColor.darkGreens] - Array of 4 hex colors for leaf shadows
   */
  constructor(x, y, options = {}) {
    super('tree');
    this.zIndex = 2;

    const seed = options.seed ?? Math.floor(Math.random() * 100000);
    this.branchCount = options.branchCount ?? null;
    this.subBranchCount = options.subBranchCount ?? 2;
    this.leafDensity = options.leafDensity ?? 1;
    this.leafClusters = options.leafClusters ?? 0;
    this.leafColor = options.leafColor ?? DEFAULT_LEAF_PALETTE;

    // Store for serialization
    this.treeData = {
      x, y, seed,
      branchCount: this.branchCount,
      subBranchCount: this.subBranchCount,
      leafDensity: this.leafDensity,
      leafClusters: this.leafClusters,
    };

    const trunkW = 24;
    const trunkH = 56;
    const canopyR = 60;
    const totalW = canopyR * 2 + 20;
    const totalH = trunkH + canopyR + 10;

    this.addComponent(new TransformComponent(x - totalW / 2, y - totalH, totalW, totalH));

    // Pre-generate branch structure so it's stable across frames
    const rng = seededRandom(seed);
    const branches = Tree._generateBranches(rng, trunkW, trunkH, canopyR, this.branchCount, this.subBranchCount, this.leafClusters);
    const canopyLeaves = Tree._generateCanopyLeaves(rng, canopyR);

    const self = this;
    this.addComponent(
      new SpriteComponent((ctx, sx, sy, w, h) => {
        const cx = sx + w / 2;
        const trunkTop = sy + canopyR + 10;
        const trunkBottom = sy + h;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.beginPath();
        ctx.ellipse(cx, trunkBottom + 4, canopyR * 0.9, canopyR * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Trunk - tapered
        ctx.fillStyle = '#5C3A1E';
        ctx.beginPath();
        ctx.moveTo(cx - trunkW / 2 - 3, trunkBottom);
        ctx.lineTo(cx - trunkW / 2 + 2, trunkTop);
        ctx.lineTo(cx + trunkW / 2 - 2, trunkTop);
        ctx.lineTo(cx + trunkW / 2 + 3, trunkBottom);
        ctx.closePath();
        ctx.fill();

        // Bark texture
        ctx.strokeStyle = '#4A2E16';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const lx = cx - trunkW / 2 + 4 + i * 4;
          ctx.beginPath();
          ctx.moveTo(lx, trunkTop + 6);
          ctx.bezierCurveTo(lx + 1, trunkTop + trunkH * 0.3, lx - 1, trunkTop + trunkH * 0.6, lx + 1, trunkBottom - 4);
          ctx.stroke();
        }

        // Draw branches and their leaves
        Tree._renderBranches(ctx, cx, trunkTop, trunkH, branches, self.leafDensity, self.leafColor);

        // Draw canopy leaves scattered around the crown
        if (self.leafDensity > 0) {
          Tree._renderCanopyLeaves(ctx, cx, trunkTop, canopyLeaves, self.leafDensity, self.leafColor);
        }

        // Leaf highlight (light hitting the top)
        if (self.leafDensity > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.beginPath();
          ctx.ellipse(cx - 8, trunkTop - 20, canopyR * 0.3, canopyR * 0.25, -0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      })
    );

    this.addComponent(new ColliderComponent(totalW / 2 - trunkW / 2, canopyR + 10, trunkW, trunkH));

    this.addTag('solid');
    this.addTag('nature');
  }

  static _generateCanopyLeaves(rng, canopyR) {
    const leaves = [];
    const count = 4 + Math.floor(rng() * 5);

    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * canopyR * 0.6;
      leaves.push({
        ox: Math.cos(angle) * dist,
        oy: Math.sin(angle) * dist * 0.8 - canopyR * 0.3,
        r: 8 + rng() * 12,
        shade: Math.floor(rng() * 4),
      });
    }

    return leaves;
  }

  static _renderCanopyLeaves(ctx, cx, trunkTop, canopyLeaves, leafDensity, leafColor) {
    const { greens, darkGreens } = leafColor;

    for (const leaf of canopyLeaves) {
      const r = leaf.r * leafDensity;
      if (r < 0.5) continue;

      ctx.fillStyle = darkGreens[leaf.shade];
      ctx.beginPath();
      ctx.arc(cx + leaf.ox + 1, trunkTop + leaf.oy + 1, r + 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = greens[leaf.shade];
      ctx.beginPath();
      ctx.arc(cx + leaf.ox, trunkTop + leaf.oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  static _generateBranches(rng, trunkW, trunkH, canopyR, forcedBranchCount, maxSubBranches, leafClusters) {
    const branches = [];

    // Main branches growing from trunk
    const branchCount = forcedBranchCount ?? (5 + Math.floor(rng() * 3));

    for (let i = 0; i < branchCount; i++) {
      const t = 0.15 + (i / branchCount) * 0.65;
      const side = i % 2 === 0 ? -1 : 1;
      const angle = side * (0.4 + rng() * 0.8);
      const length = 30 + rng() * 35;
      const thickness = 3 + rng() * 3;
      const startY = -trunkH * t;

      // Each branch has sub-branches
      const subBranches = [];
      const subCount = Math.min(1 + Math.floor(rng() * 3), maxSubBranches);
      for (let j = 0; j < subCount; j++) {
        const subT = 0.4 + rng() * 0.5;
        const subAngle = angle + (rng() - 0.5) * 1.2;
        const subLength = 12 + rng() * 20;
        subBranches.push({
          t: subT,
          angle: subAngle,
          length: subLength,
          thickness: Math.max(1, thickness * 0.5),
          leafData: Tree._generateLeafData(rng, subLength, leafClusters),
        });
      }

      branches.push({
        startY,
        angle,
        length,
        thickness,
        subBranches,
        leafData: Tree._generateLeafData(rng, length, leafClusters),
      });
    }

    return branches;
  }

  static _generateLeafData(rng, branchLength, clusterCount) {
    // Single leaf at tip (default mode: clusterCount = 0)
    if (clusterCount <= 0) {
      const size = 12 + rng() * 10;
      return {
        mode: 'single',
        tipLeaf: {
          r: size,
          shade: Math.floor(rng() * 4),
        },
      };
    }

    // Multiple clusters along the branch
    const clusters = [];
    for (let i = 0; i < clusterCount; i++) {
      const t = 0.3 + rng() * 0.7;
      const spread = 6 + rng() * 10;
      const size = 10 + rng() * 14;

      const leaves = [];
      const leafCount = 3 + Math.floor(rng() * 4);
      for (let l = 0; l < leafCount; l++) {
        leaves.push({
          ox: (rng() - 0.5) * spread,
          oy: (rng() - 0.5) * spread,
          r: size * (0.4 + rng() * 0.6),
          shade: Math.floor(rng() * 4),
        });
      }
      clusters.push({ t, leaves });
    }
    return { mode: 'clusters', clusters };
  }

  static _renderBranches(ctx, cx, trunkTop, trunkH, branches, leafDensity, leafColor) {
    const { greens, darkGreens } = leafColor;

    for (const branch of branches) {
      const startX = cx;
      const startY = trunkTop - branch.startY;

      const endX = startX + Math.cos(branch.angle - Math.PI / 2) * branch.length;
      const endY = startY + Math.sin(branch.angle - Math.PI / 2) * branch.length;

      // Draw branch wood
      ctx.strokeStyle = '#5C3A1E';
      ctx.lineWidth = branch.thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const cpx = startX + (endX - startX) * 0.5 + (branch.angle > 0 ? 5 : -5);
      const cpy = startY + (endY - startY) * 0.5 - 5;
      ctx.quadraticCurveTo(cpx, cpy, endX, endY);
      ctx.stroke();

      // Draw sub-branches
      for (const sub of branch.subBranches) {
        const subStartX = startX + (endX - startX) * sub.t;
        const subStartY = startY + (endY - startY) * sub.t;
        const subEndX = subStartX + Math.cos(sub.angle - Math.PI / 2) * sub.length;
        const subEndY = subStartY + Math.sin(sub.angle - Math.PI / 2) * sub.length;

        ctx.strokeStyle = '#6B4427';
        ctx.lineWidth = sub.thickness;
        ctx.beginPath();
        ctx.moveTo(subStartX, subStartY);
        ctx.lineTo(subEndX, subEndY);
        ctx.stroke();

        // Leaves on sub-branches
        if (leafDensity > 0) {
          Tree._renderLeaves(ctx, subStartX, subStartY, subEndX, subEndY, sub.leafData, greens, darkGreens, leafDensity);
        }
      }

      // Leaves on main branch
      if (leafDensity > 0) {
        Tree._renderLeaves(ctx, startX, startY, endX, endY, branch.leafData, greens, darkGreens, leafDensity);
      }
    }
  }

  static _renderLeaves(ctx, startX, startY, endX, endY, leafData, greens, darkGreens, leafDensity) {
    if (leafData.mode === 'single') {
      // Single leaf circle at the tip of the branch
      const { r, shade } = leafData.tipLeaf;
      const radius = r * leafDensity;
      if (radius < 0.5) return;

      // Shadow
      ctx.fillStyle = darkGreens[shade];
      ctx.beginPath();
      ctx.arc(endX + 1, endY + 1, radius + 1, 0, Math.PI * 2);
      ctx.fill();

      // Leaf body
      ctx.fillStyle = greens[shade];
      ctx.beginPath();
      ctx.arc(endX, endY, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Multiple clusters along the branch
      for (const cluster of leafData.clusters) {
        const clX = startX + (endX - startX) * cluster.t;
        const clY = startY + (endY - startY) * cluster.t;

        for (const leaf of cluster.leaves) {
          const r = leaf.r * leafDensity;
          if (r < 0.5) continue;

          ctx.fillStyle = darkGreens[leaf.shade];
          ctx.beginPath();
          ctx.arc(clX + leaf.ox + 1, clY + leaf.oy + 1, r + 1, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = greens[leaf.shade];
          ctx.beginPath();
          ctx.arc(clX + leaf.ox, clY + leaf.oy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
}
