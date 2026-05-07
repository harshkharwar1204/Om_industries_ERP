const express = require('express');
const router = express.Router();
const supabase = require('../db.cjs');

// GET all colors
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('colors')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new color
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Color name is required' });
  }
  try {
    const colorName = name.trim().toUpperCase();
    const { data, error } = await supabase
      .from('colors')
      .insert([{ name: colorName }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Postgres unique violation code
        return res.status(409).json({ error: 'Color already exists' });
      }
      throw error;
    }
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a color
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('colors')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ message: 'Color deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE a color
router.put('/:id', async (req, res) => {
  const { name, oldName } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Color name is required' });
  }
  try {
    const colorName = name.trim().toUpperCase();
    
    // Update the color in the colors table
    const { data, error } = await supabase
      .from('colors')
      .update({ name: colorName })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Color already exists' });
      }
      throw error;
    }

    // Optional: Cascade the name change to existing ingredients
    if (oldName) {
      const { error: ingError } = await supabase
        .from('ingredients')
        .update({ color_name: colorName })
        .eq('color_name', oldName);
      
      if (ingError) console.error('Failed to cascade color name update to ingredients:', ingError);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
