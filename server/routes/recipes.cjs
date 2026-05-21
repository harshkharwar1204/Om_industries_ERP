const express = require('express');
const router = express.Router();
const supabase = require('../db.cjs');

// GET all recipes (summary list)
router.get('/', async (req, res) => {
  try {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*, shades(id)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = recipes.map(r => ({
      ...r,
      shade_count: r.shades ? r.shades.length : 0
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single recipe with full details
router.get('/:id', async (req, res) => {
  try {
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (recipeError || !recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const { data: shades, error: shadesError } = await supabase
      .from('shades')
      .select('*, ingredients(*)')
      .eq('recipe_id', req.params.id)
      .order('shade_number', { ascending: true });

    if (shadesError) throw shadesError;

    recipe.shades = shades;
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new recipe
router.post('/', async (req, res) => {
  const { code, client, fabric, total_liters, notes, shades } = req.body;

  if (!code || !client) {
    return res.status(400).json({ error: 'Recipe code and client are required' });
  }

  try {
    // 1. Insert Recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert([{
        code: code.trim(),
        client: client.trim(),
        fabric: fabric ? fabric.trim() : '',
        total_liters: total_liters || 0,
        notes: notes ? notes.trim() : ''
      }])
      .select()
      .single();

    if (recipeError) throw recipeError;

    // 2. Batch insert all shades at once
    if (shades && shades.length > 0) {
      const shadesToInsert = shades.map((_, i) => ({
        recipe_id: recipe.id,
        shade_number: i + 1
      }));

      const { data: insertedShades, error: shadeError } = await supabase
        .from('shades')
        .insert(shadesToInsert)
        .select();

      if (shadeError) throw shadeError;

      // 3. Batch insert all ingredients at once
      const allIngredients = [];
      insertedShades.forEach((insertedShade, i) => {
        const shade = shades[i];
        if (shade.ingredients && shade.ingredients.length > 0) {
          shade.ingredients.forEach(ing => {
            allIngredients.push({
              shade_id: insertedShade.id,
              color_name: ing.color_name,
              quantity_liters: ing.quantity_liters || 0
            });
          });
        }
      });

      if (allIngredients.length > 0) {
        const { error: ingError } = await supabase
          .from('ingredients')
          .insert(allIngredients);
        if (ingError) throw ingError;
      }
    }

    // 3. Return created recipe
    res.status(201).json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a recipe
router.put('/:id', async (req, res) => {
  const { code, client, fabric, total_liters, notes, shades } = req.body;
  const recipeId = req.params.id;

  try {
    // 1. Update Recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .update({
        code,
        client,
        fabric: fabric || '',
        total_liters: total_liters || 0,
        notes: notes || '',
        created_at: new Date().toISOString()
      })
      .eq('id', recipeId)
      .select()
      .single();

    if (recipeError) throw recipeError;

    // 2. Delete old shades (cascade will delete ingredients)
    const { error: deleteError } = await supabase
      .from('shades')
      .delete()
      .eq('recipe_id', recipeId);
      
    if (deleteError) throw deleteError;

    // 3. Batch insert all new shades at once
    if (shades && shades.length > 0) {
      const shadesToInsert = shades.map((_, i) => ({
        recipe_id: parseInt(recipeId),
        shade_number: i + 1
      }));

      const { data: insertedShades, error: shadeError } = await supabase
        .from('shades')
        .insert(shadesToInsert)
        .select();

      if (shadeError) throw shadeError;

      // 4. Batch insert all ingredients at once
      const allIngredients = [];
      insertedShades.forEach((insertedShade, i) => {
        const shade = shades[i];
        if (shade.ingredients && shade.ingredients.length > 0) {
          shade.ingredients.forEach(ing => {
            allIngredients.push({
              shade_id: insertedShade.id,
              color_name: ing.color_name,
              quantity_liters: ing.quantity_liters || 0
            });
          });
        }
      });

      if (allIngredients.length > 0) {
        const { error: ingError } = await supabase
          .from('ingredients')
          .insert(allIngredients);
        if (ingError) throw ingError;
      }
    }

    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a recipe
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Recipe deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
