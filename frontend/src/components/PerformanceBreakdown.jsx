import React from 'react';
import ProgressBar from './ProgressBar.jsx';

export default function PerformanceBreakdown({ breakdown, score, healthLabel, t }) {
  if (!breakdown) return null;
  const labelMap = {
    EXCELLENT: t('excellent'),
    GOOD: t('good'),
    NEEDS_ATTENTION: t('needsAttention'),
    CRITICAL: t('critical')
  };
  return (
    <div className="card">
      <h3>
        {t('aiHealthScore')}: {score}/100{' '}
        <span className={`badge ${healthLabel}`}>{labelMap[healthLabel] || healthLabel}</span>
      </h3>
      <ProgressBar label={t('medicineAvailability')} value={breakdown.medicineAvailability} />
      <ProgressBar label={t('doctorAttendance')} value={breakdown.doctorAttendance} />
      <ProgressBar label={t('bedUtilization')} value={breakdown.bedUtilization} />
      <ProgressBar label={t('testAvailabilityLabel')} value={breakdown.testAvailability} />
      <ProgressBar label={t('patientLoadManagement')} value={breakdown.patientLoadManagement} />
    </div>
  );
}