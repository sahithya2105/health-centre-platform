import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getUnderperforming, getRedistribution, getDistrictSummary, getCentres,
  getDistrictStatus, postTransfer, getAlerts
} from '../api';
import StatCard from './StatCard.jsx';
import DistrictBanner from './DistrictBanner.jsx';

export default function AdminView() {
  const { t } = useTranslation();
  const [district, setDistrict] = useState('Chennai');
  const [districts, setDistricts] = useState(['Chennai']);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState(null);
  const [underperforming, setUnderperforming] = useState([]);
  const [redistribution, setRedistribution] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [processed, setProcessed] = useState({});
  const [allCentres, setAllCentres] = useState([]);

  useEffect(() => {
    getCentres().then(centres => {
      const uniq = [...new Set(centres.map(c => c.district))];
      setDistricts(uniq);
      setAllCentres(centres);
    });
  }, []);

  useEffect(() => {
    load();
  }, [district]);

  function load() {
    getDistrictSummary(district).then(setSummary);
    getUnderperforming(district).then(setUnderperforming);
    getRedistribution(district).then(setRedistribution);
    getDistrictStatus(district).then(setStatus);
    getAlerts().then(setAlerts);
    setProcessed({});
  }

  async function handleApprove(s) {
    await postTransfer({
      medicine: s.medicine,
      fromCentreId: s.fromCentreId,
      toCentreId: s.toCentreId,
      qty: s.suggestedQty
    });
    setProcessed(prev => ({ ...prev, [s.id]: 'approved' }));
    load();
  }

  function handleReject(s) {
    setProcessed(prev => ({ ...prev, [s.id]: 'rejected' }));
  }

  const districtCentres = allCentres.filter(c => c.district === district);
  const emergencyAlerts = alerts.filter(a => a.severity === 'HIGH' && !a.resolved);
  const pendingCount = redistribution.filter(s => !processed[s.id]).length;

  return (
    <div>
      <h2>{t('executiveDashboard')}</h2>
      <label>
        {t('district')}:{' '}
        <select value={district} onChange={e => setDistrict(e.target.value)}>
          {districts.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>

      <DistrictBanner status={status} t={t} />

      {summary && (
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <StatCard icon="🏥" label={t('totalCentres')} value={summary.centres} color="green" />
          <StatCard icon="💊" label={t('lowStockItems')} value={summary.totalLowStock} color={summary.totalLowStock > 0 ? 'orange' : 'green'} />
          <StatCard icon="🧍" label={t('totalPatientsToday')} value={summary.totalPatientsToday} color="blue" />
          <StatCard icon="🤖" label={t('avgScore')} value={`${summary.avgPerformanceScore}/100`} color={summary.avgPerformanceScore >= 80 ? 'green' : summary.avgPerformanceScore >= 60 ? 'orange' : 'red'} />
          <StatCard icon="📦" label={t('pendingApprovals')} value={pendingCount} color={pendingCount > 0 ? 'orange' : 'green'} />
          <StatCard icon="🚨" label={t('emergencyAlerts')} value={emergencyAlerts.length} color={emergencyAlerts.length > 0 ? 'red' : 'green'} />
        </div>
      )}

      <h3 className="section-title">{t('districtHeatmap')}</h3>
      <div className="heatmap-grid">
        {districtCentres.map(c => (
          <div
            key={c.id}
            className="heatmap-cell"
            style={{
              background:
                c.rating === 'GOOD' ? '#2e7d32' : c.rating === 'NEEDS_ATTENTION' ? '#ef6c00' : '#c62828'
            }}
            title={`${c.name}: ${c.performanceScore}/100`}
          >
            {c.name.split(' ')[0]}<br />{c.performanceScore}
          </div>
        ))}
      </div>

      {summary && summary.topPerforming && (
        <div className="two-col">
          <div className="card">
            <h3>🏆 {t('topPerformingCentres')}</h3>
            <ol>
              {summary.topPerforming.map(r => (
                <li key={r.centre.id}>{r.centre.name} — {r.score}/100</li>
              ))}
            </ol>
          </div>
          <div className="card">
            <h3>⚠️ {t('worstPerformingCentres')}</h3>
            <ol>
              {summary.worstPerforming.map(r => (
                <li key={r.centre.id}>{r.centre.name} — {r.score}/100</li>
              ))}
            </ol>
          </div>
        </div>
      )}

      <h3 className="section-title">🚨 {t('emergencyAlerts')}</h3>
      {emergencyAlerts.length === 0 && <p>{t('noAlerts')}</p>}
      {emergencyAlerts.slice(0, 5).map(a => (
        <div className="alert-item HIGH" key={a.id}>
          <span className="badge HIGH">{a.severity}</span> <b>[{a.type}]</b> {a.message}
        </div>
      ))}

      <h3 className="section-title">{t('underperformingCentres')}</h3>
      {underperforming.length === 0 && <p>{t('allGood')}</p>}
      {underperforming.map(u => (
        <div className="card" key={u.centre.id} style={{ marginBottom: 10 }}>
          <b>{u.centre.name}</b>{' '}
          <span className={`badge ${u.rating}`}>{u.rating.replace('_', ' ')}</span>
          <p>{t('performanceScore')}: {u.score}/100</p>
          <p>{t('reasons')}: {u.reasons.join('; ') || 'N/A'}</p>
        </div>
      ))}

      <h3 className="section-title">{t('redistribution')}</h3>
      {redistribution.length === 0 && <p>{t('noRedistributionNeeded')}</p>}
      <table>
        <thead>
          <tr>
            <th>Medicine</th><th>{t('from')}</th><th>{t('to')}</th><th>{t('reasons')}</th>
            <th>{t('suggestedQty')}</th><th>{t('estImprovement')}</th><th>{t('action')}</th>
          </tr>
        </thead>
        <tbody>
          {redistribution.map((r) => (
            <tr key={r.id}>
              <td>{r.medicine}</td>
              <td>{r.fromCentre}</td>
              <td>{r.toCentre}</td>
              <td>{r.reason}</td>
              <td>{r.suggestedQty}</td>
              <td>+{r.estImprovement}</td>
              <td>
                {processed[r.id] === 'approved' && <span className="badge GOOD">{t('approved')}</span>}
                {processed[r.id] === 'rejected' && <span className="badge LOW">{t('rejected')}</span>}
                {!processed[r.id] && (
                  <>
                    <button onClick={() => handleApprove(r)}>{t('approveTransfer')}</button>{' '}
                    <button onClick={() => handleReject(r)} style={{ background: '#c62828' }}>{t('rejectTransfer')}</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}