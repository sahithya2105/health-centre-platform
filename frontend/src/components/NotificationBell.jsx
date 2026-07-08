import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function NotificationBell({ alerts }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const unresolved = alerts.filter(a => !a.resolved);

  return (
    <div className="notification-bell">
      <button className="bell-btn" onClick={() => setOpen(o => !o)}>
        🔔
        {unresolved.length > 0 && <span className="bell-badge">{unresolved.length}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-title">{t('alerts')}</div>
          {unresolved.length === 0 && <p style={{ padding: 8 }}>{t('noAlerts')}</p>}
          {unresolved.slice(0, 6).map(a => (
            <div key={a.id} className={`notification-item ${a.severity}`}>
              <b>[{a.type}]</b> {a.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}