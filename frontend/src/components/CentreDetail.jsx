import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  getCentreDetail, getMedicineForecast, updateStock, getFootfallForecast,
  getRecommendation, getCentreTrends
} from '../api';
import AIRecommendation from './AIRecommendation.jsx';
import PerformanceBreakdown from './PerformanceBreakdown.jsx';
import MedicineDemandTable from './MedicineDemandTable.jsx';
import DoctorAttendancePanel from './DoctorAttendancePanel.jsx';
import TrendCharts from './TrendCharts.jsx';
import InsightsPanel from './InsightsPanel.jsx';
import ProgressBar from './ProgressBar.jsx';

export default function CentreDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [forecasts, setForecasts] = useState({});
  const [footfallForecast, setFootfallForecast] = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    load();
  }, [id]);

  function load() {
    getCentreDetail(id).then(d => {
      setData(d);
      d.medicines.forEach(m => {
        getMedicineForecast(m.id).then(f =>
          setForecasts(prev => ({ ...prev, [m.id]: f }))
        );
      });
    });
    getFootfallForecast(id).then(setFootfallForecast);
    getRecommendation(id).then(setRecommendation);
    getCentreTrends(id).then(setTrends);
  }

  async function handleStockChange(medId, delta) {
    const med = data.medicines.find(m => m.id === medId);
    const newStock = Math.max(0, med.current_stock + delta);
    await updateStock(medId, { newStock, consumedToday: delta < 0 ? -delta : 0 });
    load();
  }

  if (!data) return <p>{t('loading')}</p>;

  const { centre, medicines, doctors, tests, footfall, beds, performance } = data;
  const latestBed = beds && beds.length ? beds[beds.length - 1] : null;
  const occupancyPct = latestBed ? Math.round((latestBed.occupied_beds / centre.total_beds) * 100) : 0;

  const insights = [];
  if (footfallForecast && footfallForecast.trend > 0) {
    insights.push(t('insightPatientIncrease', { pct: Math.round((footfallForecast.trend / Math.max(1, footfallForecast.avg)) * 100) }));
  }
  const urgentMed = medicines.find(m => m.current_stock <= m.reorder_level / 2);
  if (urgentMed) insights.push(t('insightMedFinish', { medicine: urgentMed.name }));

  return (
    <div>
      <h2>{centre.name}</h2>
      <p>{t('type')}: {centre.type} | {t('district')}: {centre.district}</p>

      <InsightsPanel insights={insights} t={t} />

      <PerformanceBreakdown
        breakdown={performance.breakdown}
        score={performance.score}
        healthLabel={performance.healthLabel}
        t={t}
      />

      <AIRecommendation rec={recommendation} t={t} />

      <h3 className="section-title">{t('bedAvailability')}</h3>
      <div className="card">
        <ProgressBar
          label={t('occupied')}
          value={occupancyPct}
          rightLabel={`${latestBed ? latestBed.occupied_beds : 0}/${centre.total_beds}`}
        />
        {occupancyPct >= 90 && <p className="warning-text">⚠️ {t('bedCriticalWarning')}</p>}
        <p>{t('availableBedsLabel')}: <b>{centre.total_beds - (latestBed ? latestBed.occupied_beds : 0)}</b></p>
      </div>

      <h3 className="section-title">{t('medicines')}</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>{t('stock')}</th>
            <th>{t('reorderLevel')}</th>
            <th>{t('avgDailyConsumption')}</th>
            <th>{t('daysToStockout')}</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {medicines.map(m => {
            const f = forecasts[m.id];
            const low = m.current_stock <= m.reorder_level;
            return (
              <tr key={m.id} style={{ background: low ? '#fdecea' : 'transparent' }}>
                <td>{m.name}</td>
                <td>{m.current_stock} {m.unit}</td>
                <td>{m.reorder_level}</td>
                <td>{f ? f.avgDailyConsumption : '-'}</td>
                <td>{f && f.daysToStockout != null ? f.daysToStockout : '-'}</td>
                <td>
                  <button onClick={() => handleStockChange(m.id, -5)}>-5</button>{' '}
                  <button onClick={() => handleStockChange(m.id, 20)}>+20 ({t('restock')})</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <MedicineDemandTable medicines={medicines} t={t} />

      <h3 className="section-title">{t('footfall')}</h3>
      <div style={{ height: 250, background: 'white', borderRadius: 10, padding: 10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={footfall}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="patient_count" stroke="#0b6e4f" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {footfallForecast && footfallForecast.dailyForecast && footfallForecast.dailyForecast.length > 0 && (
        <div className="card">
          <h3>{t('patientForecast7Day')}</h3>
          <div style={{ height: 200, background: 'white', borderRadius: 10, padding: 8, marginBottom: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={footfallForecast.dailyForecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="projectedPatients" fill="#0b6e4f" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table>
            <thead>
              <tr><th>{t('day')}</th><th>{t('date')}</th><th>{t('projectedPatients')}</th><th></th></tr>
            </thead>
            <tbody>
              {footfallForecast.dailyForecast.map((d, i) => (
                <tr key={i} style={{ background: d.busy ? '#fff3e0' : 'transparent' }}>
                  <td>{d.label}</td>
                  <td>{d.date}</td>
                  <td>{d.projectedPatients}</td>
                  <td>{d.busy && <span className="badge MEDIUM">{t('busyDay')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="section-title">{t('doctors')}</h3>
      <ul>
        {doctors.map(d => (
          <li key={d.id}>{d.name} — {d.specialization}</li>
        ))}
        {doctors.length === 0 && <li>{t('noDoctors')}</li>}
      </ul>
      <DoctorAttendancePanel doctors={doctors} t={t} />

      <h3 className="section-title">{t('tests')}</h3>
      <table>
        <thead>
          <tr><th>Test</th><th>Status</th></tr>
        </thead>
        <tbody>
          {tests.map(tst => (
            <tr key={tst.id}>
              <td>{tst.test_name}</td>
              <td>
                <span className={`badge ${tst.available ? 'GOOD' : 'UNDERPERFORMING'}`}>
                  {tst.available ? t('available') : t('unavailable')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <TrendCharts trends={trends} t={t} />
    </div>
  );
}