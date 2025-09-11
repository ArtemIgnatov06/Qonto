export const flagByCurrency = (ccy) =>
  ({
    UAH: '🇺🇦',
    EUR: '🇪🇺',
    USD: '🇺🇸',
    CZK: '🇨🇿',
    GBP: '🇬🇧',
  }[String(ccy).toUpperCase()] || '🏳️');

export const flagByLang = (lng) =>
  ({
    uk: '🇺🇦',      // Українська
    ru: '🇷🇺',      // Русский
    en: '🇬🇧',      // English (UK флаг чаще используют для языка)
  }[String(lng).toLowerCase()] || '🏳️');
