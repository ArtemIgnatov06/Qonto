import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/SellerApplyComplete.css';

// все картинки из /assets
import plane   from '../assets/planex.png';
import account from '../assets/account.png';
import complete from '../assets/complete.png';
import leftDecor  from '../assets/left.png';
import rightDecor from '../assets/right.png';

// ...imports как у тебя
export default function SellerApplyComplete() {
  const navigate = useNavigate();
  return (
    <main className="success-page" role="main" aria-label="Успішна реєстрація">
      {/* ЦЕНТРИРУЕМ ТОЛЬКО КОНТЕНТ */}
      <div className="success-frame">
        <h4 className="success-title">Ви успішно оформилися</h4>
        <p className="success-text">
          Наші модератори перевіряють ваші дані, після перевірки вам на пошту прийде повідомлення
        </p>

        <button
          className="success-btn success-btn--primary"
          type="button"
          onClick={() => navigate('/')}
        >
          За покупками
        </button>
        <img className="success-icon success-icon--arrow" src={plane} alt="" aria-hidden="true" />

        <button
          className="success-btn success-btn--ghost"
          type="button"
          onClick={() => navigate('/profile')}
        >
          До профілю
        </button>
        <img className="success-icon success-icon--user" src={account} alt="" aria-hidden="true" />

        <img src={complete} alt="main-success" className="success-img-main" />
      </div>

      {/* Декоры пусть остаются как были */}
      <div className="decor decor--left"><img src={leftDecor} alt="" aria-hidden="true" /></div>
      <div className="decor decor--right"><img src={rightDecor} alt="" aria-hidden="true" /></div>
    </main>
  );
}
