const express = require('express');
const router = express.Router();
const db = require('../db.cjs');

// GET all recipes (summary list)
router.get('/', (req, res) => {
  try {
    const recipes = db.prepare(`
      SELECT r.*, COUNT(DISTINCT s.id) as shade_count
      FROM recipes r
      LEFT JOIN shades s ON s.recipe_id = r.id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single recipe with full details
router.get('/:id', (req, res) => {
  try {
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const shades = db.prepare('SELECT * FROM shades WHERE recipe_id = ? ORDER BY shade_number ASC').all(req.params.id);

    for (const shade of shades) {
      shade.ingredients = db.prepare('SELECT * FROM ingredients WHERE shade_id = ?').all(shade.id);
    }

    recipe.shades = shades;
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new recipe
router.post('/', (req, res) => {
  const { code, client, fabric, total_liters, notes, shades } = req.body;

  if (!code || !client) {
    return res.status(400).json({ error: 'Recipe code and client are required' });
  }

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (code, client, fabric, total_liters, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertShade = db.prepare(`
    INSERT INTO shades (recipe_id, shade_number)
    VALUES (?, ?)
  `);

  const insertIngredient = db.prepare(`
    INSERT INTO ingredients (shade_id, color_name, quantity_liters)
    VALUES (?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const recipeResult = insertRecipe.run(
      code.trim(),
      client.trim(),
      fabric ? fabric.trim() : '',
      total_liters || 0,
      notes ? notes.trim() : ''
    );
    const recipeId = recipeResult.lastInsertRowid;

    if (shades && shades.length > 0) {
      shades.forEach((shade, index) => {
        const shadeResult = insertShade.run(recipeId, index + 1);
        const shadeId = shadeResult.lastInsertRowid;

        if (shade.ingredients && shade.ingredients.length > 0) {
          shade.ingredients.forEach(ingredient => {
            insertIngredient.run(shadeId, ingredient.color_name, ingredient.quantity_liters || 0);
          });
        }
      });
    }

    return recipeId;
  });

  try {
    const recipeId = transaction();
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a recipe
router.put('/:id', (req, res) => {
  const { code, client, fabric, total_liters, notes, shades } = req.body;

  const transaction = db.transaction(() => {
    // Update recipe metadata
    db.prepare(`
      UPDATE recipes SET code = ?, client = ?, fabric = ?, total_liters = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(code, client, fabric || '', total_liters || 0, notes || '', req.params.id);

    // Delete old shades and ingredients (cascade)
    db.prepare('DELETE FROM shades WHERE recipe_id = ?').run(req.params.id);

    // Re-insert shades and ingredients
    const insertShade = db.prepare('INSERT INTO shades (recipe_id, shade_number) VALUES (?, ?)');
    const insertIngredient = db.prepare('INSERT INTO ingredients (shade_id, color_name, quantity_liters) VALUES (?, ?, ?)');

    if (shades && shades.length > 0) {
      shades.forEach((shade, index) => {
        const shadeResult = insertShade.run(req.params.id, index + 1);
        const shadeId = shadeResult.lastInsertRowid;

        if (shade.ingredients && shade.ingredients.length > 0) {
          shade.ingredients.forEach(ingredient => {
            insertIngredient.run(shadeId, ingredient.color_name, ingredient.quantity_liters || 0);
          });
        }
      });
    }
  });

  try {
    transaction();
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a recipe
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
