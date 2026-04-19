const express = require('express');
const path = require('path');
const games = require('./db/games');

const app = express();
const PORT = process.env.PORT || 3000;

// SSE clients for wheel view
const sseClients = [];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Last spin result (in-memory) for initial state when wheel connects
let lastSpin = null;

const WHEEL_SIZE = 16;

// --- REST: Games CRUD ---
app.get('/api/games', (req, res) => {
  try {
    const played = req.query.played;
    const opts = {};
    if (played === '1') opts.played = true;
    else if (played === '0') opts.played = false;
    const list = games.getAll(opts);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/games', (req, res) => {
  const { name, platform } = req.body || {};
  if (!name || !platform) {
    return res.status(400).json({ error: 'name and platform are required' });
  }
  try {
    const row = games.insert(String(name).trim(), String(platform).trim());
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/games/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const row = games.getById(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

app.put('/api/games/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  const { name, platform } = req.body || {};
  if (!name || !platform) {
    return res.status(400).json({ error: 'name and platform are required' });
  }
  try {
    const row = games.update(id, String(name).trim(), String(platform).trim());
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/games/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const result = games.remove(id);
    if (result.changes === 0) return res.status(404).json({ error: 'not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Mark game as unplayed ---
app.put('/api/games/:id/unplay', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    const row = games.markUnselected(id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Reset wheel with a specific game pool ---
app.post('/api/wheel/reset', (req, res) => {
  const { filter } = req.body || {};
  const opts = {};
  if (filter === 'unplayed') opts.played = false;
  else if (filter === 'played') opts.played = true;
  const list = games.getRandomWheelGames(WHEEL_SIZE, opts);
  if (list.length === 0) {
    return res.status(400).json({ error: 'no games match the filter' });
  }
  lastSpin = null;
  const payload = { games: list, lastSpin: null };
  sseClients.forEach((client) => {
    try {
      client.write(`event: state\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (_) {}
  });
  res.json({ games: list });
});

// --- Spin: SSE stream ---
app.get('/api/spin/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const list = games.getRandomWheelGames(WHEEL_SIZE, { played: false });
  res.write(`event: state\ndata: ${JSON.stringify({ games: list, lastSpin })}\n\n`);

  sseClients.push(res);
  req.on('close', () => {
    const i = sseClients.indexOf(res);
    if (i !== -1) sseClients.splice(i, 1);
  });
});

// --- Spin: trigger ---
app.post('/api/spin', (req, res) => {
  const wheelList = games.getRandomWheelGames(WHEEL_SIZE, { played: false });
  if (wheelList.length === 0) {
    return res.status(400).json({ error: 'no games in database' });
  }
  const segmentIndex = Math.floor(Math.random() * wheelList.length);
  const chosen = wheelList[segmentIndex];
  games.markSelected(chosen.id);
  const payload = {
    games: wheelList,
    game: chosen,
    segmentIndex,
    totalSegments: wheelList.length,
  };
  lastSpin = payload;

  sseClients.forEach((client) => {
    try {
      client.write(`event: spin\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (_) {}
  });

  res.json(payload);
});

app.listen(PORT, () => {
  console.log(`Wheel of Obscurity running at http://localhost:${PORT}`);
  console.log(`  Management: http://localhost:${PORT}/`);
  console.log(`  Wheel (OBS): http://localhost:${PORT}/wheel.html`);
});
