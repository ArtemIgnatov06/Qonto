import React, { useEffect, useState } from 'react';
import '../html/return.css';
import arrowIcon from '../assets/planex.png';

export default function ReturnPage() {
  const [html, setHtml] = useState('<p>Завантаження…</p>');

  useEffect(() => {
    document.title = 'Повернення — Qonto';

    (async () => {
      try {
        const res = await fetch('/html/return.html', { cache: 'no-store' });
        const text = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // снести чужие стили/скрипты/хедер/футер
        doc.querySelectorAll('style, link[rel="stylesheet"], script, header, footer, nav, .hdr, .ftr')
          .forEach(n => n.remove());

        // убрать дублирующий заголовок из импортированного HTML
        const killDupTitle = (keyword) => {
          const nodes = doc.querySelectorAll('h1, h2, .about-title, .title');
          for (const n of nodes) {
            const t = (n.textContent || '').trim().toLowerCase();
            if (t.includes(keyword)) { n.remove(); break; }
          }
        };
        killDupTitle('повернен'); // «Повернення»

        // основной контент
        const content =
          doc.querySelector('#content, main, article, .content, .legal-wrap') || doc.body;

        setHtml(content.innerHTML || '<p>Немає даних.</p>');
      } catch {
        setHtml('<p>Не вдалося завантажити документ.</p>');
      }
    })();
  }, []);

  return (
    <main className="page return-page">
      <div className="return-container">
        <div className="return-hero">
          <span className="return-hero__icon" aria-hidden="true">
            <img src={arrowIcon} alt="" className="page-arrow" />
          </span>
          <h1 className="return-hero__title">Повернення</h1>
        </div>

        <div className="return-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
