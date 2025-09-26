// client/src/Components/Footer.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';

// базовые (пикс-в-пикс) стили из фигмы
import '../Styles/footer.css';
// оверрайды: фикс внизу + адаптив
import Mascot from '../assets/maskotfooter.png';
export default function Footer() {
  return (
    <div className="ftr-wrap">
      <footer className="ftr" role="contentinfo">
        <div className="ftr-bg" />

        {/* Заголовки колонок */}
        <h4 className="ftr-h4 ftr-h4--info">Інформація</h4>
        <h4 className="ftr-h4 ftr-h4--help">Допомога</h4>
        <h4 className="ftr-h4 ftr-h4--sellers">Продавцям</h4>
        <h4 className="ftr-h4 ftr-h4--social">Ми в соцмережах</h4>

        {/* Списки */}
        <ul className="ftr-list ftr-list--info">
          <li><NavLink to="/about">Про нас</NavLink></li>
          <li><NavLink to="/contacts">Контакти</NavLink></li>
          <li><NavLink to="/terms">Умови використання</NavLink></li>
          <li><NavLink to="/privacy">Політика конфіденційності</NavLink></li>
        </ul>

        <ul className="ftr-list ftr-list--help">
          <li><NavLink to="/delivery">Доставка</NavLink></li>
          <li><NavLink to="/returns">Повернення</NavLink></li>
          <li><NavLink to="/faq">FAQ</NavLink></li>
          <li><NavLink to="/support">Підтримка</NavLink></li>
        </ul>

        <ul className="ftr-list ftr-list--sellers">
          <li><NavLink to="/seller/rules">Правила для продавців</NavLink></li>
          <li><NavLink to="/seller/fees">Тарифи</NavLink></li>
          <li><NavLink to="/seller/verification">Верифікація</NavLink></li>
          <li><NavLink to="/seller/help">Довідка</NavLink></li>
        </ul>

        {/* Соц. иконки */}
        <a className="ftr-soc ftr-soc--ig" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="5" stroke="#ECECEC" strokeWidth="2"/>
            <circle cx="12" cy="12" r="4" stroke="#ECECEC" strokeWidth="2"/>
            <circle cx="17" cy="7" r="1.5" fill="#ECECEC"/>
          </svg>
        </a>
        <a className="ftr-soc ftr-soc--fb" href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 3h-2a4 4 0 0 0-4 4v2H7v3h2v9h3v-9h2.3L15 9h-3V7a1 1 0 0 1 1-1h2V3z" stroke="#ECECEC" strokeWidth="2" fill="none"/>
          </svg>
        </a>
        <a className="ftr-soc ftr-soc--tt" href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 4L3 11l5 2 2 6 3-4 5 4 3-15z" stroke="#ECECEC" strokeWidth="2" fill="none"/>
          </svg>
        </a>

        {/* Копирайт */}
        <p className="ftr-copy">
          ©2025 Платформа онлайн-торгівлі «Qonto» — використовується на підставі ліцензії правовласника
        </p>

        {/* Маскот (если положишь картинку по пути /assets/mascot.png) */}
        {Mascot && <img className="ftr-mascot" src={Mascot} alt="" />}
      </footer>

      {/* Мобильная сетка (используется только в @media, см. CSS оверрайд) */}
      <div className="ftr-grid" aria-hidden="true" />
    </div>
  );
}
