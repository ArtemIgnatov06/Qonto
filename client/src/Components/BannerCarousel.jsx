import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../Styles/BannerCarousel.css';

// импортируем ассеты, чтобы бандлер дал корректные URL
import banner1 from '../assets/banner-1.png';
import banner2 from '../assets/banner-2.png';
import banner3 from '../assets/banner-3.png';

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD = 40;

export default function BannerCarousel({
  // по умолчанию берём локальные ассеты:
  items = [
    { src: banner1, alt: 'Розпродаж -10%' },
    { src: banner2, alt: 'Моторошна доставка' },
    { src: banner3, alt: 'Розпродаж легенд' },
  ],
  radius = 16,
}) {
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);
  const wrapRef = useRef(null);
  const touchStartX = useRef(null);

  const go = useCallback((n) => {
    setIdx((i) => (i + n + items.length) % items.length);
  }, [items.length]);

  const goTo = (i) => setIdx(i);

  useEffect(() => {
    const restart = () => {
      clearInterval(timer.current);
      timer.current = setInterval(() => go(1), AUTOPLAY_MS);
    };
    restart();
    return () => clearInterval(timer.current);
  }, [go]);

  const pause = () => clearInterval(timer.current);
  const resume = () => {
    clearInterval(timer.current);
    timer.current = setInterval(() => go(1), AUTOPLAY_MS);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (document.activeElement && wrapRef.current?.contains(document.activeElement)) {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove  = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      go(dx > 0 ? -1 : 1);
      touchStartX.current = null;
    }
  };
  const onTouchEnd = () => { touchStartX.current = null; };

  return (
    <div
      ref={wrapRef}
      className="hero"
      style={{ borderRadius: radius }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div
        className="hero-track"
        style={{ transform: `translateX(-${idx * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {items.map((it, i) => (
          <div className="hero-slide" key={i} role="group" aria-roledescription="slide" aria-label={`${i+1} / ${items.length}`}>
            <img src={it.src} alt={it.alt || ''} loading="eager" />
          </div>
        ))}
      </div>

      <button className="hero-nav hero-prev" aria-label="Попередній банер" onClick={() => go(-1)}>‹</button>
      <button className="hero-nav hero-next" aria-label="Наступний банер" onClick={() => go(1)}>›</button>

      <div className="hero-dots" role="tablist" aria-label="Перемикання банерів">
        {items.map((_, i) => (
          <button
            key={i}
            className={`hero-dot ${i === idx ? 'is-active' : ''}`}
            role="tab"
            aria-selected={i === idx}
            aria-label={`Банер ${i+1}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
