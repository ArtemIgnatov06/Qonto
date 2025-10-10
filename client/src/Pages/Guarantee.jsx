import React, { useEffect, useState } from 'react';
import '../html/guarantee.css'; // или ./guarantee.css если перенесёшь рядом со страницей

export default function GuaranteePage() {
  const [html, setHtml] = useState('<p>Завантаження…</p>');

  useEffect(() => {
    document.title = 'Гарантія — Qonto';

    (async () => {
      try {
        const res = await fetch('/html/guarantee.html', { cache: 'no-store' });
        const text = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // снести чужие стили/скрипты/хедер/футер из файла
        doc.querySelectorAll('style, link[rel="stylesheet"], script, header, footer, nav, .hdr, .ftr')
           .forEach(n => n.remove());

        // убрать дублирующий заголовок «Гарантія/Гарантия», если есть
        const nodes = doc.querySelectorAll('h1, h2, .about-title, .title');
        for (const n of nodes) {
          const t = (n.textContent || '').trim().toLowerCase();
          if (t.includes('гарант')) { n.remove(); break; }
        }

        // взять основной контейнер, иначе — body
        const content =
          doc.querySelector('#content, main, article, .content, .legal-wrap') || doc.body;

        setHtml(content.innerHTML || '<p>Немає даних.</p>');
      } catch {
        setHtml('<p>Не вдалося завантажити документ.</p>');
      }
    })();
  }, []);

  return (
    <main className="page guarantee-page">
      <div className="guarantee-container">
        <div className="guarantee-hero">
          <span className="guarantee-hero__icon" aria-hidden="true">➤</span>
          <h1 className="guarantee-hero__title">Гарантія</h1>
        </div>

        <div className="guarantee-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
