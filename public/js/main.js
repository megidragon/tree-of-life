import { Game } from './engine/Game.js';
import { GameMap } from './world/GameMap.js';
import { Tree } from './entities/Tree.js';
import { Flower } from './entities/Flower.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// Create meadow map (32x32 tiles)
const map = new GameMap(32, 32);

// Add terrain tiles to the game
for (const tile of map.getEntities()) {
  game.addEntity(tile);
}

// Place tree at the center of the map
const centerX = map.getCenterX();
const centerY = map.getCenterY();
const tree = new Tree(centerX, centerY, {
  leafDensity: 1,
  branchCount: 3,
  subBranchCount: 0,
});
game.addEntity(tree);

// Scatter some flowers around the meadow
const rng = (min, max) => min + Math.random() * (max - min);
for (let i = 0; i < 60; i++) {
  const fx = rng(64, map.pixelWidth - 64);
  const fy = rng(64, map.pixelHeight - 64);

  // Don't place flowers too close to the tree
  const dx = fx - centerX;
  const dy = fy - centerY;
  if (Math.sqrt(dx * dx + dy * dy) < 80) continue;

  game.addEntity(new Flower(fx, fy));
}

// Center camera on the map
game.camera.follow(centerX, centerY);
game.camera.x = centerX - game.canvas.width / 2;
game.camera.y = centerY - game.canvas.height / 2;

// Camera movement with keyboard
const CAMERA_SPEED = 300;
const originalUpdate = game._update.bind(game);
game._update = function (dt) {
  const move = this.input.getMovementVector();
  this.camera.targetX += move.dx * CAMERA_SPEED * dt;
  this.camera.targetY += move.dy * CAMERA_SPEED * dt;

  // Clamp camera to map bounds
  this.camera.targetX = Math.max(0, Math.min(map.pixelWidth - this.camera.width, this.camera.targetX));
  this.camera.targetY = Math.max(0, Math.min(map.pixelHeight - this.camera.height, this.camera.targetY));

  originalUpdate(dt);
};

game.start();
