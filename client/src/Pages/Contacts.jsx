// client/src/Pages/Contacts.jsx
import React, { useEffect } from 'react';
import '../App.css';
import { useTranslation } from 'react-i18next';

export default function Contacts() {
  const { t } = useTranslation(); // defaultNS: common

  useEffect(() => {
    document.title = t('meta.title.contacts');
  }, [t]);

  return (
    <div className="page page-contacts" aria-labelledby="contacts-title">
      <div className="content-box">
        <h2 id="contacts-title" className="heading-large">
          {t('contacts.title')}
        </h2>
        <p className="text-muted">
          {t('contacts.text')}{' '}
          <a href="mailto:info@myshop.com" className="link">info@myshop.com</a>
        </p>
      </div>
    </div>
  );
}
