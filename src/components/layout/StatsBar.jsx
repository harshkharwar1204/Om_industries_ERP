export default function StatsBar({ totalRecipes, totalColors, totalClients }) {
  return (
    <div className="stats-bar">
      <div 
        className="stat-card" 
        style={{ cursor: 'pointer' }}
        onClick={() => document.getElementById('recipe-log-section')?.scrollIntoView({ behavior: 'smooth' })}
        title="View Recipe Log"
      >
        <div className="stat-info">
          <div className="stat-label">Total Recipes</div>
          <div className="stat-value">{totalRecipes}</div>
        </div>
        <div className="stat-icon">📋</div>
      </div>
    </div>
  );
}
