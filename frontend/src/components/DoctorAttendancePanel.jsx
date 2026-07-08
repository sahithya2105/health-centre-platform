import React, { useEffect, useState } from 'react';
import { getDoctorAttendanceDetail } from '../api';

export default function DoctorAttendancePanel({ doctors, t }) {
  const [details, setDetails] = useState({});

  useEffect(() => {
    doctors.forEach(d => {
      getDoctorAttendanceDetail(d.id).then(det => setDetails(prev => ({ ...prev, [d.id]: det })));
    });
  }, [doctors]);

  if (doctors.length === 0) return <p>{t('noDoctors')}</p>;

  return (
    <div className="card">
      <h3>{t('doctorAttendanceModule')}</h3>
      {doctors.map(doc => {
        const det = details[doc.id];
        return (
          <div key={doc.id} className="doctor-attendance-block">
            <b>{doc.name}</b> — {doc.specialization}
            {det && (
              <>
                <p>
                  {t('weeklyAttendance')}: <b>{det.weeklyRate}%</b> | {t('monthlyAttendance')}: <b>{det.monthlyRate}%</b>
                  {det.warning && <span className="badge HIGH" style={{ marginLeft: 8 }}>{t('lowAttendanceWarning')}</span>}
                </p>
                <div className="attendance-calendar">
                  {det.calendar.map((c, i) => (
                    <span key={i} className={`cal-cell ${c.present ? 'present' : 'absent'}`} title={c.date} />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}