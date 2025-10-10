// client/src/Pages/Catalog.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/catalog.css';
import { catalogItems } from '../data/catalogItems';

export default function Catalog() {
  const navigate = useNavigate();

  const goToHomeWithFilter = (title) => {
    const params = new URLSearchParams({ category: title });
    // если главная страница у тебя не '/', поменяй pathname
    navigate({ pathname: '/', search: `?${params.toString()}` });
  };

  return (
    <main className="cat-stage" role="main" aria-label="Каталог">
      <div className="cat-container">
        <h1 className="visually-hidden">Каталог</h1>

        <div className="cat-grid">
          {catalogItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className="cat-card"
              aria-label={item.title}
              onClick={() => goToHomeWithFilter(item.title)}
            >
              <span className="card-bg" aria-hidden="true" />
              <span className="card-titleWrap">
                <span className="card-title">{item.title}</span>
                <span className="card-titleIco">
                  <img
                    src={require('../assets/catalog/planex.png')}
                    alt=""
                    loading="lazy"
                  />
                </span>
              </span>

              {/* большой рисунок в нижней части карточки */}
              <img
                className="card-hero"
                src={require(`../assets/catalog/${item.hero}`)}
                alt=""
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
