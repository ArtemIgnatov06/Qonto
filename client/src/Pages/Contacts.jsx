import React from 'react';
import '../App.css';

export default function Contacts() {
  return (
    <div className="page page-contacts">
      <div className="content-box">
        <h2 className="heading-large">Контакты</h2>
        <p className="text-muted">
          Свяжитесь с нами по почте: <a href="mailto:info@myshop.com" className="link">info@myshop.com</a>
        </p>
      </div>
    </div>
  );
}
