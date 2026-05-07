export default function StatsBar({ totalRecipes, totalColors, totalClients }) {
  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className="stat-info">
          <div className="stat-label">Total Recipes</div>
          <div className="stat-value">{totalRecipes}</div>
        </div>
        <div className="stat-icon">📋</div>
      </div>
      <div className="stat-card">
        <div className="stat-info">
          <div className="stat-label">Total Dyes</div>
          <div className="stat-value">{totalColors}</div>
        </div>
        <div className="stat-icon">🎨</div>
      </div>
      <div className="stat-card">
        <div className="stat-info">
          <div className="stat-label">Active Clients</div>
          <div className="stat-value">{totalClients || 'N/A'}</div>
        </div>
        <div className="stat-icon">👥</div>
      </div>
    </div>
  );
}
