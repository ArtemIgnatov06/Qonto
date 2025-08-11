import React, { useEffect } from 'react';
import '../Styles/profile.css';
import { useAuth } from '../Hooks/useAuth';

const Profile = () => {
  const { user, refresh } = useAuth();

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) {
    return <div className="profile-page">Не авторизован</div>;
  }

  const handleLogout = async () => {
    await fetch('http://localhost:5000/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    window.location.href = '/';
  };

  return (
    <div className="profile-page">
      <h2>Профиль</h2>
      <div className="info">
        <p>
          <strong>Имя:</strong> {user.first_name}
        </p>
        <p>
          <strong>Фамилия:</strong> {user.last_name}
        </p>
        <p>
          <strong>Логин:</strong> {user.username}
        </p>
        <p>
          <strong>Телефон:</strong> {user.phone}
        </p>
        <p>
          <strong>Email:</strong> {user.email}
        </p>
      </div>
      <button className="btn-logout" onClick={handleLogout}>
        Выйти
      </button>
    </div>
  );
};

export default Profile;
