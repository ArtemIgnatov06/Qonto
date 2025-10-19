// client/src/Components/Footer.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import '../Styles/footer.css';
import Mascot from '../assets/maskotfooter.png';

export default function Footer() {
  return (
    <footer className="ftr-wrap" role="contentinfo">
      <div className="ftr">
        {/* Колонка 1 */}
        <div className="ftr-col">
          <h4 className="ftr-h4">Інформація</h4>
          <ul className="ftr-list">
            <li><NavLink to="/about">Про нас</NavLink></li>
            <li><NavLink to="/terms">Умови використання сайту</NavLink></li>
            <li><NavLink to="/vacancies">Вакансії</NavLink></li>
            <li><NavLink to="/contacts">Контакти</NavLink></li>
            <li><NavLink to="/feedback">Зворотній зв’язок</NavLink></li>
          </ul>
        </div>

        {/* Колонка 2 */}
        <div className="ftr-col">
          <h4 className="ftr-h4">Допомога</h4>
          <ul className="ftr-list">
            <li><NavLink to="/faq">Часті питання</NavLink></li>
            <li><NavLink to="/delivery">Доставка та оплата</NavLink></li>
            <li><NavLink to="/guarantee">Гарантія</NavLink></li>
            <li><NavLink to="/returns">Повернення</NavLink></li>
          </ul>
        </div>

        {/* Колонка 3 */}
        <div className="ftr-col">
          <h4 className="ftr-h4">Продавцям</h4>
          <ul className="ftr-list">
            <li><NavLink to="/seller/products">Продавати товари</NavLink></li>
            <li><NavLink to="/seller/rules">Правила торгівлі</NavLink></li>
          </ul>
        </div>

        {/* Колонка 4 */}
        <div className="ftr-col ftr-col--social">
          <h4 className="ftr-h4">Ми в соціальних мережах</h4>
          <div className="ftr-soc-row">
            <a className="ftr-soc" href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="5" stroke="#ECECEC" strokeWidth="2"/>
                <circle cx="12" cy="12" r="4" stroke="#ECECEC" strokeWidth="2"/>
                <circle cx="17" cy="7" r="1" fill="#ECECEC"/>
              </svg>
            </a>
            <a className="ftr-soc" href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#ECECEC">
                <path d="M13.5 21v-7h2.3l.4-3H13.5V9.1c0-.9.3-1.5 1.7-1.5H16V5.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 3.9V11H7v3h2.6v7h3.9z"/>
              </svg>
            </a>
            <a className="ftr-soc" href="https://t.me" target="_blank" rel="noreferrer" aria-label="Telegram">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="#ECECEC">
                <path d="M21 4L3 11l5 2 2 6 3-4 5 4 3-15z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Копирайт на всю ширину */}
        <p className="ftr-copy">
          ©2025 Платформа онлайн-торгівлі «Qonto» — використовується на підставі ліцензії правовласника
        </p>
      </div>

      {/* Маскот — «вылетает» за правый край контейнера к краю экрана */}
      {Mascot && <img className="ftr-mascot" src={Mascot} alt="" />}
    </footer>
  );
}
