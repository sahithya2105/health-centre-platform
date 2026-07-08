import React, { useEffect, useState } from 'react';
import { getMedicineDemand } from '../api';

export default function MedicineDemandTable({ medicines, t }) {
  const [demands, setDemands] = useState({});

  useEffect(() => {
    medicines.forEach(m => {
      getMedicineDemand(m.id).then(d => setDemands(prev => ({ ...prev, [m.id]: d })));
    });
  }, [medicines]);

  return (
    <div className="card">
      <h3>{t('medicineDemandPrediction')}</h3>
      <table>
        <thead>
          <tr>
            <th>{t('medicineNameLabel')}</th>
            <th>{t('stock')}</th>
            <th>{t('weeklyRequirement')}</th>
            <th>{t('predictedShortage')}</th>
            <th>{t('confidence')}</th>
            <th>{t('recommendedRestock')}</th>
          </tr>
        </thead>
        <tbody>
          {medicines.map(m => {
            const d = demands[m.id];
            return (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.current_stock} {m.unit}</td>
                <td>{d ? d.weeklyRequirement : '-'}</td>
                <td>{d ? d.predictedShortage : '-'}</td>
                <td>{d ? `${d.confidence}%` : '-'}</td>
                <td>
                  {d && d.recommendedRestock > 0 ? (
                    <span className={`badge ${d.urgency === 'CRITICAL' || d.urgency === 'HIGH' ? 'HIGH' : d.urgency === 'MEDIUM' ? 'MEDIUM' : 'LOW'}`}>
                      {d.recommendedRestock} {m.unit}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}