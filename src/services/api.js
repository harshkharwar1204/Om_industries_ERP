const API_BASE = '/api';

// ==================== FUNDAMENTAL COLORS ====================
export async function getColors() {
  const res = await fetch(`${API_BASE}/colors`);
  if (!res.ok) throw new Error('Failed to fetch colors');
  return res.json();
}

export async function addColor(name) {
  const res = await fetch(`${API_BASE}/colors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add color');
  }
  return res.json();
}

export async function deleteColor(id) {
  const res = await fetch(`${API_BASE}/colors/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete color');
  return res.json();
}

export async function updateColor(id, newName, oldName) {
  const res = await fetch(`${API_BASE}/colors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName, oldName }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update color');
  }
  return res.json();
}

// ==================== RECIPES ====================
export async function getRecipes() {
  const res = await fetch(`${API_BASE}/recipes`);
  if (!res.ok) throw new Error('Failed to fetch recipes');
  return res.json();
}

export async function getRecipe(id) {
  const res = await fetch(`${API_BASE}/recipes/${id}`);
  if (!res.ok) throw new Error('Failed to fetch recipe');
  return res.json();
}

export async function createRecipe(recipe) {
  const res = await fetch(`${API_BASE}/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create recipe');
  }
  return res.json();
}

export async function updateRecipe(id, recipe) {
  const res = await fetch(`${API_BASE}/recipes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  });
  if (!res.ok) throw new Error('Failed to update recipe');
  return res.json();
}

export async function deleteRecipe(id) {
  const res = await fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete recipe');
  return res.json();
}
