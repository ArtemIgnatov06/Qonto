import React from 'react';
import ChatWidget from '../Components/ChatWidget';
import '../App.css'; // если нужно, можно убрать если все в index.css

export default function Home() {
  return (
    <div className="page page-home">
      <div className="card">
        <button className="button menu-button" aria-label="Меню">
          &#9776;
        </button>
        <h2 className="heading-large">Каталог товаров</h2>
        <p className="text-muted">(Здесь будет каталог...)</p>
      </div>
      <ChatWidget />
    </div>
  );
}
