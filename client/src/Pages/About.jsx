// client/src/Pages/About.jsx
import React, { useEffect } from 'react';
import '../App.css';
import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation(); // defaultNS: common

  // обновляем заголовок вкладки при смене языка
  useEffect(() => {
    document.title = t('meta.title.about');
  }, [t]);

  return (
    <div className="page page-about" aria-labelledby="about-title">
      <div className="content-box">
        <h2 id="about-title" className="heading-large">
          {t('about.title')}
        </h2>
        <p className="text-muted">
          {t('about.lead')}
        </p>
      </div>
    </div>
  );
}
