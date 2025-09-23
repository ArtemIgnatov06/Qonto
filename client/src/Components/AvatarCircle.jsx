import React, { useState, useMemo } from 'react';
import '../Styles/AvatarCircle.css';

export default function AvatarCircle({
    src,                   // string | undefined
    firstName, lastName,   // strings | undefined
    username, email,       // strings | undefined
    size = 40,             // px
    fontSize,              // px, по умолчанию 0.42 * size
    bg = '#2563eb',        // фон круга, когда показываем букву
    textColor = '#fff',    // цвет буквы
    showDot = false,       // онлайн-точка
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

    const fs = fontSize || Math.round(size * 0.42);

    const showImage = !!src && !broken;

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: showImage ? '#e5e7eb' : bg,
                    display: 'grid',
                    placeItems: 'center',
                    userSelect: 'none',
                }}
            >
                {showImage ? (
                    <img
                        src={src}
                        alt=""
                        onError={() => setBroken(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                ) : (
                    <span style={{ color: textColor, fontWeight: 700, fontSize: fs, lineHeight: 1 }}>
                        {letter}
                    </span>
                )}
            </div>

            {showDot && (
                <span
                    title={online ? 'в сети' : 'не в сети'}
                    style={{
                        position: 'absolute',
                        right: -2,
                        bottom: -2,
                        width: 20,     // 👈 уменьшил
                        height: 20,    // 👈 уменьшил
                        borderRadius: '50%',
                        background: online ? '#22c55e' : '#9ca3af',
                        border: '2px solid #fff', // тоньше
                        boxShadow: '0 1px 3px rgba(0,0,0,.15)',
                        pointerEvents: 'none',
                        zIndex: 2
                    }}
                />
            )}
        </div>
    );
}