import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAlerts, resolveAlert } from '../api';

const TYPES = ['ALL', 'STOCKOUT', 'DOCTOR', 'BED', 'TEST', 'PERFORMANCE'];
const SEVERITIES = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('PENDING');

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  function load() {
    getAlerts()
      .then(setAlerts)
      .finally(() => setLoading(false));
  }

  async function handleResolve(id) {
    await resolveAlert(id);
    load();
  }

  if (loading) return <p>{t('loading')}</p>;

  const filtered = alerts.filter(a => {
    if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (statusFilter === 'PENDING' && a.resolved) return false;
    if (statusFilter === 'RESOLVED' && !a.resolved) return false;
    return true;
  });

  const typeLabel = ty => ({
    ALL: t('all'), STOCKOUT: t('stockAlerts'), DOCTOR: t('doctorAlerts'),
    BED: t('bedAlerts'), TEST: t('testAlerts'), PERFORMANCE: t('criticalAlerts')
  }[ty] || ty);

  return (
    <div>
      <h2>{t('alerts')}</h2>

      <div className="tabs">
        {TYPES.map(ty => (
          <button
            key={ty}
            className={`tab ${typeFilter === ty ? 'active' : ''}`}
            onClick={() => setTypeFilter(ty)}
          >
            {typeLabel(ty)}
          </button>
        ))}
      </div>

      <div className="chips">
        {SEVERITIES.map(s => (
          <span
            key={s}
            className={`chip ${severityFilter === s ? 'active' : ''}`}
            onClick={() => setSeverityFilter(s)}
          >
            {s === 'ALL' ? t('all') : s}
          </span>
        ))}
        <span
          className={`chip ${statusFilter === 'PENDING' ? 'active' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
        >
          {t('pending')}
        </span>
        <span
          className={`chip ${statusFilter === 'RESOLVED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('RESOLVED')}
        >
          {t('resolved')}
        </span>
      </div>

      {filtered.length === 0 && <p>{t('noAlerts')}</p>}
      {filtered.map(a => (
        <div className={`alert-item ${a.severity}`} key={a.id}>
          <span className={`badge ${a.severity}`}>{a.severity}</span>{' '}
          <b>[{typeLabel(a.type)}]</b> Centre #{a.centre_id}: {a.message}
          <div style={{ fontSize: 12, color: '#666' }}>{a.created_at}</div>
          {!a.resolved && <button onClick={() => handleResolve(a.id)}>{t('resolve')}</button>}
          {a.resolved && <span className="badge GOOD">{t('resolved')}</span>}
        </div>
      ))}
    </div>
  );
}