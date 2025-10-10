// client/src/lib/socket.js
import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io('http://localhost:5050', {
      withCredentials: true,
      transports: ['websocket']
    });
  }
  return socket;
}

/** Авторизуем сокет (передаём user.id) */
export function authSocket(userId) {
  const s = getSocket();
  s.emit('auth', userId);
  return s;
}
