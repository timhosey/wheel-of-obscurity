const db = require('./init');

function getAll(opts = {}) {
  let sql = 'SELECT id, name, platform, selected_at FROM games';
  const params = [];
  if (opts.played === true) {
    sql += ' WHERE selected_at IS NOT NULL';
  } else if (opts.played === false) {
    sql += ' WHERE selected_at IS NULL';
  }
  sql += ' ORDER BY id';
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function getById(id) {
  const stmt = db.prepare('SELECT id, name, platform, selected_at FROM games WHERE id = ?');
  return stmt.get(id);
}

function insert(name, platform) {
  const stmt = db.prepare('INSERT INTO games (name, platform) VALUES (?, ?)');
  const result = stmt.run(name, platform);
  return getById(result.lastInsertRowid);
}

function update(id, name, platform) {
  const stmt = db.prepare('UPDATE games SET name = ?, platform = ? WHERE id = ?');
  stmt.run(name, platform, id);
  return getById(id);
}

function remove(id) {
  const stmt = db.prepare('DELETE FROM games WHERE id = ?');
  return stmt.run(id);
}

function pickRandom() {
  const stmt = db.prepare('SELECT id, name, platform, selected_at FROM games ORDER BY RANDOM() LIMIT 1');
  return stmt.get();
}

/** Returns a random subset of games for the wheel (e.g. 16).
 *  opts.played: true = only played, false = only unplayed, undefined = all */
function getRandomWheelGames(count, opts = {}) {
  let sql = 'SELECT id, name, platform, selected_at FROM games';
  if (opts.played === true) sql += ' WHERE selected_at IS NOT NULL';
  else if (opts.played === false) sql += ' WHERE selected_at IS NULL';
  sql += ' ORDER BY RANDOM() LIMIT ?';
  const stmt = db.prepare(sql);
  return stmt.all(count);
}

/** Mark a game as selected/played at the current time. */
function markSelected(id) {
  const stmt = db.prepare(
    "UPDATE games SET selected_at = datetime('now') WHERE id = ?"
  );
  stmt.run(id);
  return getById(id);
}

/** Clear a game's played status. */
function markUnselected(id) {
  const stmt = db.prepare('UPDATE games SET selected_at = NULL WHERE id = ?');
  stmt.run(id);
  return getById(id);
}

module.exports = {
  getAll,
  getById,
  insert,
  update,
  remove,
  pickRandom,
  getRandomWheelGames,
  markSelected,
  markUnselected,
};
