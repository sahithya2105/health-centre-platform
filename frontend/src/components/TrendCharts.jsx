import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function Chart({ title, data, dataKey, color }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <b>{title}</b>
      <div style={{ height: 180, background: 'white', borderRadius: 10, padding: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function TrendCharts({ trends, t }) {
  if (!trends) return null;
  return (
    <div className="card">
      <h3>{t('trends')}</h3>
      <Chart title={t('medicineConsumptionTrend')} data={trends.medicineConsumption} dataKey="total" color="#0b6e4f" />
      <Chart title={t('bedOccupancyTrend')} data={trends.bedOccupancy} dataKey="occupancyRate" color="#ef6c00" />
      <Chart title={t('doctorAttendanceTrend')} data={trends.doctorAttendance} dataKey="rate" color="#1565c0" />
      <Chart title={t('footfallTrend')} data={trends.footfall} dataKey="patient_count" color="#6a1b9a" />
    </div>
  );
}