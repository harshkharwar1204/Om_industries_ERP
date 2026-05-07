import { useState, useEffect } from 'react';
import ColorPart from './ColorPart';

const emptyShade = () => ({ ingredients: [{ color_name: '', quantity_liters: 0 }] });

const emptyForm = {
  code: '', client: '', fabric: '', total_liters: '', notes: '',
  shades: [emptyShade()],
};

export default function RecipeCreator({ colors, onSave, editingRecipe, onCancelEdit }) {
  const [form, setForm] = useState(emptyForm);
  const [focusedLiters, setFocusedLiters] = useState(null);

  useEffect(() => {
    if (editingRecipe) {
      setForm({
        code: editingRecipe.code || '',
        client: editingRecipe.client || '',
        fabric: editingRecipe.fabric || '',
        total_liters: editingRecipe.total_liters || '',
        notes: editingRecipe.notes || '',
        shades: editingRecipe.shades && editingRecipe.shades.length > 0
          ? editingRecipe.shades
          : [emptyShade()],
      });
      setFocusedLiters(editingRecipe.total_liters);
    } else {
      setForm(emptyForm);
    }
  }, [editingRecipe]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addShade = () => setForm(prev => ({ ...prev, shades: [...prev.shades, emptyShade()] }));

  const updateShade = (idx, shade) => {
    setForm(prev => {
      const shades = [...prev.shades];
      shades[idx] = shade;
      return { ...prev, shades };
    });
  };

  const removeShade = (idx) => {
    setForm(prev => ({
      ...prev,
      shades: prev.shades.filter((_, i) => i !== idx),
    }));
  };

  const handleLitersFocus = () => {
    setFocusedLiters(parseFloat(form.total_liters));
  };

  const handleLitersBlur = () => {
    const newVal = parseFloat(form.total_liters);
    const oldVal = focusedLiters;

    if (!isNaN(newVal) && !isNaN(oldVal) && oldVal > 0 && newVal > 0 && oldVal !== newVal) {
      const ratio = newVal / oldVal;
      setForm(prev => ({
        ...prev,
        shades: prev.shades.map(shade => ({
          ...shade,
          ingredients: shade.ingredients.map(ing => ({
            ...ing,
            quantity_liters: parseFloat((ing.quantity_liters * ratio).toFixed(2)) || 0
          }))
        }))
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.code.trim() || !form.client.trim()) return;
    onSave({
      ...form,
      total_liters: parseFloat(form.total_liters) || 0,
    });
    if (!editingRecipe) resetForm();
  };

  const resetForm = () => {
    setForm(emptyForm);
    if (onCancelEdit) onCancelEdit();
  };

  return (
    <div className="card" id="recipe-creator-section">
      <div className="card-title">
        <span className="card-title-icon">📝</span>
        {editingRecipe ? 'Edit Recipe' : 'Recipe Creator'}
      </div>

      <datalist id="dye-colors">
        {colors.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>

      <form onSubmit={handleSubmit}>
        <div className="recipe-form-grid">
          <div className="form-group">
            <label className="form-label">Recipe Code</label>
            <div className="form-input-icon">
              <span>#</span>
              <input className="form-input" placeholder="e.g., 9192A" value={form.code}
                onChange={(e) => updateField('code', e.target.value)} id="recipe-code" required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Client / Party</label>
            <div className="form-input-icon">
              <span>🏢</span>
              <input className="form-input" placeholder="e.g., Premium Textiles Ltd." value={form.client}
                onChange={(e) => updateField('client', e.target.value)} id="recipe-client" required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Fabric</label>
            <input className="form-input" placeholder="e.g., Cotton, Polyester, Catonic" value={form.fabric}
              onChange={(e) => updateField('fabric', e.target.value)} id="recipe-fabric" />
          </div>
          <div className="form-group">
            <label className="form-label">Total Liters (Water)</label>
            <input className="form-input" type="number" step="0.01" min="0" placeholder="e.g., 5.00"
              value={form.total_liters} 
              onChange={(e) => updateField('total_liters', e.target.value)} 
              onFocus={handleLitersFocus}
              onBlur={handleLitersBlur}
              id="recipe-liters" />
          </div>
          <div className="form-group recipe-form-full">
            <label className="form-label">Notes (Optional)</label>
            <textarea className="form-textarea" placeholder="Any special instructions, dye type, or batch details..."
              value={form.notes} onChange={(e) => updateField('notes', e.target.value)} id="recipe-notes" />
          </div>
        </div>

        <div className="shades-section">
          <div className="shades-title">🎨 Shades</div>
          {form.shades.map((shade, idx) => (
            <ColorPart
              key={idx}
              shade={shade}
              shadeIndex={idx}
              colors={colors}
              onChange={(updated) => updateShade(idx, updated)}
              onRemove={() => removeShade(idx)}
            />
          ))}
          <button type="button" className="add-shade-btn" onClick={addShade}>
            ➕ Add Another Shade
          </button>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-save" id="save-recipe-btn">
            💾 {editingRecipe ? 'Update Recipe' : 'Save Recipe'}
          </button>
          <button type="button" className="btn-reset" onClick={resetForm}>
            ↩️ {editingRecipe ? 'Cancel' : 'Reset Form'}
          </button>
        </div>
      </form>
    </div>
  );
}
