const express = require('express');
const path = require('path');
const Datastore = require('nedb-promises');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database stored in /data directory within the project
const db = Datastore.create({
  filename: path.join(__dirname, 'data', 'world.db'),
  autoload: true,
});

// GET world state
app.get('/api/world', async (req, res) => {
  try {
    const world = await db.findOne({ _id: 'world' });
    res.json(world);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT world state (create or replace)
app.put('/api/world', async (req, res) => {
  try {
    const data = req.body;
    data._id = 'world';
    await db.update({ _id: 'world' }, data, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Tree of Life running at http://localhost:${PORT}`);
});
