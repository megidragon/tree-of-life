import { Entity } from '../engine/Entity.js';
import {
  TransformComponent,
  SpriteComponent,
  ColliderComponent,
} from '../engine/Component.js';
import {
  getBranchCount,
  getLeafSize,
  getTrunkDimensions,
} from '../gameplay/TreeStats.js';

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
   * @param {number} x  World X (trunk base)
   * @param {number} y  World Y (trunk base / ground level)
   * @param {object} [options]
   */
  constructor(x, y, options = {}) {
    super('tree');
    this.zIndex = 2;

    this.treeX = x;
    this.treeY = y;
    this.seed = options.seed ?? Math.floor(Math.random() * 100000);
    this.leafColor = options.leafColor ?? DEFAULT_LEAF_PALETTE;
    this.ownerName = options.ownerName ?? null;

    // Gameplay state
    this.gameHeight = options.height ?? 100;
    this.roots = options.roots ?? [];
    this.leafClusters = options.leafClusters ?? 0;
    this.maxSubBranches = options.subBranchCount ?? 2;

    // Visual cache
    this._cachedBranchCount = -1;
    this.branches = [];
    this.canopyLeaves = [];
    this.trunkW = 24;
    this.trunkH = 56;
    this.canopyR = 60;

    // Build initial visual
    this._rebuild();

    // Components
    this.addComponent(new TransformComponent(
      this.treeX - this._totalW / 2,
      this.treeY - this._aboveGround,
      this._totalW,
      this._totalH,
    ));

    const self = this;
    this.addComponent(
      new SpriteComponent((ctx, sx, sy, w, h) => {
        self._renderTree(ctx, sx, sy, w, h);
      }),
    );

    this.addComponent(new ColliderComponent(
      this._totalW / 2 - this.trunkW / 2,
      this.canopyR + 10,
      this.trunkW,
      this.trunkH,
    ));

    this.addTag('solid');
    this.addTag('nature');
  }

  get _aboveGround() {
    return this.trunkH + this.canopyR + 10;
  }

  get _rootExtra() {
    if (this.roots.length === 0) return 0;
    let maxLen = 0;
    for (const r of this.roots) {
      if (r.length > maxLen) maxLen = r.length;
    }
    return Math.max(20, maxLen * 0.6 + 10);
  }

  get _totalW() {
    return this.canopyR * 2 + 20;
  }

  get _totalH() {
    return this._aboveGround + this._rootExtra;
  }

  // ── Public API ──

  setHeight(height) {
    if (Math.abs(this.gameHeight - height) < 0.001) return;
    this.gameHeight = height;
    this._rebuild();
  }

  setRoots(roots) {
    this.roots = roots;
    this._updateTransform();
  }

  /** Returns world-space branch endpoints for vision fog sources */
  getBranchEndpoints() {
    const endpoints = [];
    for (const branch of this.branches) {
      const reach = branch.length * 3;
      endpoints.push({
        x: this.treeX + Math.sin(branch.angle) * reach,
        y: this.treeY - Math.cos(branch.angle) * reach * 0.5,
        length: branch.length,
      });
    }
    return endpoints;
  }

  // ── Internal ──

  _rebuild() {
    const dims = getTrunkDimensions(this.gameHeight);
    this.trunkW = dims.trunkW;
    this.trunkH = dims.trunkH;
    this.canopyR = dims.canopyR;

    this._updateTransform();

    // Regenerate branches if count changed
    const newBranchCount = getBranchCount(this.gameHeight);
    if (newBranchCount !== this._cachedBranchCount) {
      this._cachedBranchCount = newBranchCount;
      this._generateAllBranches(newBranchCount);
    }
  }

  _updateTransform() {
    const transform = this.getComponent('transform');
    if (transform) {
      transform.x = this.treeX - this._totalW / 2;
      transform.y = this.treeY - this._aboveGround;
      transform.width = this._totalW;
      transform.height = this._totalH;
    }

    const collider = this.getComponent('collider');
    if (collider) {
      collider.offsetX = this._totalW / 2 - this.trunkW / 2;
      collider.offsetY = this.canopyR + 10;
      collider.width = this.trunkW;
      collider.height = this.trunkH;
    }
  }

  _generateAllBranches(branchCount) {
    // Each branch uses its own seed for stability when new branches appear
    this.branches = [];
    for (let i = 0; i < branchCount; i++) {
      const rng = seededRandom(this.seed + i * 7919);
      const t = 0.15 + (i / Math.max(branchCount, 1)) * 0.65;
      const side = i % 2 === 0 ? -1 : 1;
      const angle = side * (0.4 + rng() * 0.8);
      const length = 30 + rng() * 35;
      const thickness = 3 + rng() * 3;
      const startY = -this.trunkH * t;

      const subBranches = [];
      const subCount = Math.min(1 + Math.floor(rng() * 3), this.maxSubBranches);
      for (let j = 0; j < subCount; j++) {
        const subT = 0.4 + rng() * 0.5;
        const subAngle = angle + (rng() - 0.5) * 1.2;
        const subLength = 12 + rng() * 20;
        subBranches.push({
          t: subT,
          angle: subAngle,
          length: subLength,
          thickness: Math.max(1, thickness * 0.5),
          leafData: this._generateLeafData(rng, subLength),
        });
      }

      this.branches.push({
        startY,
        angle,
        length,
        thickness,
        subBranches,
        leafData: this._generateLeafData(rng, length),
      });
    }

    // Canopy leaves (separate seed for stability)
    const canopyRng = seededRandom(this.seed + 50000);
    this.canopyLeaves = [];
    const canopyCount = 4 + Math.floor(canopyRng() * 5);
    for (let i = 0; i < canopyCount; i++) {
      const a = canopyRng() * Math.PI * 2;
      const dist = canopyRng() * this.canopyR * 0.6;
      this.canopyLeaves.push({
        ox: Math.cos(a) * dist,
        oy: Math.sin(a) * dist * 0.8 - this.canopyR * 0.3,
        r: 8 + canopyRng() * 12,
        shade: Math.floor(canopyRng() * 4),
      });
    }
  }

  _generateLeafData(rng, branchLength) {
    if (this.leafClusters <= 0) {
      return {
        mode: 'single',
        tipLeaf: {
          r: 12 + rng() * 10,
          shade: Math.floor(rng() * 4),
        },
      };
    }

    const clusters = [];
    for (let i = 0; i < this.leafClusters; i++) {
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

  // ── Rendering ──

  _renderTree(ctx, sx, sy, w, h) {
    const cx = sx + w / 2;
    const trunkTop = sy + this.canopyR + 10;
    const trunkBottom = sy + this._aboveGround;
    const leafDensity = getLeafSize(this.gameHeight);
    const { greens, darkGreens } = this.leafColor;

    // Roots (below trunk base)
    if (this.roots.length > 0) {
      this._renderRoots(ctx, cx, trunkBottom);
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, trunkBottom + 4, this.canopyR * 0.9, this.canopyR * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk (tapered)
    ctx.fillStyle = '#5C3A1E';
    ctx.beginPath();
    ctx.moveTo(cx - this.trunkW / 2 - 3, trunkBottom);
    ctx.lineTo(cx - this.trunkW / 2 + 2, trunkTop);
    ctx.lineTo(cx + this.trunkW / 2 - 2, trunkTop);
    ctx.lineTo(cx + this.trunkW / 2 + 3, trunkBottom);
    ctx.closePath();
    ctx.fill();

    // Bark texture
    ctx.strokeStyle = '#4A2E16';
    ctx.lineWidth = 1;
    const barkLines = Math.max(2, Math.floor(this.trunkW / 5));
    for (let i = 0; i < barkLines; i++) {
      const lx = cx - this.trunkW / 2 + 4 + i * (this.trunkW / barkLines);
      ctx.beginPath();
      ctx.moveTo(lx, trunkTop + 6);
      ctx.bezierCurveTo(
        lx + 1, trunkTop + this.trunkH * 0.3,
        lx - 1, trunkTop + this.trunkH * 0.6,
        lx + 1, trunkBottom - 4,
      );
      ctx.stroke();
    }

    // Branches and their leaves
    this._renderBranches(ctx, cx, trunkTop, leafDensity, greens, darkGreens);

    // Canopy leaves
    if (leafDensity > 0) {
      for (const leaf of this.canopyLeaves) {
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

    // Light highlight on canopy
    if (leafDensity > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.ellipse(cx - 8, trunkTop - 20, this.canopyR * 0.3, this.canopyR * 0.25, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Owner name
    if (this.ownerName) {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const nameY = sy - 6;

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(this.ownerName, cx, nameY);

      ctx.fillStyle = '#e8f5e0';
      ctx.fillText(this.ownerName, cx, nameY);
    }
  }

  _renderRoots(ctx, cx, groundY) {
    for (const root of this.roots) {
      const endX = cx + Math.cos(root.angle) * root.length;
      const endY = groundY + Math.sin(root.angle) * root.length * 0.6 + 5;
      const cpx = cx + (endX - cx) * 0.5;
      const cpy = groundY + (endY - groundY) * 0.3;

      // Main root line
      ctx.strokeStyle = '#5C3A1E';
      ctx.lineCap = 'round';
      ctx.lineWidth = 2 + root.length * 0.03;
      ctx.beginPath();
      ctx.moveTo(cx, groundY);
      ctx.quadraticCurveTo(cpx, cpy, endX, endY);
      ctx.stroke();

      // Dark outline for depth
      ctx.strokeStyle = '#3D2510';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, groundY);
      ctx.quadraticCurveTo(cpx, cpy, endX, endY);
      ctx.stroke();
    }
  }

  _renderBranches(ctx, cx, trunkTop, leafDensity, greens, darkGreens) {
    for (const branch of this.branches) {
      const startX = cx;
      const startY = trunkTop - branch.startY;

      const endX = startX + Math.cos(branch.angle - Math.PI / 2) * branch.length;
      const endY = startY + Math.sin(branch.angle - Math.PI / 2) * branch.length;

      ctx.strokeStyle = '#5C3A1E';
      ctx.lineWidth = branch.thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const cpx = startX + (endX - startX) * 0.5 + (branch.angle > 0 ? 5 : -5);
      const cpy = startY + (endY - startY) * 0.5 - 5;
      ctx.quadraticCurveTo(cpx, cpy, endX, endY);
      ctx.stroke();

      // Sub-branches
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

        if (leafDensity > 0) {
          Tree._renderLeaves(ctx, subStartX, subStartY, subEndX, subEndY, sub.leafData, greens, darkGreens, leafDensity);
        }
      }

      if (leafDensity > 0) {
        Tree._renderLeaves(ctx, startX, startY, endX, endY, branch.leafData, greens, darkGreens, leafDensity);
      }
    }
  }

  static _renderLeaves(ctx, startX, startY, endX, endY, leafData, greens, darkGreens, leafDensity) {
    if (leafData.mode === 'single') {
      const { r, shade } = leafData.tipLeaf;
      const radius = r * leafDensity;
      if (radius < 0.5) return;

      ctx.fillStyle = darkGreens[shade];
      ctx.beginPath();
      ctx.arc(endX + 1, endY + 1, radius + 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = greens[shade];
      ctx.beginPath();
      ctx.arc(endX, endY, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
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
