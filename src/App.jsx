import { useState, useEffect, useCallback } from 'react';
import Header from './components/layout/Header';
import StatsBar from './components/layout/StatsBar';
import FundamentalColors from './components/fundamental-colors/FundamentalColors';
import RecipeCreator from './components/recipe/RecipeCreator';
import RecipeLog from './components/recipe-log/RecipeLog';
import RecipeViewModal from './components/recipe-log/RecipeViewModal';
import * as api from './services/api';

export default function App() {
  const [colors, setColors] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [viewRecipe, setViewRecipe] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadColors = useCallback(async () => {
    try { setColors(await api.getColors()); } catch (e) { console.error(e); }
  }, []);

  const loadRecipes = useCallback(async () => {
    try { setRecipes(await api.getRecipes()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { 
    Promise.all([loadColors(), loadRecipes()]); 
  }, [loadColors, loadRecipes]);

  const handleAddColor = async (name) => {
    try {
      await api.addColor(name);
      loadColors();
      showToast(`Dye "${name.toUpperCase()}" added`);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDeleteColor = async (id) => {
    try {
      await api.deleteColor(id);
      loadColors();
      showToast('Dye removed');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleEditColor = async (id, newName, oldName) => {
    try {
      await api.updateColor(id, newName, oldName);
      loadColors();
      // Also reload recipes in case ingredients were updated
      loadRecipes();
      showToast(`Dye updated to "${newName.toUpperCase()}"`);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleSaveRecipe = async (recipe) => {
    try {
      if (editingRecipe) {
        await api.updateRecipe(editingRecipe.id, recipe);
        setEditingRecipe(null);
        showToast('Recipe updated!');
      } else {
        await api.createRecipe(recipe);
        showToast('Recipe saved!');
      }
      loadRecipes();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleViewRecipe = async (id) => {
    try { setViewRecipe(await api.getRecipe(id)); } catch (e) { showToast(e.message, 'error'); }
  };

  const handleEditRecipe = async (id) => {
    try { 
      setEditingRecipe(await api.getRecipe(id)); 
      setTimeout(() => {
        document.getElementById('recipe-creator-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) { showToast(e.message, 'error'); }
  };

  const handleDeleteRecipe = async (id) => {
    try {
      await api.deleteRecipe(id);
      loadRecipes();
      showToast('Recipe deleted');
    } catch (e) { showToast(e.message, 'error'); }
  };

  const uniqueClients = [...new Set(recipes.map(r => r.client).filter(Boolean))];

  return (
    <div>
      <Header />
      <StatsBar totalRecipes={recipes.length} totalColors={colors.length} totalClients={uniqueClients.length} />

      <RecipeLog
        recipes={recipes}
        onView={handleViewRecipe}
        onEdit={handleEditRecipe}
        onDelete={handleDeleteRecipe}
      />

      <div className="main-layout">
        <FundamentalColors 
          colors={colors} 
          onAdd={handleAddColor} 
          onDelete={handleDeleteColor} 
          onEdit={handleEditColor} 
        />
        <RecipeCreator
          colors={colors}
          onSave={handleSaveRecipe}
          editingRecipe={editingRecipe}
          onCancelEdit={() => setEditingRecipe(null)}
        />
      </div>

      {viewRecipe && (
        <RecipeViewModal 
          recipe={viewRecipe} 
          onClose={() => setViewRecipe(null)} 
          onEdit={() => {
            handleEditRecipe(viewRecipe.id);
            setViewRecipe(null);
          }}
          onDelete={() => {
            handleDeleteRecipe(viewRecipe.id);
            setViewRecipe(null);
          }}
        />
      )}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
    </div>
  );
}
