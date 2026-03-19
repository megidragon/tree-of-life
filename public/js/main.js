import { Game } from './engine/Game.js';
import { GameMap } from './world/GameMap.js';
import { Tree } from './entities/Tree.js';
import { Flower } from './entities/Flower.js';
import {
  tickGrowth,
  createRoot,
  createDirectedRoot,
  canCreateRoot,
  canCreateDirectedRoot,
  getVitality,
  getGrowthRate,
  getBranchCount,
  getLeafSize,
  MAX_HEIGHT,
  ROOT_HP_COST,
  DIRECTED_ROOT_COST_MULT,
} from './gameplay/TreeStats.js';

const TILE = 64;
const SAVE_INTERVAL = 30000; // 30 seconds
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

async function apiPatch(url, body, token) {
  await fetch(url, {
    method: 'PATCH',
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

// ── Fog sources from branches ──

function buildFogSources(gameState, myTreeEntity) {
  const clearTiles = gameState.visionRadius;
  const fogExtraTiles = 2;
  const clearRadius = clearTiles * TILE;
  const fogRadius = (clearTiles + fogExtraTiles) * TILE;

  const sources = [
    { x: gameState.x, y: gameState.y, clearRadius, fogRadius },
  ];

  // Each branch adds a small vision zone at its endpoint
  const endpoints = myTreeEntity.getBranchEndpoints();
  for (const ep of endpoints) {
    sources.push({
      x: ep.x,
      y: ep.y,
      clearRadius: 1.5 * TILE,
      fogRadius: 2.5 * TILE,
    });
  }

  return sources;
}

// ── Action bar definition ──

const ACTION_SLOTS = [
  {
    key: '1', code: 'Digit1',
    name: 'Root',
    desc: 'Random',
    cost: ROOT_HP_COST,
    canUse: (gs) => canCreateRoot(gs),
  },
  {
    key: '2', code: 'Digit2',
    name: 'Root',
    desc: 'Directed',
    cost: ROOT_HP_COST * DIRECTED_ROOT_COST_MULT,
    canUse: (gs) => canCreateDirectedRoot(gs),
  },
  { key: '3', code: 'Digit3', name: '---', locked: true },
  { key: '4', code: 'Digit4', name: '---', locked: true },
  { key: '5', code: 'Digit5', name: '---', locked: true },
  { key: '6', code: 'Digit6', name: '---', locked: true },
  { key: '7', code: 'Digit7', name: '---', locked: true },
  { key: '8', code: 'Digit8', name: '---', locked: true },
];

// ── HUD rendering ──

function renderHUD(ctx, cvs, gameState) {
  // ── Stats panel (top-left) ──
  const padding = 16;
  const px = padding;
  let py = padding;
  const lineH = 20;

  const vitality = getVitality(gameState.height);
  const growthRate = getGrowthRate(gameState.roots);
  const branchCount = getBranchCount(gameState.height);
  const leafPct = (getLeafSize(gameState.height) * 100).toFixed(0);

  const panelW = 240;
  const panelH = lineH * 7 + padding + 4;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.roundRect(px - 8, py - 8, panelW, panelH, 6);
  ctx.fill();

  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#8eca8e';
  ctx.fillText('Tree Stats', px, py);
  py += lineH + 4;

  ctx.font = '13px monospace';

  ctx.fillStyle = '#e8f5e0';
  ctx.fillText(`Height:   ${gameState.height.toFixed(1)} / ${MAX_HEIGHT}`, px, py);
  py += lineH;

  const hpPct = vitality > 0 ? gameState.currentHP / vitality : 0;
  ctx.fillText(`Vitality: ${Math.floor(gameState.currentHP)} / ${vitality}`, px, py);
  py += lineH - 4;

  const barX = px;
  const barW = panelW - 24;
  const barH = 6;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(barX, py, barW, barH);
  ctx.fillStyle = hpPct > 0.5 ? '#4CAF50' : hpPct > 0.25 ? '#FFC107' : '#F44336';
  ctx.fillRect(barX, py, barW * hpPct, barH);
  py += barH + 8;

  ctx.fillStyle = '#e8f5e0';
  ctx.fillText(`Branches: ${branchCount}`, px, py);
  py += lineH;
  ctx.fillText(`Leaves:   ${leafPct}%`, px, py);
  py += lineH;
  ctx.fillText(`Growth:   ${(growthRate * 60).toFixed(2)} /min`, px, py);
  py += lineH;
  ctx.fillText(`Roots:    ${gameState.roots.length}`, px, py);

  // ── Action bar (bottom-center) ──
  renderActionBar(ctx, cvs, gameState);
}

function renderActionBar(ctx, cvs, gameState) {
  const slotW = 74;
  const slotH = 50;
  const gap = 4;
  const totalW = ACTION_SLOTS.length * slotW + (ACTION_SLOTS.length - 1) * gap;
  const startX = (cvs.width - totalW) / 2;
  const startY = cvs.height - slotH - 16;

  for (let i = 0; i < ACTION_SLOTS.length; i++) {
    const slot = ACTION_SLOTS[i];
    const sx = startX + i * (slotW + gap);

    const available = !slot.locked && slot.canUse(gameState);
    const locked = !!slot.locked;

    // Slot background
    if (locked) {
      ctx.fillStyle = 'rgba(30, 30, 30, 0.6)';
    } else if (available) {
      ctx.fillStyle = 'rgba(20, 50, 20, 0.75)';
    } else {
      ctx.fillStyle = 'rgba(50, 20, 20, 0.65)';
    }
    ctx.beginPath();
    ctx.roundRect(sx, startY, slotW, slotH, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = locked ? 'rgba(255,255,255,0.1)' : available ? 'rgba(140,200,140,0.5)' : 'rgba(200,100,100,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(sx, startY, slotW, slotH, 4);
    ctx.stroke();

    // Key number (top-left badge)
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = locked ? 'rgba(255,255,255,0.2)' : available ? '#aaddaa' : '#aa7777';
    ctx.fillText(slot.key, sx + 5, startY + 4);

    // Slot name
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = locked ? 'rgba(255,255,255,0.15)' : '#e8f5e0';
    ctx.fillText(slot.name, sx + slotW / 2, startY + 6);

    if (!locked) {
      // Description
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(slot.desc, sx + slotW / 2, startY + 21);

      // Cost
      ctx.font = '10px monospace';
      ctx.fillStyle = available ? '#88bb88' : '#886666';
      ctx.fillText(`-${slot.cost} HP`, sx + slotW / 2, startY + 34);
    }
  }
}

// ── Mouse → world coordinates ──

function screenToWorld(mouseX, mouseY, camera) {
  return {
    wx: camera.x + mouseX / camera.zoom,
    wy: camera.y + mouseY / camera.zoom,
  };
}

// ── Save game state ──

let _saveToken = null;
let _gameState = null;

async function saveGameState() {
  if (!_saveToken || !_gameState) return;
  _gameState.lastUpdateTime = Date.now();
  try {
    await apiPatch('/api/tree', { tree: _gameState }, _saveToken);
  } catch (e) {
    console.warn('Failed to save tree state:', e);
  }
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

  let myTreeEntity = null;
  for (const p of players) {
    const t = p.tree;
    const tree = new Tree(t.x, t.y, {
      seed: t.seed,
      height: t.height,
      roots: t.roots,
      subBranchCount: t.subBranchCount ?? 2,
      leafClusters: t.leafClusters ?? 0,
      ownerName: p.username,
    });
    game.addEntity(tree);

    if (p.username === user.username) {
      myTreeEntity = tree;
    }
  }

  // 4. Initialize gameplay state (from server, already has offline growth applied)
  let gameState = { ...user.tree };
  _saveToken = token;
  _gameState = gameState;

  // 5. Setup fog of war (tree + branches)
  game.camera.fog.enabled = true;
  game.camera.fog.sources = buildFogSources(gameState, myTreeEntity);

  // 6. Center camera on player's tree
  game.camera.follow(gameState.x, gameState.y);
  game.camera.x = gameState.x - game.canvas.width / 2;
  game.camera.y = gameState.y - game.canvas.height / 2;

  // 7. HUD
  game.onRenderUI = (ctx, cvs) => renderHUD(ctx, cvs, gameState);

  // 8. Camera controls + gameplay update
  const ZOOM_SPEED = 0.0015;
  let lastBranchCount = getBranchCount(gameState.height);

  const originalUpdate = game._update.bind(game);
  game._update = function (dt) {
    // ── Growth tick (tree + roots extend) ──
    gameState = tickGrowth(gameState, dt);
    _gameState = gameState;

    // Update tree entity visuals
    myTreeEntity.setHeight(gameState.height);
    myTreeEntity.setRoots(gameState.roots);

    // Update fog if branch count changed
    const currentBranchCount = getBranchCount(gameState.height);
    if (currentBranchCount !== lastBranchCount) {
      lastBranchCount = currentBranchCount;
      game.camera.fog.sources = buildFogSources(gameState, myTreeEntity);
    }

    // ── Action keys ──

    // [1] Random root
    if (this.input.wasKeyPressed('Digit1')) {
      const newState = createRoot(gameState);
      if (newState) {
        gameState = newState;
        _gameState = gameState;
        myTreeEntity.setRoots(gameState.roots);
        game.camera.fog.sources = buildFogSources(gameState, myTreeEntity);
        saveGameState();
      }
    }

    // [2] Directed root (toward mouse cursor)
    if (this.input.wasKeyPressed('Digit2')) {
      const { wx, wy } = screenToWorld(this.input.mouse.x, this.input.mouse.y, this.camera);
      const newState = createDirectedRoot(gameState, wx, wy);
      if (newState) {
        gameState = newState;
        _gameState = gameState;
        myTreeEntity.setRoots(gameState.roots);
        game.camera.fog.sources = buildFogSources(gameState, myTreeEntity);
        saveGameState();
      }
    }

    // [3-8] Reserved — no-op for now

    // ── Camera: pan with right-click drag ──
    const drag = this.input.consumeDrag();
    if (drag.dx !== 0 || drag.dy !== 0) {
      this.camera.targetX -= drag.dx / this.camera.zoom;
      this.camera.targetY -= drag.dy / this.camera.zoom;
    }

    // ── Camera: zoom with scroll wheel ──
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

    // ── Space to recenter on own tree ──
    if (this.input.wasKeyPressed('Space')) {
      this.camera.follow(gameState.x, gameState.y);
      this.camera.setZoom(1);
    }

    // ── Clamp camera to map bounds ──
    const vw = this.camera.width / this.camera.targetZoom;
    const vh = this.camera.height / this.camera.targetZoom;
    this.camera.targetX = Math.max(0, Math.min(map.pixelWidth - vw, this.camera.targetX));
    this.camera.targetY = Math.max(0, Math.min(map.pixelHeight - vh, this.camera.targetY));

    originalUpdate(dt);
    this.input.endFrame();
  };

  // 9. Periodic save
  setInterval(saveGameState, SAVE_INTERVAL);

  // Save when tab becomes hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveGameState();
  });

  // 10. Start game
  game.start();
}

init();
