import IngredientRow from './IngredientRow';

export default function ColorPart({ shade, shadeIndex, colors, onChange, onRemove }) {
  const addIngredient = () => {
    const updated = { ...shade };
    updated.ingredients = [...(updated.ingredients || []), { color_name: '', quantity_liters: 0 }];
    onChange(updated);
  };

  const updateIngredient = (idx, ingredient) => {
    const updated = { ...shade };
    updated.ingredients = [...updated.ingredients];
    updated.ingredients[idx] = ingredient;
    onChange(updated);
  };

  const removeIngredient = (idx) => {
    const updated = { ...shade };
    updated.ingredients = updated.ingredients.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div className="shade-card">
      <div className="shade-header">
        <div className="shade-name">
          ⚙️ Shade {shadeIndex + 1}
          <span className="shade-subtitle">Define ingredients and quantity for this shade</span>
        </div>
        <button className="shade-delete-btn" onClick={onRemove} title="Remove shade">🗑️</button>
      </div>

      <div className="ingredients-label">Ingredients</div>
      {(shade.ingredients || []).map((ingredient, idx) => (
        <IngredientRow
          key={idx}
          ingredient={ingredient}
          colors={colors}
          onChange={(updated) => updateIngredient(idx, updated)}
          onRemove={() => removeIngredient(idx)}
        />
      ))}

      <button className="add-ingredient-btn" onClick={addIngredient} type="button">
        ➕ Add Ingredient
      </button>
    </div>
  );
}
