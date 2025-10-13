import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ru from './locales/ru/common.json';
import uk from './locales/uk/common.json';
import en from './locales/en/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { common: ru },
      uk: { common: uk },
      en: { common: en },
    },
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'uk', 'en'],
    defaultNS: 'common',
    ns: ['common'],
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
  });

// обновляем <html lang="…">
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng || 'ru';
  }
});

export default i18n;
