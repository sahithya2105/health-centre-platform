import React from 'react';

export default function AIRecommendation({ rec, t }) {
  if (!rec) return null;
  const riskColor = rec.riskLevel === 'High' ? 'HIGH' : rec.riskLevel === 'Medium' ? 'MEDIUM' : 'LOW';
  return (
    <div className="card ai-card">
      <h3>🤖 {t('aiRecommendation')}</h3>
      <p>{t('riskLevel')}: <span className={`badge ${riskColor}`}>{rec.riskLevel}</span></p>

      <b>{t('reasons')}</b>
      <ul className="recommendation-list">
        {rec.reasons.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      <b>{t('recommendations')}</b>
      <ul className="recommendation-list">
        {rec.recommendations.map((r, i) => <li key={i}>{r}</li>)}
      </ul>

      <p className="ai-score-projection">
        {t('expectedScoreAfterAction')}: <b>{rec.currentScore}</b> → <b className="projected">{rec.projectedScore}</b>
      </p>
    </div>
  );
}