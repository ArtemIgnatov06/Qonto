// socket.js (root)
// Актуализирован для проекта в корне + переменная окружения CLIENT_ORIGIN

const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');

const onlineUsers = new Map(); // userId -> Set<socketId>
let io = null;

/** ====================== helpers (online presence) ====================== */
function _attach(userId, socketId) {
  if (!userId) return;
  const key = Number(userId);
  if (!onlineUsers.has(key)) onlineUsers.set(key, new Set());
  onlineUsers.get(key).add(socketId);
}
function _detach(userId, socketId) {
  const key = Number(userId);
  const set = onlineUsers.get(key);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(key);
}

/** Пользователь онлайн? */
function isOnline(userId) {
  return onlineUsers.has(Number(userId));
}

/** Отправить событие ВСЕМ сокетам пользователя */
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${Number(userId)}`).emit(event, payload);
}

/** Дать прямой доступ к io при необходимости */
function getIo() {
  return io;
}

/** ====================== init ====================== */
/**
 * Инициализация Socket.IO
 * @param {import('http').Server} httpServer - http.createServer(app)
 * @param {import('express').Express} [app] - Express app (необязательно; чтобы сохранить helpers в app.locals)
 * @returns {{ io: import('socket.io').Server, isOnline: Function, emitToUser: Function }}
 */
function initSocket(httpServer, app) {
  // Разрешённые источники для CORS (из .env: CLIENT_ORIGIN="https://a.com,https://b.com")
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    }
  });

  // Подключим cookieParser для middleware сокета (по желанию)
  io.use((socket, next) => {
    cookieParser()(socket.request, {}, () => next());
  });

  io.on('connection', (socket) => {
    let userId = null;

    // Клиент после connect присылает свой userId
    socket.on('auth', (uid) => {
      userId = Number(uid);
      if (!userId) return;
      socket.join(`user:${userId}`);
      _attach(userId, socket.id);
      io.emit('presence:update', { userId, online: true });
    });

    // Войти в комнату треда (для typing/сообщений)
    socket.on('thread:join', (threadId) => {
      const tid = Number(threadId);
      if (!tid) return;
      socket.join(`thread:${tid}`);
    });

    // Событие "печатает"
    socket.on('thread:typing', ({ threadId, from }) => {
      const tid = Number(threadId);
      if (!tid) return;
      socket.to(`thread:${tid}`).emit('thread:typing', { threadId: tid, from });
    });

    socket.on('disconnect', () => {
      if (userId) {
        _detach(userId, socket.id);
        if (!isOnline(userId)) {
          io.emit('presence:update', { userId, online: false });
        }
      }
    });
  });

  // По желанию — положим хелперы в app.locals, чтобы дергать из REST-роутов
  if (app && app.locals) {
    app.locals.isOnline = isOnline;
    app.locals.emitToUser = emitToUser;
  }

  return { io, isOnline, emitToUser };
}

module.exports = { initSocket, isOnline, emitToUser, getIo };
