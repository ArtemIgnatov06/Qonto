import React, { useEffect, useState } from 'react';
import '../html/contacts.css';

/* ВАЖНО: используем абсолютные пути, чтобы dev-сервер отдал файлы из /html */
// ВАЖНО: картинки из public
const HOURS_IMG   = process.env.PUBLIC_URL + '/html/schedule.png';   // 1-я карточка
const VACANCY_IMG = process.env.PUBLIC_URL + '/html/vacantions.png'; // 3-я карточка

export default function ContactsPage() {
  const [html, setHtml] = useState('<p>Завантаження…</p>');

  useEffect(() => {
    document.title = 'Контакти — Qonto';

    (async () => {
      try {
        const candidates = ['/html/contacts.html', '/html/contact.html'];
        let text = null;
        for (const url of candidates) {
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) { text = await res.text(); break; }
        }
        if (!text) throw new Error('not-found');

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        // вычищаем чужие стили/скрипты/хедер/футер
        doc.querySelectorAll('style, link[rel="stylesheet"], script, header, footer, nav, .hdr, .ftr')
          .forEach(n => n.remove());

        // берём три блока (или ближайшие аналоги)
        const col1 = doc.querySelector('.group-167') || doc.querySelector('.card-hours')   || null;
        const col2 = doc.querySelector('.group-166') || doc.querySelector('.card-emails')  || null;
        const col3 = doc.querySelector('.group-165') || doc.querySelector('.card-vacancy') || null;

        const grid = doc.createElement('div');
        grid.className = 'contacts-grid';

        // 1) Левая карточка
        if (col1) {
          col1.classList.add('contact-card', 'card-hours');

          let img = col1.querySelector('img, picture, svg');
          if (!img) {
            img = doc.createElement('img');
            img.alt = 'Schedule';
            img.loading = 'lazy';
            col1.append(img);
          }
          img.setAttribute('src', HOURS_IMG);
          img.setAttribute('onerror', `this.removeAttribute('onerror');this.src='${HOURS_IMG}';`);

          grid.append(col1);
        }

        // 2) Средняя карточка — email’ы
        if (col2) {
          col2.classList.add('contact-card', 'card-emails');

          const rows = doc.createElement('div');
          rows.className = 'emails-rows';

          let built = 0;
          for (let i = 1; i <= 8; i++) {
            const title = col2.querySelector(`.r${i}-title`);
            const link  = col2.querySelector(`.r${i}-link, .r${i}-email, .r${i}-mail`);
            if (!title || !link) continue;

            const row   = doc.createElement('div'); row.className = 'row';
            const left  = doc.createElement('span'); left.textContent = title.textContent.trim();
            const right = doc.createElement('a');
            right.href = link.getAttribute('href') || `mailto:${link.textContent.trim()}`;
            right.textContent = link.textContent.trim();
            row.append(left, right);
            rows.append(row);
            built++;
          }

          if (!built) {
            col2.querySelectorAll('a[href]').forEach(a => {
              const row   = doc.createElement('div'); row.className = 'row';
              const left  = doc.createElement('span'); left.textContent =
                a.previousElementSibling?.textContent?.trim() ||
                a.parentElement?.firstChild?.textContent?.trim() || '';
              const right = doc.createElement('a'); right.href = a.href; right.textContent = a.textContent.trim();
              row.append(left, right);
              rows.append(row);
            });
          }

          if (rows.children.length) {
            col2.innerHTML = '';
            const h = doc.createElement('h2');
            h.className = 'emails-title';
            h.textContent = 'Якщо виникли запитання';
            col2.append(h, rows);
          }

          grid.append(col2);
        }

        // 3) Правая карточка — «Вакансії»
        if (col3) {
          const a = doc.createElement('a');
          a.href = '/vacancies';
          a.className = 'contact-card card-vacancy';
          a.setAttribute('data-spa','1');

          while (col3.firstChild) a.append(col3.firstChild);

          let img = a.querySelector('img, picture, svg');
          if (!img) {
            img = doc.createElement('img');
            img.alt = 'Vacancies';
            img.loading = 'lazy';
            a.append(img);
          }
          img.setAttribute('src', VACANCY_IMG);
          img.setAttribute('onerror', `this.removeAttribute('onerror');this.src='${VACANCY_IMG}';`);

          grid.append(a);
        }

        setHtml(grid.outerHTML);
      } catch {
        setHtml('<p>Не вдалося завантажити документ.</p>');
      }
    })();
  }, []);

  return (
    <main className="page contacts-page">
      <div className="contacts-container">
        <div className="contacts-hero">
          <span className="contacts-hero__icon" aria-hidden="true">➤</span>
          <h1 className="contacts-hero__title">Контакти</h1>
        </div>

        <div className="contacts-content" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
