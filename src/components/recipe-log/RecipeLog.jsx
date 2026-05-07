import { useState } from 'react';

export default function RecipeLog({ recipes, onView, onEdit, onDelete }) {
  const [search, setSearch] = useState('');

  const filtered = recipes.filter(r =>
    r.code.toLowerCase().includes(search.toLowerCase()) ||
    r.client.toLowerCase().includes(search.toLowerCase()) ||
    (r.fabric && r.fabric.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="recipe-log">
      <div className="card">
        <div className="log-header">
          <div className="log-title">
            <span>📜</span> Saved Recipes Log
          </div>
          <input
            className="log-search"
            type="text"
            placeholder="Search recipes by code or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="recipe-search"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">
              {search ? 'No recipes match your search' : 'No recipes saved yet. Create your first recipe above!'}
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="recipe-table">
            <thead>
              <tr>
                <th>Recipe Code</th>
                <th>Client</th>
                <th>Fabric</th>
                <th>Shades</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((recipe) => (
                <tr key={recipe.id}>
                  <td>
                    <div className="recipe-code-cell">
                      <div className="recipe-code-icon">📄</div>
                      <div>
                        <div className="recipe-code-text">{recipe.code}</div>
                        <div className="recipe-code-sub">Standard Recipe</div>
                      </div>
                    </div>
                  </td>
                  <td>{recipe.client}</td>
                  <td>{recipe.fabric || '—'}</td>
                  <td>
                    <span className="parts-badge">
                      {recipe.shade_count} {recipe.shade_count === 1 ? 'Shade' : 'Shades'}
                    </span>
                  </td>
                  <td>{new Date(recipe.created_at).toLocaleDateString()}</td>
                  <td>
                    <button className="action-btn action-view" onClick={() => onView(recipe.id)} title="View">👁️</button>
                    <button className="action-btn action-edit" onClick={() => onEdit(recipe.id)} title="Edit">✏️</button>
                    <button className="action-btn action-delete" onClick={() => onDelete(recipe.id)} title="Delete">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
