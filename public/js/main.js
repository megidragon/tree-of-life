import { Game } from './engine/Game.js';
import { GameMap } from './world/GameMap.js';
import { Tree } from './entities/Tree.js';
import { Flower } from './entities/Flower.js';

const TILE = 64;
const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// ── Auth helpers ──

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiGet(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function apiPut(url, body, token) {
  await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// ── Login UI ──

function setupLoginUI() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('loginOverlay');
    const errorEl = document.getElementById('loginError');
    const usernameEl = document.getElementById('loginUsername');
    const passwordEl = document.getElementById('loginPassword');
    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');

    async function doAuth(endpoint) {
      const username = usernameEl.value.trim();
      const password = passwordEl.value;
      if (!username || !password) {
        errorEl.textContent = 'Enter username and password';
        return;
      }
      errorEl.textContent = '';
      btnLogin.disabled = btnRegister.disabled = true;

      try {
        const data = await apiPost(endpoint, { username, password });
        overlay.classList.add('hidden');
        resolve({ token: data.token, user: data.user });
      } catch (err) {
        errorEl.textContent = err.message;
      } finally {
        btnLogin.disabled = btnRegister.disabled = false;
      }
    }

    btnLogin.addEventListener('click', () => doAuth('/api/login'));
    btnRegister.addEventListener('click', () => doAuth('/api/register'));

    passwordEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doAuth('/api/login');
    });
  });
}

// ── Flower generation ──

function generateFlowers(map) {
  const flowers = [];
  const rng = (min, max) => min + Math.random() * (max - min);

  for (let i = 0; i < 6000; i++) {
    const fx = rng(64, map.pixelWidth - 64);
    const fy = rng(64, map.pixelHeight - 64);
    flowers.push(new Flower(fx, fy));
  }
  return flowers;
}

// ── Game init ──

async function init() {
  // 1. Login
  const { token, user } = await setupLoginUI();

  // 2. Load shared world (map + flowers)
  let world = await apiGet('/api/world', token);

  const mapW = world?.map?.widthInTiles ?? 320;
  const mapH = world?.map?.heightInTiles ?? 320;
  const map = new GameMap(mapW, mapH);

  for (const tile of map.getEntities()) {
    game.addEntity(tile);
  }

  // Flowers
  let flowers;
  if (world?.flowers?.length) {
    flowers = world.flowers.map(f => new Flower(f.x, f.y, f));
  } else {
    flowers = generateFlowers(map);
    world = {
      map: { widthInTiles: mapW, heightInTiles: mapH },
      flowers: flowers.map(f => f.flowerData),
    };
    await apiPut('/api/world', world, token);
  }

  for (const flower of flowers) {
    game.addEntity(flower);
  }

  // 3. Load all players' trees
  const players = await apiGet('/api/players', token);

  for (const p of players) {
    const t = p.tree;
    const tree = new Tree(t.x, t.y, {
      seed: t.seed,
      branchCount: t.branchCount,
      subBranchCount: t.subBranchCount,
      leafDensity: t.leafDensity,
      leafClusters: t.leafClusters,
      ownerName: p.username,
    });
    game.addEntity(tree);
  }

  // 4. Setup fog of war centered on player's tree
  const myTree = user.tree;
  const clearTiles = myTree.visionRadius;   // 6 tiles
  const fogExtraTiles = 2;                  // 2 tiles of foggy view
  const clearRadius = clearTiles * TILE;
  const fogRadius = (clearTiles + fogExtraTiles) * TILE;

  game.camera.fog.enabled = true;
  game.camera.fog.sources = [
    { x: myTree.x, y: myTree.y, clearRadius, fogRadius },
  ];

  // 5. Center camera on player's tree
  game.camera.follow(myTree.x, myTree.y);
  game.camera.x = myTree.x - game.canvas.width / 2;
  game.camera.y = myTree.y - game.canvas.height / 2;

  // 6. Camera controls
  const ZOOM_SPEED = 0.0015;

  const originalUpdate = game._update.bind(game);
  game._update = function (dt) {
    // Pan with right-click drag
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

    // Space to recenter on own tree
    if (this.input.wasKeyPressed('Space')) {
      this.camera.follow(myTree.x, myTree.y);
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
