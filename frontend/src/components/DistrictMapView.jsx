import React from 'react';
import { useNavigate } from 'react-router-dom';

function positionFor(id, index, total) {
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const row = Math.floor(index / cols);
  const col = index % cols;
  const x = cols > 1 ? 18 + col * (64 / (cols - 1)) : 50;
  const y = rows > 1 ? 20 + row * (60 / (rows - 1)) : 50;
  return { x, y };
}

export default function DistrictMapView({ centres, t }) {
  const navigate = useNavigate();
  const colorFor = rating =>
    rating === 'GOOD' ? '#2e7d32' : rating === 'NEEDS_ATTENTION' ? '#ef6c00' : '#c62828';

  return (
    <div className="card">
      <h3>{t('districtMap')}</h3>
      <div className="map-container">
        {centres.map((c, i) => {
          const pos = positionFor(c.id, i, centres.length);
          return (
            <div
              key={c.id}
              className="map-marker"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, background: colorFor(c.rating) }}
              title={`${c.name} — ${c.rating.replace('_', ' ')}`}
              onClick={() => navigate(`/centre/${c.id}`)}
            >
              <span className="map-marker-dot" />
              <span className="map-marker-label">{c.name}</span>
            </div>
          );
        })}
      </div>
      <div className="map-legend">
        <span><i style={{ background: '#2e7d32' }} /> {t('good')}</span>
        <span><i style={{ background: '#ef6c00' }} /> {t('needsAttention')}</span>
        <span><i style={{ background: '#c62828' }} /> {t('underperformingLabel')}</span>
      </div>
    </div>
  );
}