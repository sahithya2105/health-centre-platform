import React from 'react';

export default function InsightsPanel({ insights, t }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="card insights-box">
      <h3>💡 {t('todaysInsights')}</h3>
      <ul>
        {insights.map((ins, i) => <li key={i}>{ins}</li>)}
      </ul>
    </div>
  );
}