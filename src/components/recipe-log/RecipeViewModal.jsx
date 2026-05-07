import React from 'react';

export default function RecipeViewModal({ recipe, onClose }) {
  if (!recipe) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content print-area" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-actions">
            <h2 className="modal-title">
              Recipe #{recipe.code} <span className="title-divider">|</span> <span className="title-client">{recipe.client}</span>
            </h2>
            <button className="print-btn no-print" onClick={() => window.print()} title="Print Recipe">🖨️ Print</button>
          </div>
          <button className="modal-close no-print" onClick={onClose}>✕</button>
        </div>

        <div className="modal-meta modal-meta-3">
          <div className="modal-meta-item">
            <div className="modal-meta-label">Fabric</div>
            <div className="modal-meta-value">{recipe.fabric || '—'}</div>
          </div>
          <div className="modal-meta-item">
            <div className="modal-meta-label">Total Volume (Water)</div>
            <div className="modal-meta-value">{recipe.total_liters ? `${recipe.total_liters} L` : '—'}</div>
          </div>
          <div className="modal-meta-item">
            <div className="modal-meta-label">Created</div>
            <div className="modal-meta-value">
              {new Date(recipe.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {recipe.shades && recipe.shades.length > 0 && (
          <div>
            {recipe.shades.map((shade, idx) => (
              <div key={idx} className="modal-shade">
                <div className="modal-shade-title">Shade #{shade.shade_number}</div>
                {shade.ingredients && shade.ingredients.map((ing, i) => (
                  <div key={i} className="modal-ingredient">
                    <span className="modal-ingredient-name">{ing.color_name}</span>
                    <span className="modal-ingredient-qty">{ing.quantity_liters} g</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {recipe.notes && (
          <div className="modal-notes no-print">
            <div className="modal-notes-label">Notes</div>
            <div className="modal-notes-text">{recipe.notes}</div>
          </div>
        )}

      </div>
    </div>
  );
}
