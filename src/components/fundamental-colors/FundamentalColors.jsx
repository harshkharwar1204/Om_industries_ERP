import { useState } from 'react';

export default function FundamentalColors({ colors, onAdd, onDelete }) {
  const [newColor, setNewColor] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (newColor.trim()) {
      onAdd(newColor.trim());
      setNewColor('');
    }
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
              <span>{color.name}</span>
              <button
                className="color-delete-btn"
                onClick={() => onDelete(color.id)}
                title="Delete color"
              >
                🗑️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
