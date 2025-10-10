import React, { useEffect, useState } from 'react';
import '../html/terms-of-use.css';

export default function Terms() {
  const [html, setHtml] = useState('<p>Завантаження…</p>');

  useEffect(() => {
    document.title = 'Умови використання сайту — Qonto';

    (async () => {
      try {
        const res = await fetch('/html/terms-of-use.html', { cache: 'no-store' });
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
        killDupTitle('умов');   // «Умови використання сайту»

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
    <main className="page terms-page">
      <div className="terms-container">
        <div className="terms-hero">
          <span className="terms-hero__icon" aria-hidden="true">➤</span>
          <h1 className="terms-hero__title">Умови використання сайту</h1>
        </div>

        <div className="terms-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
