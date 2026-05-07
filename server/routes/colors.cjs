const express = require('express');
const router = express.Router();
const db = require('../db.cjs');

// GET all fundamental colors
router.get('/', (req, res) => {
  try {
    const colors = db.prepare('SELECT * FROM fundamental_colors ORDER BY name ASC').all();
    res.json(colors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new fundamental color
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Color name is required' });
  }
  try {
    const stmt = db.prepare('INSERT INTO fundamental_colors (name) VALUES (?)');
    const result = stmt.run(name.trim().toUpperCase());
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim().toUpperCase() });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Color already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE a fundamental color
router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM fundamental_colors WHERE id = ?');
    const result = stmt.run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Color not found' });
    }
    res.json({ message: 'Color deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
