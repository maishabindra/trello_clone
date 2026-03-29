const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.send('🚀 Taskello Backend is Running!');
});

// ── Database Setup ─────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'taskello.db'));

db.exec(`
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    background_color TEXT DEFAULT '#0052cc',
    is_starred INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    position INTEGER DEFAULT 0,
    due_date TEXT,
    is_complete INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS card_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL,
    UNIQUE(card_id, label_id)
  );

  CREATE TABLE IF NOT EXISTS checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_complete INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    author TEXT DEFAULT 'Alex Johnson',
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT,
    email TEXT
  );
`);

// Seed demo data if empty
const boardCount = db.prepare('SELECT COUNT(*) as c FROM boards').get();
if (boardCount.c === 0) {
  const insertBoard = db.prepare(`INSERT INTO boards (title, background_color, is_starred) VALUES (?,?,?)`);
  const insertList  = db.prepare(`INSERT INTO lists (board_id, title, position) VALUES (?,?,?)`);
  const insertCard  = db.prepare(`INSERT INTO cards (list_id, title, description, position, due_date, is_complete) VALUES (?,?,?,?,?,?)`);
  const insertLabel = db.prepare(`INSERT INTO card_labels (card_id, label_id) VALUES (?,?)`);

  const b1 = insertBoard.run('My Project Board', '#0052cc', 1).lastInsertRowid;
  const b2 = insertBoard.run('Marketing Campaign', '#00875a', 0).lastInsertRowid;

  const l1 = insertList.run(b1, 'Backlog', 0).lastInsertRowid;
  const l2 = insertList.run(b1, 'In Progress', 1).lastInsertRowid;
  const l3 = insertList.run(b1, 'Done', 2).lastInsertRowid;

  const c1 = insertCard.run(l1, 'Research competitors', 'Analyze top 5 competitors', 0, null, 0).lastInsertRowid;
  const c2 = insertCard.run(l1, 'Setup project repo', '', 1, null, 0).lastInsertRowid;
  const c3 = insertCard.run(l1, 'Design system foundations', 'Colors, type, spacing tokens', 2, null, 0).lastInsertRowid;
  const c4 = insertCard.run(l2, 'Build auth flow', 'Login, signup, password reset', 0,
    new Date(Date.now() + 2*86400000).toISOString().split('T')[0], 0).lastInsertRowid;
  const c5 = insertCard.run(l2, 'Fix nav bar bug on mobile', '', 1,
    new Date(Date.now() - 86400000).toISOString().split('T')[0], 0).lastInsertRowid;
  const c6 = insertCard.run(l3, 'Project kickoff meeting', '', 0, null, 1).lastInsertRowid;
  const c7 = insertCard.run(l3, 'Tech stack decision', '', 1, null, 1).lastInsertRowid;

  insertLabel.run(c1, 'research');
  insertLabel.run(c2, 'feature');
  insertLabel.run(c3, 'design');
  insertLabel.run(c4, 'feature');
  insertLabel.run(c4, 'bug');
  insertLabel.run(c5, 'bug');
  insertLabel.run(c5, 'urgent');
  insertLabel.run(c6, 'done');
  insertLabel.run(c7, 'done');

  const l4 = insertList.run(b2, 'Ideas', 0).lastInsertRowid;
  const l5 = insertList.run(b2, 'Active', 1).lastInsertRowid;
  insertCard.run(l4, 'Social media strategy', '', 0, null, 0);
  insertCard.run(l5, 'Launch email campaign', '', 0, null, 0);

  db.prepare(`INSERT INTO members (name, email) VALUES (?,?)`).run('Alex Johnson', 'alex@example.com');
}

// ── Helper ─────────────────────────────────────────────────────
function getCardFull(cardId) {
  const card = db.prepare('SELECT * FROM cards WHERE id=?').get(cardId);
  if (!card) return null;
  card.is_complete = Boolean(card.is_complete);
  card.labels = db.prepare('SELECT * FROM card_labels WHERE card_id=?').all(cardId);
  const cls = db.prepare('SELECT * FROM checklists WHERE card_id=? ORDER BY position').all(cardId);
  card.checklists = cls.map(cl => ({
    ...cl,
    items: db.prepare('SELECT * FROM checklist_items WHERE checklist_id=? ORDER BY position').all(cl.id)
      .map(it => ({ ...it, is_complete: Boolean(it.is_complete) })),
  }));
  card.comments = db.prepare('SELECT * FROM comments WHERE card_id=? ORDER BY created_at').all(cardId);
  return card;
}

// ── Boards ─────────────────────────────────────────────────────
app.get('/api/boards', (req, res) => {
  const boards = db.prepare('SELECT * FROM boards ORDER BY is_starred DESC, created_at DESC').all();
  const result = boards.map(b => {
    const list_count = db.prepare('SELECT COUNT(*) as c FROM lists WHERE board_id=?').get(b.id).c;
    const card_count = db.prepare(`
      SELECT COUNT(*) as c FROM cards WHERE list_id IN (SELECT id FROM lists WHERE board_id=?)
    `).get(b.id).c;
    return { ...b, is_starred: Boolean(b.is_starred), list_count, card_count };
  });
  res.json(result);
});

app.get('/api/boards/:id', (req, res) => {
  const board = db.prepare('SELECT * FROM boards WHERE id=?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const lists = db.prepare('SELECT * FROM lists WHERE board_id=? ORDER BY position').all(board.id);
  board.lists = lists.map(list => {
    const cards = db.prepare('SELECT * FROM cards WHERE list_id=? ORDER BY position').all(list.id);
    list.cards = cards.map(card => {
      card.is_complete = Boolean(card.is_complete);
      card.labels = db.prepare('SELECT * FROM card_labels WHERE card_id=?').all(card.id);
      const cls = db.prepare('SELECT * FROM checklists WHERE card_id=? ORDER BY position').all(card.id);
      card.checklists = cls.map(cl => ({
        ...cl,
        items: db.prepare('SELECT * FROM checklist_items WHERE checklist_id=? ORDER BY position').all(cl.id)
          .map(it => ({ ...it, is_complete: Boolean(it.is_complete) })),
      }));
      return card;
    });
    return list;
  });
  board.is_starred = Boolean(board.is_starred);
  res.json(board);
});

app.post('/api/boards', (req, res) => {
  const { title, background_color } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const result = db.prepare('INSERT INTO boards (title, background_color) VALUES (?,?)').run(title, background_color || '#0052cc');
  const board = db.prepare('SELECT * FROM boards WHERE id=?').get(result.lastInsertRowid);
  res.json({ ...board, is_starred: false, list_count: 0, card_count: 0 });
});

app.put('/api/boards/:id', (req, res) => {
  const { title, background_color, is_starred } = req.body;
  const board = db.prepare('SELECT * FROM boards WHERE id=?').get(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  db.prepare('UPDATE boards SET title=?, background_color=?, is_starred=? WHERE id=?').run(
    title ?? board.title,
    background_color ?? board.background_color,
    is_starred !== undefined ? (is_starred ? 1 : 0) : board.is_starred,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM boards WHERE id=?').get(req.params.id));
});

app.delete('/api/boards/:id', (req, res) => {
  db.prepare('DELETE FROM boards WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── Lists ──────────────────────────────────────────────────────
app.post('/api/lists', (req, res) => {
  const { board_id, title, position } = req.body;
  if (!board_id || !title) return res.status(400).json({ error: 'board_id and title required' });
  const result = db.prepare('INSERT INTO lists (board_id, title, position) VALUES (?,?,?)').run(board_id, title, position ?? 0);
  res.json(db.prepare('SELECT * FROM lists WHERE id=?').get(result.lastInsertRowid));
});

app.put('/api/lists/:id', (req, res) => {
  const { title, position } = req.body;
  const list = db.prepare('SELECT * FROM lists WHERE id=?').get(req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });
  db.prepare('UPDATE lists SET title=?, position=? WHERE id=?').run(
    title ?? list.title, position ?? list.position, req.params.id
  );
  res.json(db.prepare('SELECT * FROM lists WHERE id=?').get(req.params.id));
});

app.delete('/api/lists/:id', (req, res) => {
  db.prepare('DELETE FROM lists WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/lists/reorder/batch', (req, res) => {
  const { lists } = req.body;
  const update = db.prepare('UPDATE lists SET position=? WHERE id=?');
  const tx = db.transaction(() => lists.forEach(l => update.run(l.position, l.id)));
  tx();
  res.json({ success: true });
});

// ── Cards ──────────────────────────────────────────────────────
app.post('/api/cards', (req, res) => {
  const { list_id, title, description, position } = req.body;
  if (!list_id || !title) return res.status(400).json({ error: 'list_id and title required' });
  const pos = position ?? db.prepare('SELECT COUNT(*) as c FROM cards WHERE list_id=?').get(list_id).c;
  const result = db.prepare('INSERT INTO cards (list_id, title, description, position) VALUES (?,?,?,?)').run(
    list_id, title, description || '', pos
  );
  res.json(getCardFull(result.lastInsertRowid));
});

app.get('/api/cards/:id', (req, res) => {
  const card = getCardFull(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(card);
});

app.patch('/api/cards/:id', (req, res) => {
  const card = db.prepare('SELECT * FROM cards WHERE id=?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  const { title, description, due_date, is_complete, list_id, position } = req.body;
  db.prepare(`UPDATE cards SET
    title=?, description=?, due_date=?, is_complete=?, list_id=?, position=?
    WHERE id=?`).run(
    title ?? card.title,
    description ?? card.description,
    due_date !== undefined ? due_date : card.due_date,
    is_complete !== undefined ? (is_complete ? 1 : 0) : card.is_complete,
    list_id ?? card.list_id,
    position ?? card.position,
    req.params.id
  );
  res.json(getCardFull(req.params.id));
});

app.delete('/api/cards/:id', (req, res) => {
  db.prepare('DELETE FROM cards WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/cards/reorder/batch', (req, res) => {
  const { cards } = req.body;
  const update = db.prepare('UPDATE cards SET list_id=?, position=? WHERE id=?');
  const tx = db.transaction(() => cards.forEach(c => update.run(c.list_id, c.position, c.id)));
  tx();
  res.json({ success: true });
});

// ── Labels ─────────────────────────────────────────────────────
app.post('/api/cards/:id/labels', (req, res) => {
  const { label_id } = req.body;
  try {
    db.prepare('INSERT OR IGNORE INTO card_labels (card_id, label_id) VALUES (?,?)').run(req.params.id, label_id);
  } catch (e) {}
  res.json({ success: true });
});

app.delete('/api/cards/:id/labels/:labelId', (req, res) => {
  db.prepare('DELETE FROM card_labels WHERE card_id=? AND label_id=?').run(req.params.id, req.params.labelId);
  res.json({ success: true });
});

// ── Checklists ─────────────────────────────────────────────────
app.post('/api/cards/:id/checklists', (req, res) => {
  const { title } = req.body;
  const result = db.prepare('INSERT INTO checklists (card_id, title) VALUES (?,?)').run(req.params.id, title);
  res.json({ id: result.lastInsertRowid, card_id: req.params.id, title, items: [] });
});

app.delete('/api/cards/:id/checklists/:clId', (req, res) => {
  db.prepare('DELETE FROM checklists WHERE id=? AND card_id=?').run(req.params.clId, req.params.id);
  res.json({ success: true });
});

app.post('/api/cards/:id/checklists/:clId/items', (req, res) => {
  const { text } = req.body;
  const result = db.prepare('INSERT INTO checklist_items (checklist_id, text) VALUES (?,?)').run(req.params.clId, text);
  res.json({ id: result.lastInsertRowid, checklist_id: req.params.clId, text, is_complete: false });
});

app.put('/api/cards/:id/checklists/:clId/items/:itemId', (req, res) => {
  const { is_complete, text } = req.body;
  const item = db.prepare('SELECT * FROM checklist_items WHERE id=?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  db.prepare('UPDATE checklist_items SET is_complete=?, text=? WHERE id=?').run(
    is_complete !== undefined ? (is_complete ? 1 : 0) : item.is_complete,
    text ?? item.text,
    req.params.itemId
  );
  const updated = db.prepare('SELECT * FROM checklist_items WHERE id=?').get(req.params.itemId);
  res.json({ ...updated, is_complete: Boolean(updated.is_complete) });
});

app.delete('/api/cards/:id/checklists/:clId/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM checklist_items WHERE id=?').run(req.params.itemId);
  res.json({ success: true });
});

// ── Comments ───────────────────────────────────────────────────
app.post('/api/cards/:id/comments', (req, res) => {
  const { text, author } = req.body;
  const result = db.prepare('INSERT INTO comments (card_id, text, author) VALUES (?,?,?)').run(
    req.params.id, text, author || 'Alex Johnson'
  );
  res.json(db.prepare('SELECT * FROM comments WHERE id=?').get(result.lastInsertRowid));
});

// ── Members ────────────────────────────────────────────────────
app.get('/api/members', (req, res) => {
  res.json(db.prepare('SELECT * FROM members').all());
});

// ── Search ─────────────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const results = db.prepare(`
    SELECT c.id, c.title, l.title as list_title, b.title as board_title, b.id as board_id
    FROM cards c
    JOIN lists l ON l.id = c.list_id
    JOIN boards b ON b.id = l.board_id
    WHERE c.title LIKE ?
    LIMIT 20
  `).all(`%${q}%`);
  res.json(results);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});