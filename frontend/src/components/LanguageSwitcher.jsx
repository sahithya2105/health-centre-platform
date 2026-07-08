import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  return (
    <span>
      <select
        value={i18n.language}
        onChange={e => i18n.changeLanguage(e.target.value)}
        aria-label={t('language')}
      >
        <option value="en">English</option>
        <option value="hi">हिंदी</option>
        <option value="ta">தமிழ்</option>
      </select>
    </span>
  );
}