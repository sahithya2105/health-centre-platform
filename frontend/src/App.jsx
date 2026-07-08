import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Dashboard from './components/Dashboard.jsx';
import CentreDetail from './components/CentreDetail.jsx';
import Alerts from './components/Alerts.jsx';
import AdminView from './components/AdminView.jsx';
import LanguageSwitcher from './components/LanguageSwitcher.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import Chatbot from './components/Chatbot.jsx';
import { getAlerts } from './api';

export default function App() {
  const { t } = useTranslation();
  const location = useLocation();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  function load() {
    getAlerts().then(setAlerts);
  }

  return (
    <div>
      <div className="navbar">
        <h1>{t('appTitle')}</h1>
        <nav>
          <Link className={location.pathname === '/' ? 'active' : ''} to="/">{t('dashboard')}</Link>
          <Link className={location.pathname === '/alerts' ? 'active' : ''} to="/alerts">{t('alerts')}</Link>
          <Link className={location.pathname === '/admin' ? 'active' : ''} to="/admin">{t('adminView')}</Link>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NotificationBell alerts={alerts} />
          <LanguageSwitcher />
        </div>
      </div>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/centre/:id" element={<CentreDetail />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/admin" element={<AdminView />} />
        </Routes>
      </div>
      <Chatbot />
    </div>
  );
}