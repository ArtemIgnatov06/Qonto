import React, { useEffect, useState } from 'react';
// если стили лежат рядом со страницей, лучше: './vacancies.css'
import '../html/vacancy.css';

export default function Vacancies() {
  const [html, setHtml] = useState('<p>Завантаження…</p>');

  useEffect(() => {
    document.title = 'Вакансії — Qonto';

    (async () => {
      try {
        const res = await fetch('/html/vacancy.html', { cache: 'no-store' });
        const text = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // 1) убираем чужие стили/скрипты/шапку/футер
        doc
          .querySelectorAll(
            'style, link[rel="stylesheet"], script, header, footer, nav, .hdr, .ftr'
          )
          .forEach((n) => n.remove());

        // 2) удаляем первый заголовок "Вакансії" из импортированного файла
        ['h1', 'h2', '.about-title', '.title'].some((sel) => {
          const node = doc.querySelector(sel);
          if (node && node.textContent.trim().toLowerCase().includes('ваканс')) {
            node.remove();
            return true; // прекращаем после первого совпадения
          }
          return false;
        });

        // 3) берём основной контейнер, если есть, иначе — body
        const content =
          doc.querySelector('#content, main, article, .content, .legal-wrap') ||
          doc.body;

        setHtml(content.innerHTML || '<p>Немає даних.</p>');
      } catch {
        setHtml('<p>Не вдалося завантажити сторінку вакансій.</p>');
      }
    })();
  }, []);

  return (
    <main className="page vacancy-page">
      <div className="vacancy-container">
        <div className="vacancy-hero">
          <span className="vacancy-hero__icon" aria-hidden="true">
            ➤
          </span>
          <h1 className="vacancy-hero__title">Вакансії</h1>
        </div>

        <div
          className="vacancy-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  );
}
