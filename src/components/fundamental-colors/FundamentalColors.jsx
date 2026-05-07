import { useState } from 'react';

export default function FundamentalColors({ colors, onAdd, onDelete, onEdit }) {
  const [newColor, setNewColor] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (newColor.trim()) {
      onAdd(newColor.trim());
      setNewColor('');
    }
  };

  const startEdit = (color) => {
    setEditingId(color.id);
    setEditName(color.name);
  };

  const saveEdit = (color) => {
    if (editName.trim() && editName.trim() !== color.name) {
      onEdit(color.id, editName.trim(), color.name);
    }
    setEditingId(null);
  };

  return (
    <div className="card">
      <div className="card-title">
        <span className="card-title-icon">🖌️</span>
        Dye Names
      </div>

      <form className="color-add-form" onSubmit={handleAdd}>
        <input
          className="color-add-input"
          type="text"
          placeholder="e.g., SKY BLUE XPL"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          id="add-color-input"
        />
        <button className="color-add-btn" type="submit" id="add-color-btn">+</button>
      </form>

      <div className="colors-label">Available Dyes</div>
      <div className="color-list">
        {colors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-text">No dyes added yet</div>
          </div>
        ) : (
          colors.map((color) => (
            <div key={color.id} className="color-item">
              {editingId === color.id ? (
                <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(color);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button onClick={() => saveEdit(color)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green' }}>✅</button>
                  <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'red' }}>❌</button>
                </div>
              ) : (
                <>
                  <span>{color.name}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className="color-edit-btn"
                      onClick={() => startEdit(color)}
                      title="Edit color"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}
                    >
                      ✏️
                    </button>
                    <button
                      className="color-delete-btn"
                      onClick={() => onDelete(color.id)}
                      title="Delete color"
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
