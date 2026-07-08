import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getCentres, getSummary } from '../api';
import StatCard from './StatCard.jsx';
import DistrictBanner from './DistrictBanner.jsx';
import DistrictMapView from './DistrictMapView.jsx';
import InsightsPanel from './InsightsPanel.jsx';
import ProgressBar from './ProgressBar.jsx';

export default function Dashboard() {
  const { t } = useTranslation();
  const [centres, setCentres] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  function load() {
    Promise.all([getCentres(), getSummary()])
      .then(([c, s]) => {
        setCentres(c);
        setSummary(s);
      })
      .finally(() => setLoading(false));
  }

  if (loading || !summary) return <p>{t('loading')}</p>;

  const status = {
    criticalCentres: centres.filter(c => c.rating === 'UNDERPERFORMING').length,
    lowStockMedicines: centres.reduce((s, c) => s + c.lowStockCount, 0),
    doctorsAbsent: centres.reduce((s, c) => s + (c.doctorsTotal - c.doctorsPresentToday), 0),
    bedsAvailable: centres.reduce((s, c) => s + (c.total_beds - c.occupiedBeds), 0),
    unavailableTests: centres.reduce((s, c) => s + c.testsUnavailable, 0)
  };

  const insights = [];
  const lowStockCentre = centres.find(c => c.lowStockCount > 0);
  if (lowStockCentre) insights.push(t('insightLowStock', { centre: lowStockCentre.name, count: lowStockCentre.lowStockCount }));
  const busiest = [...centres].sort((a, b) => b.patientsToday - a.patientsToday)[0];
  if (busiest && busiest.patientsToday > 0) insights.push(t('insightBusiest', { centre: busiest.name, count: busiest.patientsToday }));
  const worst = [...centres].sort((a, b) => a.performanceScore - b.performanceScore)[0];
  if (worst && worst.performanceScore < 70) insights.push(t('insightWorst', { centre: worst.name, score: worst.performanceScore }));

  const healthLabelText = label =>
    ({ EXCELLENT: t('excellent'), GOOD: t('good'), NEEDS_ATTENTION: t('needsAttention'), CRITICAL: t('critical') }[label] || label);

  return (
    <div>
      <DistrictBanner status={status} t={t} />

      <div className="stat-grid">
        <StatCard icon="🏥" label={t('totalCentres')} value={summary.totalCentres} color="green" />
        <StatCard icon="🚨" label={t('activeAlerts')} value={summary.activeAlerts} color={summary.activeAlerts > 0 ? 'red' : 'green'} />
        <StatCard icon="🧍" label={t('totalPatientsToday')} value={summary.totalPatientsToday} color="blue" />
        <StatCard icon="🛏️" label={t('bedsAvailableLabel')} value={summary.availableBeds} color="green" />
        <StatCard icon="🩺" label={t('doctorsPresentToday')} value={`${summary.doctorsPresentToday}/${summary.totalDoctors}`} color="blue" />
        <StatCard icon="💊" label={t('lowStockItems')} value={summary.lowStockMedicines} color={summary.lowStockMedicines > 0 ? 'orange' : 'green'} />
        <StatCard icon="🤖" label={t('avgHealthScore')} value={`${summary.avgHealthScore}/100`} color={summary.avgHealthScore >= 80 ? 'green' : summary.avgHealthScore >= 60 ? 'orange' : 'red'} />
      </div>

      <InsightsPanel insights={insights} t={t} />

      <DistrictMapView centres={centres} t={t} />

      <h2 className="section-title">{t('centres')}</h2>
      <div className="grid">
        {centres.map(c => (
          <div className="card centre-card" key={c.id}>
            <div className="centre-card-header">
              <h3>{c.name}</h3>
              <span className={`badge ${c.riskLevel === 'High' ? 'HIGH' : c.riskLevel === 'Medium' ? 'MEDIUM' : 'LOW'}`}>
                {c.riskLevel} {t('risk')}
              </span>
            </div>
            <p>{t('type')}: {c.type} | {t('district')}: {c.district}</p>
            <p>
              {t('aiHealthScore')}: <b>{c.performanceScore}</b>{' '}
              <span className={`badge ${c.healthLabel}`}>{healthLabelText(c.healthLabel)}</span>
            </p>
            <ProgressBar
              label={t('occupiedBeds')}
              value={c.total_beds ? Math.round((c.occupiedBeds / c.total_beds) * 100) : 0}
              rightLabel={`${c.occupiedBeds}/${c.total_beds}`}
            />
            <div className="mini-stats">
              <span>🩺 {c.doctorsPresentToday}/{c.doctorsTotal}</span>
              <span>🧪 {t('unavailableShort')}: {c.testsUnavailable}</span>
              <span>🧍 {c.patientsToday}</span>
              <span>💊 {t('lowStockShort')}: {c.lowStockCount}</span>
            </div>
            <Link to={`/centre/${c.id}`}>
              <button>{t('viewDetails')}</button>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}