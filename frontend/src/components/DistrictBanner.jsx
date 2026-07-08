import React from 'react';

export default function DistrictBanner({ status, t }) {
  if (!status) return null;
  const items = [
    { label: t('criticalCentres'), value: status.criticalCentres, color: status.criticalCentres > 0 ? 'red' : 'green' },
    { label: t('lowStockMedicines'), value: status.lowStockMedicines, color: status.lowStockMedicines > 0 ? 'orange' : 'green' },
    { label: t('doctorsAbsent'), value: status.doctorsAbsent, color: status.doctorsAbsent > 0 ? 'orange' : 'green' },
    { label: t('bedsAvailableLabel'), value: status.bedsAvailable, color: 'green' },
    { label: t('unavailableTests'), value: status.unavailableTests, color: status.unavailableTests > 0 ? 'orange' : 'green' }
  ];
  const overallOk = status.criticalCentres === 0;
  return (
    <div className="banner">
      <div className="banner-title">
        <span>{overallOk ? '🟢' : '🔴'}</span> {t('districtStatus')}
      </div>
      <div className="banner-items">
        {items.map((it, i) => (
          <div className={`banner-item banner-${it.color}`} key={i}>
            <b>{it.value}</b>
            <span>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}