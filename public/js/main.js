import { Game } from './engine/Game.js';
import { GameMap } from './world/GameMap.js';
import { Tree } from './entities/Tree.js';
import { Flower } from './entities/Flower.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

async function loadWorld() {
  const res = await fetch('/api/world');
  const saved = await res.json();
  return saved;
}

async function saveWorld(worldData) {
  await fetch('/api/world', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(worldData),
  });
}

function generateFlowers(map, centerX, centerY) {
  const flowers = [];
  const rng = (min, max) => min + Math.random() * (max - min);

  for (let i = 0; i < 6000; i++) {
    const fx = rng(64, map.pixelWidth - 64);
    const fy = rng(64, map.pixelHeight - 64);

    const dx = fx - centerX;
    const dy = fy - centerY;
    if (Math.sqrt(dx * dx + dy * dy) < 80) continue;

    const flower = new Flower(fx, fy);
    flowers.push(flower);
  }

  return flowers;
}

async function init() {
  let saved = await loadWorld();

  // Map config
  const mapW = saved?.map?.widthInTiles ?? 320;
  const mapH = saved?.map?.heightInTiles ?? 320;
  const map = new GameMap(mapW, mapH);

  for (const tile of map.getEntities()) {
    game.addEntity(tile);
  }

  // Tree
  const centerX = map.getCenterX();
  const centerY = map.getCenterY();

  let treeOpts;
  if (saved?.tree) {
    treeOpts = {
      seed: saved.tree.seed,
      branchCount: saved.tree.branchCount,
      subBranchCount: saved.tree.subBranchCount,
      leafDensity: saved.tree.leafDensity,
      leafClusters: saved.tree.leafClusters,
    };
  } else {
    treeOpts = { leafDensity: 1, branchCount: 10, subBranchCount: 0 };
  }

  const treeX = saved?.tree?.x ?? centerX;
  const treeY = saved?.tree?.y ?? centerY;
  const tree = new Tree(treeX, treeY, treeOpts);
  game.addEntity(tree);

  // Flowers
  let flowers;
  if (saved?.flowers?.length) {
    flowers = saved.flowers.map(f => new Flower(f.x, f.y, f));
  } else {
    flowers = generateFlowers(map, centerX, centerY);
  }

  for (const flower of flowers) {
    game.addEntity(flower);
  }

  // Save world state if it was freshly generated
  if (!saved) {
    const worldData = {
      map: { widthInTiles: mapW, heightInTiles: mapH },
      tree: tree.treeData,
      flowers: flowers.map(f => f.flowerData),
    };
    await saveWorld(worldData);
  }

  // Center camera on the tree
  game.camera.follow(treeX, treeY);
  game.camera.x = treeX - game.canvas.width / 2;
  game.camera.y = treeY - game.canvas.height / 2;

  // Camera: right-click drag to pan, scroll to zoom, space to recenter
  const ZOOM_SPEED = 0.0015;

  const originalUpdate = game._update.bind(game);
  game._update = function (dt) {
    // Pan camera with right-click drag
    const drag = this.input.consumeDrag();
    if (drag.dx !== 0 || drag.dy !== 0) {
      this.camera.targetX -= drag.dx / this.camera.zoom;
      this.camera.targetY -= drag.dy / this.camera.zoom;
    }

    // Zoom with scroll wheel
    const scroll = this.input.consumeScroll();
    if (scroll !== 0) {
      const oldZoom = this.camera.targetZoom;
      const zoomFactor = 1 - scroll * ZOOM_SPEED;
      this.camera.zoomBy(zoomFactor);
      const newZoom = this.camera.targetZoom;

      const cx = this.camera.targetX + (this.camera.width / oldZoom) / 2;
      const cy = this.camera.targetY + (this.camera.height / oldZoom) / 2;
      this.camera.targetX = cx - (this.camera.width / newZoom) / 2;
      this.camera.targetY = cy - (this.camera.height / newZoom) / 2;
    }

    // Space to recenter on tree
    if (this.input.wasKeyPressed('Space')) {
      this.camera.follow(treeX, treeY);
      this.camera.setZoom(1);
    }

    // Clamp camera to map bounds
    const vw = this.camera.width / this.camera.targetZoom;
    const vh = this.camera.height / this.camera.targetZoom;
    this.camera.targetX = Math.max(0, Math.min(map.pixelWidth - vw, this.camera.targetX));
    this.camera.targetY = Math.max(0, Math.min(map.pixelHeight - vh, this.camera.targetY));

    originalUpdate(dt);
    this.input.endFrame();
  };

  game.start();
}

init();
