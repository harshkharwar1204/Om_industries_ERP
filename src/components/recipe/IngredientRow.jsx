export default function IngredientRow({ ingredient, colors, onChange, onRemove }) {
  return (
    <div className="ingredient-row">
      <select
        className="ingredient-color-select"
        value={ingredient.color_name}
        onChange={(e) => onChange({ ...ingredient, color_name: e.target.value })}
      >
        <option value="">Select dye...</option>
        {colors.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
      <input
        className="ingredient-qty"
        type="number"
        step="0.01"
        min="0"
        placeholder="Grams"
        value={ingredient.quantity_liters || ''}
        onChange={(e) => onChange({ ...ingredient, quantity_liters: parseFloat(e.target.value) || 0 })}
      />
      <button className="ingredient-remove" onClick={onRemove} title="Remove ingredient">✕</button>
    </div>
  );
}
