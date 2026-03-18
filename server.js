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
        branchCount: 10,
        subBranchCount: 0,
        leafDensity: 1,
        leafClusters: 0,
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

    const token = generateToken();
    sessions.set(token, user._id);

    res.json({
      token,
      user: { username: user.username, tree: user.tree },
    });
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
      tree: p.tree,
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
