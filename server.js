const express = require('express');
const path = require('path');
const crypto = require('crypto');
const Datastore = require('nedb-promises');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Databases
const worldDb = Datastore.create({
  filename: path.join(__dirname, 'data', 'world.db'),
  autoload: true,
});

const usersDb = Datastore.create({
  filename: path.join(__dirname, 'data', 'users.db'),
  autoload: true,
});

// In-memory sessions: token -> userId
const sessions = new Map();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Gameplay constants (mirrored from client TreeStats.js) ──

const GROWTH_BASE_RATE = 0.002;
const GROWTH_ROOT_BONUS = 0.001;
const HP_REGEN_RATE = 0.5;
const MAX_HEIGHT = 100;
const BRANCH_HEIGHT_INTERVAL = 10;
const ROOT_GROWTH_RATE = 0.3;
const ROOT_MAX_LENGTH = 80;

function getBranchCount(height) {
  return Math.floor(height / BRANCH_HEIGHT_INTERVAL);
}

function getLeafSize(height) {
  return Math.min(1, 0.1 + height * 0.009);
}

function getVitality(height) {
  const branches = getBranchCount(height);
  const leafSize = getLeafSize(height);
  return Math.floor(height * 2 + branches * 15 + leafSize * 50);
}

function getGrowthRate(roots) {
  return GROWTH_BASE_RATE + (roots?.length ?? 0) * GROWTH_ROOT_BONUS;
}

/** Apply offline growth to a tree state */
function applyOfflineGrowth(tree) {
  if (!tree.lastUpdateTime || tree.height == null) return tree;

  const now = Date.now();
  const elapsed = (now - tree.lastUpdateTime) / 1000; // seconds
  if (elapsed <= 0) return { ...tree, lastUpdateTime: now };

  const rate = getGrowthRate(tree.roots);
  const height = Math.min(MAX_HEIGHT, tree.height + rate * elapsed);
  const vitality = getVitality(height);
  const currentHP = Math.min(vitality, (tree.currentHP ?? vitality) + HP_REGEN_RATE * elapsed);

  // Grow existing roots
  const roots = (tree.roots || []).map(r => ({
    ...r,
    length: Math.min(ROOT_MAX_LENGTH, (r.length ?? 8) + ROOT_GROWTH_RATE * elapsed),
  }));

  return { ...tree, height, currentHP, roots, lastUpdateTime: now };
}

/** Ensure legacy tree data has all required fields */
function migrateTree(tree) {
  return {
    ...tree,
    height: tree.height ?? 100,
    currentHP: tree.currentHP ?? getVitality(tree.height ?? 100),
    roots: tree.roots ?? [],
    lastUpdateTime: tree.lastUpdateTime ?? Date.now(),
    visionRadius: tree.visionRadius ?? 6,
  };
}

// Auth middleware
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.userId = sessions.get(token);
  next();
}

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const existing = await usersDb.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    // Generate tree position (not near edges, not near other trees)
    const world = await worldDb.findOne({ _id: 'world' });
    const mapW = (world?.map?.widthInTiles ?? 320) * 64;
    const mapH = (world?.map?.heightInTiles ?? 320) * 64;
    const margin = 10 * 64;

    const players = await usersDb.find({});
    let treeX, treeY, attempts = 0;
    do {
      treeX = margin + Math.random() * (mapW - margin * 2);
      treeY = margin + Math.random() * (mapH - margin * 2);
      attempts++;
    } while (
      attempts < 100 &&
      players.some(p => {
        const dx = p.tree.x - treeX;
        const dy = p.tree.y - treeY;
        return Math.sqrt(dx * dx + dy * dy) < 5 * 64;
      })
    );

    const user = {
      username,
      passwordHash,
      salt,
      tree: {
        x: treeX,
        y: treeY,
        seed: Math.floor(Math.random() * 100000),
        height: 1,
        currentHP: 10,
        roots: [],
        lastUpdateTime: Date.now(),
        visionRadius: 6,
      },
    };

    const inserted = await usersDb.insert(user);

    const token = generateToken();
    sessions.set(token, inserted._id);

    res.json({
      token,
      user: { username: user.username, tree: user.tree },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await usersDb.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Migrate and apply offline growth
    let tree = migrateTree(user.tree);
    tree = applyOfflineGrowth(tree);

    // Persist the updated tree
    await usersDb.update({ _id: user._id }, { $set: { tree } });

    const token = generateToken();
    sessions.set(token, user._id);

    res.json({
      token,
      user: { username: user.username, tree },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tree - Save tree game state
app.patch('/api/tree', auth, async (req, res) => {
  try {
    const { tree } = req.body;
    if (!tree) {
      return res.status(400).json({ error: 'Tree data required' });
    }

    // Preserve position and seed, update gameplay state
    await usersDb.update({ _id: req.userId }, { $set: { tree } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/players - all players' public data (trees)
app.get('/api/players', auth, async (req, res) => {
  try {
    const players = await usersDb.find({});
    const data = players.map(p => ({
      username: p.username,
      tree: migrateTree(p.tree),
    }));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/world
app.get('/api/world', async (req, res) => {
  try {
    const world = await worldDb.findOne({ _id: 'world' });
    res.json(world);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/world
app.put('/api/world', auth, async (req, res) => {
  try {
    const data = req.body;
    data._id = 'world';
    await worldDb.update({ _id: 'world' }, data, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Tree of Life running at http://localhost:${PORT}`);
});
