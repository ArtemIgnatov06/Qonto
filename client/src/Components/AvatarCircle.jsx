import React, { useState, useMemo } from 'react';
import '../Styles/AvatarCircle.css';

export default function AvatarCircle({
  src,
  firstName,
  lastName,
  username,
  email,
  size = 40,          // поддержаны: 40, 112 (в проекте встречаются эти)
  fontSize,           // не используем напрямую — размер шрифта задаётся классом по size
  bg = '#2563eb',     // сейчас используем дефолтную тему (см. CSS). Если нужно — добавим модификаторы.
  textColor = '#fff', // как и выше
  showDot = false,
  online = false,
}) {
  const [broken, setBroken] = useState(false);

  const letter = useMemo(() => {
    const pick = (s) => (typeof s === 'string' && s.trim().length ? s.trim()[0] : '');
    const L =
      pick(firstName) ||
      pick(lastName) ||
      pick(username) ||
      pick(email) ||
      'U';
    return L.toUpperCase();
  }, [firstName, lastName, username, email]);

  const showImage = !!src && !broken;

  // подхватываем модификатор размера
  const sizeClass =
    size >= 100 ? 'ac--112'
    : 'ac--40';

  return (
    <div className={`ac ${sizeClass}`}>
      <div className={`ac__figure ${showImage ? 'has-image' : 'no-image'}`}>
        {showImage ? (
          <img
            src={src}
            alt=""
            onError={() => setBroken(true)}
            className="ac__img"
          />
        ) : (
          <span className="ac__letter">{letter}</span>
        )}
      </div>

      {showDot && (
        <span
          className={`ac__dot ${online ? 'online' : 'offline'}`}
          title={online ? 'в сети' : 'не в сети'}
        />
      )}
    </div>
  );
}
